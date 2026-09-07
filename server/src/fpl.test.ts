import assert from 'node:assert/strict';
import test from 'node:test';
import { createUpcomingFixtures } from './fpl.js';

test('yaklaşan fikstür takım adlarıyla birlikte FPL takım kodlarını taşır', () => {
  const fixtures = createUpcomingFixtures(
    {
      teams: [{ id: 1, code: 3, name: 'Arsenal' }, { id: 2, code: 8, name: 'Chelsea' }],
      events: [{ id: 4, is_next: true }],
    },
    [{ id: 99, event: 4, finished: false, kickoff_time: '2026-09-12T14:00:00Z', team_h: 1, team_a: 2 }],
  );

  assert.deepEqual(fixtures, [{
    fixtureId: 99,
    kickoffUtc: '2026-09-12T14:00:00Z',
    homeTeam: 'Arsenal',
    homeTeamCode: 3,
    awayTeam: 'Chelsea',
    awayTeamCode: 8,
    status: 'market-unavailable',
  }]);
});
