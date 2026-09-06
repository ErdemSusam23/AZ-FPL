import { OddsBookmaker, OddsEvent, OddsMarket } from './odds.js';
import { teamsMatch } from './team-matching.js';

export type MarketSnapshot = {
  bookmaker: string;
  homeWinOdds: number;
  drawOdds: number;
  awayWinOdds: number;
  over25Odds: number;
  under25Odds: number;
};

function outcomePrice(market: OddsMarket, name: string, point?: number): number | null {
  const outcome = market.outcomes.find((item) =>
    item.name === name && (point === undefined || item.point === point) && Number.isFinite(item.price) && item.price > 1,
  );
  return outcome?.price ?? null;
}

function snapshotFromBookmaker(event: OddsEvent, bookmaker: OddsBookmaker): MarketSnapshot | null {
  const h2h = bookmaker.markets.find((market) => market.key === 'h2h');
  const totals = bookmaker.markets.find((market) => market.key === 'totals');
  if (!h2h || !totals) return null;

  const homeWinOdds = h2h.outcomes.find((outcome) => teamsMatch(outcome.name, event.home_team))?.price ?? null;
  const awayWinOdds = h2h.outcomes.find((outcome) => teamsMatch(outcome.name, event.away_team))?.price ?? null;
  const drawOdds = outcomePrice(h2h, 'Draw');
  const over25Odds = outcomePrice(totals, 'Over', 2.5);
  const under25Odds = outcomePrice(totals, 'Under', 2.5);

  if (
    homeWinOdds === null || drawOdds === null || awayWinOdds === null || over25Odds === null || under25Odds === null ||
    ![homeWinOdds, drawOdds, awayWinOdds, over25Odds, under25Odds].every((price) => Number.isFinite(price) && price > 1)
  ) {
    return null;
  }

  return { bookmaker: bookmaker.title, homeWinOdds, drawOdds, awayWinOdds, over25Odds, under25Odds };
}

export function selectUsableMarkets(event: OddsEvent): MarketSnapshot[] {
  return event.bookmakers
    .map((bookmaker) => snapshotFromBookmaker(event, bookmaker))
    .filter((snapshot): snapshot is MarketSnapshot => snapshot !== null);
}
