// The monthly counter of billable requests, per SKU, kept across restarts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync, writeFileSync } from 'node:fs';
import { createUsage, budgetOf } from '../src/usage.js';
import { dataPaths, silent } from './helpers/fixtures.js';

test('budgets: a share of the free usage of each SKU', () => {
  assert.deepEqual(
    ['time_aware', 'routing', 'truck', 'scooter', 'transit', 'geocode'].map((sku) =>
      budgetOf(sku, 90),
    ),
    [4500, 27000, 4500, 4500, 4500, 27000],
  );
  assert.equal(budgetOf('time_aware', 200), 10000);
  assert.equal(budgetOf('truck', 0.01), 1);
});

test('counts per SKU, survives a restart, starts again each month', () => {
  const { usage: path } = dataPaths();
  let time = Date.parse('2026-10-31T23:00:00Z');
  const make = () => createUsage({ path, getPercent: () => 90, now: () => time, logger: silent });
  const first = make();
  first.record('time_aware');
  first.record('time_aware');
  first.record('routing');
  assert.equal(statSync(path).mode & 0o777, 0o600, 'readable by the integration only');
  const again = make();
  assert.deepEqual(
    [again.used('time_aware'), again.used('routing'), again.used('transit')],
    [2, 1, 0],
  );
  assert.equal(again.remaining('time_aware'), 4498);
  assert.equal(again.exhausted('time_aware'), false);
  time = Date.parse('2026-11-01T00:00:01Z');
  assert.equal(again.used('time_aware'), 0);
  assert.equal(again.month(), '2026-11');
});

test('an unreadable file starts from zero', () => {
  const { usage: path } = dataPaths();
  writeFileSync(path, '{ nope');
  const usage = createUsage({ path, getPercent: () => 90, logger: silent });
  assert.equal(usage.used('time_aware'), 0);
});
