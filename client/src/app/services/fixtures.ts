import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type ScoreProbability = { homeGoals: number; awayGoals: number; probability: number };
export type Projection = {
  lambdaHome: number;
  lambdaAway: number;
  homeWin: number;
  awayWin: number;
  homeCleanSheet: number;
  awayCleanSheet: number;
  topScores: ScoreProbability[];
};
export type Fixture = {
  fixtureId: number;
  kickoffUtc: string;
  homeTeam: string;
  homeTeamCode: number;
  awayTeam: string;
  awayTeamCode: number;
  status: 'projected' | 'market-unavailable' | 'match-unavailable';
  projection?: Projection;
};
export type FixturesResponse = { fixtures: Fixture[]; oddsUpdatedAt: string };

@Injectable({ providedIn: 'root' })
export class FixturesService {
  private readonly http = inject(HttpClient);

  getFixtures(): Observable<FixturesResponse> {
    return this.http.get<FixturesResponse>('/api/fixtures');
  }
}
