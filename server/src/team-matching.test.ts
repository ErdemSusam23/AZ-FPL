import assert from 'node:assert/strict';
import test from 'node:test';
import { teamsMatch } from './team-matching.js';

test('FPL kısaltmalarını gerçek Odds API takım adlarıyla eşleştirir', () => {
  assert.equal(teamsMatch("Nott'm Forest", 'Nottingham Forest'), true);
  assert.equal(teamsMatch('Spurs', 'Tottenham Hotspur'), true);
  assert.equal(teamsMatch('Brighton', 'Brighton and Hove Albion'), true);
  assert.equal(teamsMatch('Man Utd', 'Manchester United'), true);
  assert.equal(teamsMatch('Man City', 'Manchester City'), true);
  assert.equal(teamsMatch('Leeds', 'Leeds United'), true);
  assert.equal(teamsMatch('Newcastle', 'Newcastle United'), true);
});

test('farklı takımları eşleştirmez', () => {
  assert.equal(teamsMatch('Arsenal', 'Chelsea'), false);
});
