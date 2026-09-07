const FPL_API = 'https://fantasy.premierleague.com/api';

export type FplTeam = { id: number; code: number; name: string };
type FplEvent = { id: number; is_next: boolean };
export type FplFixture = { id: number; event: number | null; finished: boolean; kickoff_time: string | null; team_h: number; team_a: number };
export type Bootstrap = { teams: FplTeam[]; events: FplEvent[] };

export type UpcomingFixture = {
  fixtureId: number;
  kickoffUtc: string;
  homeTeam: string;
  homeTeamCode: number;
  awayTeam: string;
  awayTeamCode: number;
  status: 'market-unavailable';
};

async function fetchFpl<T>(path: string): Promise<T> {
  const response = await fetch(`${FPL_API}${path}`);
  if (!response.ok) throw new Error(`FPL API ${response.status} döndürdü.`);
  return response.json() as Promise<T>;
}

export function createUpcomingFixtures(bootstrap: Bootstrap, fixtures: FplFixture[]): UpcomingFixture[] {
  const nextEvent = bootstrap.events.find((event) => event.is_next);
  if (!nextEvent) return [];
  const teams = new Map(bootstrap.teams.map((team) => [team.id, team]));
  return fixtures.filter((fixture) => fixture.event === nextEvent.id && !fixture.finished && fixture.kickoff_time).map((fixture) => ({
    fixtureId: fixture.id,
    kickoffUtc: fixture.kickoff_time!,
    homeTeam: teams.get(fixture.team_h)?.name ?? 'Bilinmeyen takım',
    homeTeamCode: teams.get(fixture.team_h)?.code ?? 0,
    awayTeam: teams.get(fixture.team_a)?.name ?? 'Bilinmeyen takım',
    awayTeamCode: teams.get(fixture.team_a)?.code ?? 0,
    status: 'market-unavailable' as const,
  }));
}

export async function getNextGameweekFixtures(): Promise<UpcomingFixture[]> {
  const [bootstrap, fixtures] = await Promise.all([fetchFpl<Bootstrap>('/bootstrap-static/'), fetchFpl<FplFixture[]>('/fixtures/')]);
  return createUpcomingFixtures(bootstrap, fixtures);
}
