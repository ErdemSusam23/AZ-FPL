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
  FIXTURES_RATE_LIMITER: { limit: async () => ({ success: true }) },
  ODDS_API_KEY: 'test-key',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
};

test('health route, altyapı detayı vermeden cache oluşturmadan hazır yanıtı döndürür', async () => {
  let createCacheCalls = 0;
  const worker = createWorker({
    createCache: () => {
      createCacheCalls += 1;
      return new Cache();
    },
  });
  const response = await worker.fetch(new Request('https://example.test/health'), env);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(createCacheCalls, 0);
  assert.equal(response.headers.get('content-security-policy'), "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('fixtures route, IP bazlı limit aşıldığında kaynaklara erişmeden 429 döndürür', async () => {
  const keys: string[] = [];
  const rateLimitedEnv: Env = {
    ...env,
    FIXTURES_RATE_LIMITER: {
      async limit({ key }) {
        keys.push(key);
        return { success: false };
      },
    },
  };
  const worker = createWorker({ createCache: () => new Cache() });

  const response = await worker.fetch(new Request('https://example.test/api/fixtures', {
    headers: { 'CF-Connecting-IP': '203.0.113.25' },
  }), rateLimitedEnv);

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.' });
  assert.deepEqual(keys, ['fixtures:203.0.113.25']);
});

test('fixtures route nihai cevabı cacheleyerek ikinci istekte kaynak API çağrılarını atlar', async () => {
  const cache = new Cache();
  const worker = createWorker({ createCache: () => cache });
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  const timeoutSignals: Array<AbortSignal | null | undefined> = [];

  globalThis.fetch = async (input, init) => {
    fetchCount += 1;
    timeoutSignals.push(init?.signal);
    const url = String(input);
    if (url.endsWith('/bootstrap-static/')) {
      return Response.json({ teams: [{ id: 1, code: 3, name: 'Arsenal' }, { id: 2, code: 8, name: 'Chelsea' }], events: [{ id: 3, is_next: true }] });
    }
    if (url.endsWith('/fixtures/')) {
      return Response.json([{ id: 99, event: 3, finished: false, kickoff_time: '2026-09-12T14:00:00Z', team_h: 1, team_a: 2 }]);
    }
    return Response.json([{ id: 'arsenal-chelsea', commence_time: '2026-09-12T14:00:00Z', home_team: 'Arsenal', away_team: 'Chelsea', bookmakers: [{ key: 'test', title: 'Test', last_update: '', markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 1.8 }, { name: 'Draw', price: 3.8 }, { name: 'Chelsea', price: 4.5 }] }, { key: 'totals', outcomes: [{ name: 'Over', price: 1.9, point: 2.5 }, { name: 'Under', price: 1.95, point: 2.5 }] }] }] }]);
  };

  try {
    const first = await worker.fetch(new Request('https://example.test/api/fixtures'), env);
    assert.equal(first.status, 200);
    const firstBody = await first.json() as { fixtures: Array<{ homeTeamCode: number; awayTeamCode: number; projection?: { homeWin: number; awayWin: number } }> };
    assert.equal(firstBody.fixtures.length, 1);
    assert.equal(firstBody.fixtures[0].homeTeamCode, 3);
    assert.equal(firstBody.fixtures[0].awayTeamCode, 8);
    assert.ok(firstBody.fixtures[0].projection?.homeWin);
    assert.ok(firstBody.fixtures[0].projection?.awayWin);
    assert.equal(fetchCount, 3);
    assert.equal(timeoutSignals.length, 3);
    assert.ok(timeoutSignals.every((signal) => signal instanceof AbortSignal));

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
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');
});
