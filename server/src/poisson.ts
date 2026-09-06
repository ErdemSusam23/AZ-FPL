import { MarketProbabilities } from './probabilities.js';

const MIN_LAMBDA = 0.05;
const MAX_LAMBDA = 6;
const MAX_GOALS = 10;

export type ScoreProbability = { homeGoals: number; awayGoals: number; probability: number };
export type PoissonProjection = {
  lambdaHome: number;
  lambdaAway: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  homeCleanSheet: number;
  awayCleanSheet: number;
  topScores: ScoreProbability[];
};

function goalProbabilities(lambda: number): number[] {
  const probabilities = [Math.exp(-lambda)];
  for (let goals = 1; goals <= MAX_GOALS; goals += 1) {
    probabilities.push(probabilities[goals - 1] * lambda / goals);
  }
  return probabilities;
}

export function projectFromLambdas(lambdaHome: number, lambdaAway: number): PoissonProjection {
  const homeGoals = goalProbabilities(lambdaHome);
  const awayGoals = goalProbabilities(lambdaAway);
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  const scores: ScoreProbability[] = [];

  for (let home = 0; home <= MAX_GOALS; home += 1) {
    for (let away = 0; away <= MAX_GOALS; away += 1) {
      const probability = homeGoals[home] * awayGoals[away];
      if (home > away) homeWin += probability;
      else if (home === away) draw += probability;
      else awayWin += probability;
      if (home + away >= 3) over25 += probability;
      if (home <= 6 && away <= 6) scores.push({ homeGoals: home, awayGoals: away, probability });
    }
  }

  const outcomeTotal = homeWin + draw + awayWin;
  const totalGoalsTotal = over25 + (outcomeTotal - over25);
  const normalizedScores = scores.map((score) => score);
  return {
    lambdaHome,
    lambdaAway,
    homeWin: homeWin / outcomeTotal,
    draw: draw / outcomeTotal,
    awayWin: awayWin / outcomeTotal,
    over25: over25 / totalGoalsTotal,
    under25: (outcomeTotal - over25) / totalGoalsTotal,
    homeCleanSheet: Math.exp(-lambdaAway),
    awayCleanSheet: Math.exp(-lambdaHome),
    topScores: normalizedScores.sort((first, second) => second.probability - first.probability).slice(0, 3),
  };
}

function loss(projection: PoissonProjection, target: MarketProbabilities): number {
  return (
    (projection.homeWin - target.homeWin) ** 2 +
    (projection.draw - target.draw) ** 2 +
    (projection.awayWin - target.awayWin) ** 2 +
    (projection.over25 - target.over25) ** 2
  );
}

export function fitPoisson(target: MarketProbabilities): PoissonProjection {
  let bestHome = 1.4;
  let bestAway = 1.1;
  let bestLoss = Number.POSITIVE_INFINITY;

  for (let home = 0.2; home <= 4.8; home += 0.2) {
    for (let away = 0.2; away <= 4.8; away += 0.2) {
      const candidateLoss = loss(projectFromLambdas(home, away), target);
      if (candidateLoss < bestLoss) {
        bestHome = home;
        bestAway = away;
        bestLoss = candidateLoss;
      }
    }
  }

  let step = 0.1;
  while (step >= 0.001) {
    let improved = true;
    while (improved) {
      improved = false;
      for (const [homeDelta, awayDelta] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
        const home = Math.min(MAX_LAMBDA, Math.max(MIN_LAMBDA, bestHome + homeDelta));
        const away = Math.min(MAX_LAMBDA, Math.max(MIN_LAMBDA, bestAway + awayDelta));
        const candidateLoss = loss(projectFromLambdas(home, away), target);
        if (candidateLoss < bestLoss) {
          bestHome = home;
          bestAway = away;
          bestLoss = candidateLoss;
          improved = true;
        }
      }
    }
    step /= 2;
  }

  return projectFromLambdas(bestHome, bestAway);
}
