import assert from 'node:assert/strict';
import test from 'node:test';
import { fitPoisson, projectFromLambdas } from './poisson.js';

test('bilinen lambda değerlerinden üretilen piyasayı geri fit eder', () => {
  const source = projectFromLambdas(1.7, 0.8);
  const fitted = fitPoisson({
    homeWin: source.homeWin, draw: source.draw, awayWin: source.awayWin, over25: source.over25, under25: source.under25,
  });
  assert.ok(Math.abs(fitted.lambdaHome - 1.7) < 0.05);
  assert.ok(Math.abs(fitted.lambdaAway - 0.8) < 0.05);
});

test('clean sheet rakibin sıfır gol olasılığıdır', () => {
  const projection = projectFromLambdas(1.2, 0.7);
  assert.ok(Math.abs(projection.homeCleanSheet - Math.exp(-0.7)) < 1e-12);
  assert.ok(Math.abs(projection.awayCleanSheet - Math.exp(-1.2)) < 1e-12);
});

test('sonuç ve toplam gol olasılıkları 1 toplamına normalize edilir', () => {
  const projection = projectFromLambdas(2.1, 1.4);
  assert.ok(Math.abs(projection.homeWin + projection.draw + projection.awayWin - 1) < 1e-12);
  assert.ok(Math.abs(projection.over25 + projection.under25 - 1) < 1e-12);
});
