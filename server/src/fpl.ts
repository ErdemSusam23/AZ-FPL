const FPL_API = 'https://fantasy.premierleague.com/api';

type FplTeam = { id: number; name: string };
type FplEvent = { id: number; is_next: boolean };
type FplFixture = { id: number; event: number | null; finished: boolean; kickoff_time: string | null; team_h: number; team_a: number };
type Bootstrap = { teams: FplTeam[]; events: FplEvent[] };

export type UpcomingFixture = { fixtureId: number; kickoffUtc: string; homeTeam: string; awayTeam: string; status: 'market-unavailable' };

async function fetchFpl<T>(path: string): Promise<T> {
  const response = await fetch(`${FPL_API}${path}`);
  if (!response.ok) throw new Error(`FPL API ${response.status} döndürdü.`);
  return response.json() as Promise<T>;
}

export async function getNextGameweekFixtures(): Promise<UpcomingFixture[]> {
  const [bootstrap, fixtures] = await Promise.all([fetchFpl<Bootstrap>('/bootstrap-static/'), fetchFpl<FplFixture[]>('/fixtures/')]);
  const nextEvent = bootstrap.events.find((event) => event.is_next);
  if (!nextEvent) return [];
  const teams = new Map(bootstrap.teams.map((team) => [team.id, team.name]));
  return fixtures.filter((fixture) => fixture.event === nextEvent.id && !fixture.finished && fixture.kickoff_time).map((fixture) => ({
    fixtureId: fixture.id, kickoffUtc: fixture.kickoff_time!, homeTeam: teams.get(fixture.team_h) ?? 'Bilinmeyen takım', awayTeam: teams.get(fixture.team_a) ?? 'Bilinmeyen takım', status: 'market-unavailable' as const,
  }));
}
