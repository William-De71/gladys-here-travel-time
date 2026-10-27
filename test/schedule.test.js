// Days, hours and the monthly plan of the trips.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHours, formatHours, isActive, plannedPerMonth, planOf } from '../src/schedule.js';
import { WORK, SCHOOL, RIDE, trip } from './helpers/fixtures.js';

const PARIS = 'Europe/Paris';
// Monday 19 October 2026, local time of Paris (UTC+2).
const at = (local) => new Date(`2026-10-${local}+02:00`);

test('hours: ranges, minutes, defaults, and what is refused', () => {
  assert.deepEqual(parseHours('6-10, 16:30-20'), [
    [360, 600],
    [990, 1200],
  ]);
  assert.deepEqual(parseHours('7h30 à 9'), [[450, 540]]);
  assert.deepEqual(parseHours(''), [[360, 1260]], 'default 6-21');
  assert.deepEqual(parseHours('0-24'), [[0, 1440]]);
  assert.deepEqual(parseHours('22-2'), [[1320, 120]]);
  for (const bad of ['6', '6-6', '25-3', '7:75-9', 'morning', '1-2,3-4,5-6,7-8,9-10', '24-2']) {
    assert.equal(parseHours(bad), null, bad);
  }
  assert.equal(formatHours(parseHours('6-10, 16:30-20')), '6-10, 16:30-20');
});

test('a trip is read on its days, within its hours, in the timezone of Gladys', () => {
  assert.equal(isActive(WORK, at('19T05:59:00'), PARIS), false);
  assert.equal(isActive(WORK, at('19T06:00:00'), PARIS), true);
  assert.equal(isActive(WORK, at('19T20:59:00'), PARIS), true);
  assert.equal(isActive(WORK, at('19T21:00:00'), PARIS), false);
  assert.equal(isActive(WORK, at('18T08:00:00'), PARIS), false, 'Sunday');
  assert.equal(isActive(RIDE, at('18T08:00:00'), PARIS), true, 'weekend');
  assert.equal(isActive(SCHOOL, at('19T12:00:00'), PARIS), false, 'between the two ranges');
  assert.equal(isActive(WORK, new Date('2026-10-19T06:30:00Z'), 'UTC'), true);
});

test('hours across midnight belong to the day they start', () => {
  const night = trip({ id: 'd4e5f6a7', hours: [[1320, 120]], days: 'weekdays' });
  assert.equal(isActive(night, at('19T23:00:00'), PARIS), true, 'Monday evening');
  assert.equal(isActive(night, at('20T01:00:00'), PARIS), true, 'Monday night');
  assert.equal(isActive(night, at('19T01:00:00'), PARIS), false, 'Sunday night');
});

test('a car trip without live traffic is planned in the routing SKU', () => {
  const { planned } = planOf([{ ...WORK, traffic: false }], {
    defaultInterval: 15,
    budget: () => 27000,
  });
  assert.deepEqual(planned, { routing: 1300 });
});

test('the default plan: about 1,300 requests a month for a weekday car trip', () => {
  assert.equal(plannedPerMonth(WORK, 15), 1300);
  assert.equal(plannedPerMonth(SCHOOL, 15), 347);
});

test('trips of a SKU over its budget are stretched, never the others', () => {
  const budget = (sku) => ({ time_aware: 4500, routing: 27000, scooter: 4500 })[sku];
  const cars = ['a', 'b', 'c', 'd'].map((c) => ({ ...WORK, id: `${c}0000000` }));
  const { intervals, planned, effective, stretched } = planOf([...cars, SCHOOL], {
    defaultInterval: 15,
    budget,
  });
  assert.equal(planned.time_aware, 5200);
  assert.ok(stretched.time_aware > 1);
  assert.equal(stretched.routing, 1);
  assert.ok(effective.time_aware <= 4500 * 0.9 + 50, `${effective.time_aware}`);
  assert.equal(intervals.get('a0000000'), 20);
  assert.equal(intervals.get(SCHOOL.id), 15);
});
