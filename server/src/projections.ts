import { UpcomingFixture } from './fpl.js';
import { OddsEvent } from './odds.js';
import { selectUsableMarkets } from './market-selection.js';
import { fitPoisson, PoissonProjection } from './poisson.js';
import { aggregateMarketProbabilities } from './probabilities.js';
import { teamsMatch } from './team-matching.js';

export type FixtureProjection = Omit<UpcomingFixture, 'status'> & {
  status: 'projected' | 'market-unavailable' | 'match-unavailable';
  projection?: PoissonProjection;
};

const maxKickoffDifference = 6 * 60 * 60 * 1000;

function matchingOddsEvent(fixture: UpcomingFixture, events: OddsEvent[]): OddsEvent | undefined {
  return events.find((event) =>
    teamsMatch(event.home_team, fixture.homeTeam) &&
    teamsMatch(event.away_team, fixture.awayTeam) &&
    Math.abs(new Date(event.commence_time).getTime() - new Date(fixture.kickoffUtc).getTime()) <= maxKickoffDifference,
  );
}

export function createFixtureProjections(fixtures: UpcomingFixture[], events: OddsEvent[]): FixtureProjection[] {
  return fixtures.map((fixture) => {
    const event = matchingOddsEvent(fixture, events);
    if (!event) return { ...fixture, status: 'match-unavailable' };

    const probabilities = aggregateMarketProbabilities(selectUsableMarkets(event));
    if (!probabilities) return { ...fixture, status: 'market-unavailable' };

    return { ...fixture, status: 'projected', projection: fitPoisson(probabilities) };
  });
}
