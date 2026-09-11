import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Fixture, FixturesService } from './services/fixtures';

type FixtureGroup = { date: string; kickoffUtc: string; fixtures: Fixture[] };

const TURKEY_TIME_ZONE = 'Europe/Istanbul';
const turkeyDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TURKEY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const TEAM_COLORS: Record<number, string> = {
  1: '#da291c', 2: '#ffcd00', 3: '#ef0107', 4: '#241f20', 6: '#132257', 7: '#670e36', 8: '#034694', 9: '#6cabdd', 11: '#003399', 14: '#c8102e', 17: '#e53233', 31: '#1b458f', 36: '#0057b8', 40: '#3a64a3', 43: '#6cabdd', 54: '#111111', 56: '#eb172b', 88: '#f5a000', 91: '#da291c', 94: '#e30613',
};

@Component({
  selector: 'app-root',
  imports: [DatePipe, DecimalPipe, PercentPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly fixtures = signal<Fixture[]>([]);
  protected readonly oddsUpdatedAt = signal<string | null>(null);
  protected readonly projectedCount = computed(() =>
    this.fixtures().filter((fixture) => fixture.status === 'projected').length,
  );
  protected readonly unavailableCount = computed(() => this.fixtures().length - this.projectedCount());
  protected readonly maxCleanSheet = computed(() => {
    const cleanSheetValues = this.fixtures().flatMap(({ projection }) =>
      projection ? [projection.homeCleanSheet, projection.awayCleanSheet] : [],
    );

    return Math.max(...cleanSheetValues, 0);
  });
  protected readonly fixtureGroups = computed<FixtureGroup[]>(() => {
    const groups = new Map<string, Fixture[]>();
    for (const fixture of this.fixtures()) {
      const date = turkeyDateFormatter.format(new Date(fixture.kickoffUtc));
      groups.set(date, [...(groups.get(date) ?? []), fixture]);
    }
    return [...groups.entries()].map(([date, fixtures]) => ({ date, kickoffUtc: fixtures[0].kickoffUtc, fixtures }));
  });

  protected badgeUrl(teamCode: number): string {
    return `/badges/${teamCode}.webp?v=2`;
  }

  protected teamColor(teamCode: number): string {
    return TEAM_COLORS[teamCode] ?? '#5d2db5';
  }

  protected cleanSheetIntensity(cleanSheet: number): number {
    const intensity = this.maxCleanSheet() > 0 ? cleanSheet / this.maxCleanSheet() : 0;

    return Math.min(Math.max(intensity, 0), 1);
  }

  protected hideBadge(event: Event): void {
    (event.currentTarget as HTMLImageElement).hidden = true;
  }

  constructor(private readonly fixturesService: FixturesService) {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fixturesService.getFixtures().subscribe({
      next: ({ fixtures, oddsUpdatedAt }) => {
        this.fixtures.set(fixtures);
        this.oddsUpdatedAt.set(oddsUpdatedAt);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        const message = typeof error === 'object' && error !== null && 'error' in error
          ? (error as { error?: { error?: string } }).error?.error : undefined;
        this.error.set(message ?? 'Veri bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.');
        this.loading.set(false);
      },
    });
  }
}
