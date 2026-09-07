import { Cache } from './cache.js';
import { getNextGameweekFixtures } from './fpl.js';
import { getEplOdds } from './odds.js';
import { createFixtureProjections } from './projections.js';

export interface Env {
  ASSETS: Fetcher;
  ODDS_API_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

type FixturesResponse = {
  fixtures: ReturnType<typeof createFixtureProjections>;
  oddsUpdatedAt: string;
};

const fixtureResponseCacheKey = 'fixtures:response:next:v2';
const fixtureResponseTtlSeconds = 60 * 60;

function createCache(env: Env): Cache {
  return new Cache({
    redisUrl: env.UPSTASH_REDIS_REST_URL,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

async function getFixturesResponse(cache: Cache, env: Env): Promise<FixturesResponse> {
  return cache.getOrSet(fixtureResponseCacheKey, fixtureResponseTtlSeconds, async () => {
    const fixtures = await cache.getOrSet(
      'fpl:fixtures:next:v2',
      6 * 60 * 60,
      getNextGameweekFixtures,
    );
    const odds = await getEplOdds(cache, env.ODDS_API_KEY);
    return {
      fixtures: createFixtureProjections(fixtures, odds.events),
      oddsUpdatedAt: odds.fetchedAt,
    };
  });
}

export type WorkerDependencies = {
  createCache: (env: Env) => Cache;
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

export function createWorker(dependencies: WorkerDependencies = { createCache }) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      const cache = dependencies.createCache(env);

      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ status: 'ok', cache: await cache.connectionStatus() });
      }

      if (request.method === 'GET' && url.pathname === '/api/fixtures') {
        try {
          return json(await getFixturesResponse(cache, env));
        } catch (error) {
          console.error(error);
          return json({ error: 'FPL fikstür verisi alınamadı.' }, 502);
        }
      }

      if (url.pathname.startsWith('/api/')) return json({ error: 'Bulunamadı.' }, 404);

      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404 || request.method !== 'GET') return assetResponse;

      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    },
  };
}

export default createWorker();
