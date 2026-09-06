import assert from 'node:assert/strict';
import test from 'node:test';
import { OddsEvent } from './odds.js';
import { selectUsableMarkets } from './market-selection.js';

const event: OddsEvent = {
  id: 'arsenal-chelsea', commence_time: '2026-09-06T15:30:00Z', home_team: 'Arsenal', away_team: 'Chelsea',
  bookmakers: [
    { key: 'complete', title: 'Complete Bookmaker', last_update: '', markets: [
      { key: 'h2h', outcomes: [{ name: 'Arsenal', price: 1.7 }, { name: 'Chelsea', price: 4.6 }, { name: 'Draw', price: 4 }] },
      { key: 'totals', outcomes: [{ name: 'Over', price: 1.73, point: 2.5 }, { name: 'Under', price: 2.02, point: 2.5 }] },
    ] },
    { key: 'wrong-line', title: 'Wrong Line', last_update: '', markets: [
      { key: 'h2h', outcomes: [{ name: 'Arsenal', price: 1.7 }, { name: 'Chelsea', price: 4.6 }, { name: 'Draw', price: 4 }] },
      { key: 'totals', outcomes: [{ name: 'Over', price: 1.8, point: 3.5 }, { name: 'Under', price: 2, point: 3.5 }] },
    ] },
  ],
};

test('yalnızca 1X2 ve 2.5 toplam marketi eksiksiz bookmakerleri seçer', () => {
  assert.deepEqual(selectUsableMarkets(event), [{
    bookmaker: 'Complete Bookmaker', homeWinOdds: 1.7, drawOdds: 4, awayWinOdds: 4.6, over25Odds: 1.73, under25Odds: 2.02,
  }]);
});
