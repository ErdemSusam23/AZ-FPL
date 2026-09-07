import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { Fixture, FixturesService } from './services/fixtures';

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
        this.error.set(message ?? 'API bağlantısı kurulamadı. Worker hizmetini kontrol edin.');
        this.loading.set(false);
      },
    });
  }
}
