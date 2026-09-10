import { Cache } from './cache.js';
import { getNextGameweekFixtures } from './fpl.js';
import { getEplOdds } from './odds.js';
import { createFixtureProjections } from './projections.js';

export interface Env {
  ASSETS: Fetcher;
  FIXTURES_RATE_LIMITER: RateLimit;
  ODDS_API_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
}

type FixturesResponse = {
  fixtures: ReturnType<typeof createFixtureProjections>;
  oddsUpdatedAt: string;
};

const fixtureResponseCacheKey = 'fixtures:response:next:v3';
const fixtureResponseTtlSeconds = 60 * 60;
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
} as const;

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

function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  applySecurityHeaders(responseHeaders);
  return Response.json(value, { status, headers: responseHeaders });
}

function applySecurityHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function rateLimitFixtures(request: Request, env: Env): Promise<boolean> {
  const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.FIXTURES_RATE_LIMITER.limit({ key: `fixtures:${clientIp}` });
  return success;
}

export function createWorker(dependencies: WorkerDependencies = { createCache }) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);

      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ status: 'ok' });
      }

      if (request.method === 'GET' && url.pathname === '/api/fixtures') {
        if (!await rateLimitFixtures(request, env)) {
          return json(
            { error: 'Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.' },
            429,
            { 'Cache-Control': 'no-store', 'Retry-After': '60' },
          );
        }

        try {
          const cache = dependencies.createCache(env);
          return json(await getFixturesResponse(cache, env));
        } catch (error) {
          console.error(error);
          return json({ error: 'FPL fikstür verisi alınamadı.' }, 502);
        }
      }

      if (url.pathname.startsWith('/api/')) return json({ error: 'Bulunamadı.' }, 404);

      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404 || request.method !== 'GET') return withSecurityHeaders(assetResponse);

      return withSecurityHeaders(await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request)));
    },
  };
}

export default createWorker();
