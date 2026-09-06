import assert from 'node:assert/strict';
import test from 'node:test';
import { Cache } from './cache.js';
import { createWorker, Env } from './worker.js';

const assets = {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    return path === '/index.html'
      ? new Response('<app-root></app-root>', { headers: { 'content-type': 'text/html' } })
      : new Response(null, { status: 404 });
  },
} as unknown as Fetcher;

const env: Env = {
  ASSETS: assets,
  ODDS_API_KEY: 'test-key',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
};

test('health route bellek cache durumunu döndürür', async () => {
  const worker = createWorker({ createCache: () => new Cache() });
  const response = await worker.fetch(new Request('https://example.test/health'), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', cache: 'memory' });
});

test('fixtures route nihai cevabı cacheleyerek ikinci istekte kaynak API çağrılarını atlar', async () => {
  const cache = new Cache();
  const worker = createWorker({ createCache: () => cache });
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async (input) => {
    fetchCount += 1;
    const url = String(input);
    if (url.endsWith('/bootstrap-static/')) {
      return Response.json({ teams: [{ id: 1, name: 'Arsenal' }, { id: 2, name: 'Chelsea' }], events: [{ id: 3, is_next: true }] });
    }
    if (url.endsWith('/fixtures/')) {
      return Response.json([{ id: 99, event: 3, finished: false, kickoff_time: '2026-09-12T14:00:00Z', team_h: 1, team_a: 2 }]);
    }
    return Response.json([{ id: 'arsenal-chelsea', commence_time: '2026-09-12T14:00:00Z', home_team: 'Arsenal', away_team: 'Chelsea', bookmakers: [{ key: 'test', title: 'Test', last_update: '', markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 1.8 }, { name: 'Draw', price: 3.8 }, { name: 'Chelsea', price: 4.5 }] }, { key: 'totals', outcomes: [{ name: 'Over', price: 1.9, point: 2.5 }, { name: 'Under', price: 1.95, point: 2.5 }] }] }] }]);
  };

  try {
    const first = await worker.fetch(new Request('https://example.test/api/fixtures'), env);
    assert.equal(first.status, 200);
    assert.equal((await first.json() as { fixtures: unknown[] }).fixtures.length, 1);
    assert.equal(fetchCount, 3);

    const second = await worker.fetch(new Request('https://example.test/api/fixtures'), env);
    assert.equal(second.status, 200);
    assert.equal(fetchCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('bilinmeyen uygulama yolu Angular SPA fallback dosyasını döndürür', async () => {
  const worker = createWorker({ createCache: () => new Cache() });
  const response = await worker.fetch(new Request('https://example.test/fixture/99'), env);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /app-root/);
});
