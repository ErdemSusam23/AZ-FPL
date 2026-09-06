import { MarketSnapshot } from './market-selection.js';

export type MarketProbabilities = {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
};

function impliedProbability(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error(`Geçersiz decimal oran: ${decimalOdds}`);
  }
  return 1 / decimalOdds;
}

function devig(decimalOdds: number[]): number[] {
  const implied = decimalOdds.map(impliedProbability);
  const total = implied.reduce((sum, probability) => sum + probability, 0);
  return implied.map((probability) => probability / total);
}

function median(values: number[]): number {
  if (values.length === 0) throw new Error('Medyan için en az bir değer gerekir.');
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function normalizeProbabilities(probabilities: number[]): number[] {
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  return probabilities.map((probability) => probability / total);
}

function probabilitiesFromSnapshot(snapshot: MarketSnapshot): MarketProbabilities {
  const [homeWin, draw, awayWin] = devig([snapshot.homeWinOdds, snapshot.drawOdds, snapshot.awayWinOdds]);
  const [over25, under25] = devig([snapshot.over25Odds, snapshot.under25Odds]);
  return { homeWin, draw, awayWin, over25, under25 };
}

export function aggregateMarketProbabilities(snapshots: MarketSnapshot[]): MarketProbabilities | null {
  if (snapshots.length === 0) return null;
  const probabilities = snapshots.map(probabilitiesFromSnapshot);
  const [homeWin, draw, awayWin] = normalizeProbabilities([
    median(probabilities.map((item) => item.homeWin)),
    median(probabilities.map((item) => item.draw)),
    median(probabilities.map((item) => item.awayWin)),
  ]);
  const [over25, under25] = normalizeProbabilities([
    median(probabilities.map((item) => item.over25)),
    median(probabilities.map((item) => item.under25)),
  ]);
  return { homeWin, draw, awayWin, over25, under25 };
}
