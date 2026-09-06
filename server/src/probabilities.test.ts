import assert from 'node:assert/strict';
import test from 'node:test';
import { MarketSnapshot } from './market-selection.js';
import { aggregateMarketProbabilities } from './probabilities.js';

const balancedSnapshot: MarketSnapshot = {
  bookmaker: 'A', homeWinOdds: 2, drawOdds: 4, awayWinOdds: 4, over25Odds: 2, under25Odds: 2,
};

test('1X2 ve toplam gol piyasalarındaki bookmaker marjını normalize eder', () => {
  const result = aggregateMarketProbabilities([balancedSnapshot]);
  assert.ok(result);
  assert.equal(result.homeWin, 0.5);
  assert.equal(result.draw, 0.25);
  assert.equal(result.awayWin, 0.25);
  assert.equal(result.over25, 0.5);
  assert.equal(result.under25, 0.5);
});

test('birden çok bookmaker için medyan olasılığı kullanır', () => {
  const result = aggregateMarketProbabilities([
    balancedSnapshot,
    { ...balancedSnapshot, bookmaker: 'B', homeWinOdds: 1.5, drawOdds: 6, awayWinOdds: 6, over25Odds: 1.5, under25Odds: 3 },
    { ...balancedSnapshot, bookmaker: 'Outlier', homeWinOdds: 10, drawOdds: 1.2, awayWinOdds: 10, over25Odds: 10, under25Odds: 1.1 },
  ]);
  assert.ok(result);
  assert.ok(result.homeWin > 0.5 && result.homeWin < 0.6);
  assert.equal(result.over25, 0.5);
});

test('medyanlardan sonra her piyasa toplamını 1 olacak biçimde normalize eder', () => {
  const result = aggregateMarketProbabilities([
    balancedSnapshot,
    { ...balancedSnapshot, bookmaker: 'B', homeWinOdds: 1.8, drawOdds: 4.3, awayWinOdds: 4.7 },
  ]);
  assert.ok(result);
  assert.ok(Math.abs(result.homeWin + result.draw + result.awayWin - 1) < 1e-12);
  assert.ok(Math.abs(result.over25 + result.under25 - 1) < 1e-12);
});

test('market yoksa null döndürür', () => {
  assert.equal(aggregateMarketProbabilities([]), null);
});
