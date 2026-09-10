import { Cache } from './cache.js';

const ODDS_API = 'https://api.the-odds-api.com/v4';
const ODDS_CACHE_KEY = 'odds:epl:upcoming';
const ODDS_REQUEST_TIMEOUT_MS = 8_000;

export type OddsOutcome = { name: string; price: number; point?: number };
export type OddsMarket = { key: 'h2h' | 'totals' | string; outcomes: OddsOutcome[] };
export type OddsBookmaker = { key: string; title: string; last_update: string; markets: OddsMarket[] };
export type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
};

export type EplOdds = { events: OddsEvent[]; requestsRemaining: number | null; fetchedAt: string };

function oddsTtlSeconds(events: OddsEvent[]): number {
  const now = Date.now();
  const nearestFutureKickoff = events
    .map((event) => new Date(event.commence_time).getTime() - now)
    .filter((milliseconds) => milliseconds > 0)
    .sort((first, second) => first - second)[0];

  if (!nearestFutureKickoff) return 4 * 60 * 60;
  const hours = nearestFutureKickoff / (60 * 60 * 1000);
  if (hours > 24) return 12 * 60 * 60;
  if (hours > 6) return 4 * 60 * 60;
  return 60 * 60;
}

async function fetchEplOdds(apiKey: string): Promise<{ value: EplOdds; ttlSeconds: number }> {
  const url = new URL(`${ODDS_API}/sports/soccer_epl/odds/`);
  url.search = new URLSearchParams({ apiKey, regions: 'uk', markets: 'h2h,totals', oddsFormat: 'decimal' }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(ODDS_REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Odds API ${response.status} döndürdü.`);

  const events = await response.json() as OddsEvent[];
  return {
    value: {
      events,
      requestsRemaining: Number(response.headers.get('x-requests-remaining')) || null,
      fetchedAt: new Date().toISOString(),
    },
    ttlSeconds: oddsTtlSeconds(events),
  };
}

export function getEplOdds(cache: Cache, apiKey: string): Promise<EplOdds> {
  if (!apiKey) throw new Error('ODDS_API_KEY yapılandırılmamış.');
  return cache.getOrSetDynamic(ODDS_CACHE_KEY, () => fetchEplOdds(apiKey));
}
