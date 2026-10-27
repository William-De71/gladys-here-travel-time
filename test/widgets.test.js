// Every widget content through validateWidgetContent (the checks of the core,
// which only run in debug mode in production) and the content budget of a
// card, in the four languages and in the edge cases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  buildTripsWidget,
  buildTripWidget,
  buildBudgetWidget,
  colorOf,
  mapsUrl,
  distanceOf,
} from '../src/widgets.js';
import { createUsage } from '../src/usage.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  TRIPS,
  WORK,
  SCHOOL,
  RIDE,
  OFFICE,
  READING,
  TRANSIT_READING,
  silent,
} from './helpers/fixtures.js';

const NOW = Date.parse('2026-10-19T07:30:00Z');
const types = (content) => content.components.map((component) => component.type);

/**
 * @description Assert a content is valid and within the budget of a card.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  assert.deepEqual(validateWidgetContent(content), [], label);
  const count = (list) => types(content).filter((type) => list.includes(type)).length;
  assert.ok(content.components.length <= 8, label);
  assert.ok(count(['value', 'gauge']) <= 6, label);
  assert.ok(count(['chart', 'card-list', 'image']) <= 1, label);
  assert.ok(count(['text']) <= 2, label);
  assert.ok(count(['status']) <= 1, label);
  assert.ok(count(['button']) <= 4, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
  for (const component of content.components) {
    if (component.type === 'status') {
      component.items.forEach((item) => assert.ok(item.value, `${label}: status without value`));
    }
  }
}

const state = (minutesAgo, reading = READING, error = null) => ({
  at: NOW - minutesAgo * 60000,
  attempt: NOW - minutesAgo * 60000,
  reading,
  error,
});
const shown = (trips) =>
  trips.map((trip, i) => ({
    trip,
    state: i === 2 ? null : state(i * 5),
    threshold: 10,
    active: i !== 1,
    points:
      i === 0 ? { from: { lat: 45.767, lng: 4.8357 }, to: { lat: 45.7606, lng: 4.8594 } } : null,
  }));

test('trips widget: valid in every language and unit system, with links and badges', () => {
  for (const language of LANGUAGES) {
    for (const units of ['metric', 'imperial']) {
      const content = buildTripsWidget({
        trips: shown(TRIPS),
        hasKey: true,
        language,
        units,
        now: NOW,
      });
      assertValid(content, `${language} ${units}`);
      assert.deepEqual(types(content), ['text', 'card-list', 'button']);
      const [work, school, ride] = content.components[1].items;
      assert.equal(work.badge.color, 'warning', '+7 min');
      assert.equal(school.badge.color, 'info', 'no traffic for a bicycle');
      assert.equal(ride.badge.color, 'neutral', 'no reading yet');
      assert.equal(work.links[0].url, 'https://share.here.com/r/45.767,4.8357/45.7606,4.8594');
      assert.equal(work.links[0].label, 'HERE WeGo');
      assert.equal(school.links, undefined, 'no link while a place is not geocoded');
      assert.match(work.subtitle, units === 'imperial' ? / mi · / : / km · /);
    }
  }
  const [button] = buildTripsWidget({
    trips: shown(TRIPS),
    hasKey: true,
    language: 'en',
    now: NOW,
  }).components.filter((c) => c.type === 'button');
  assert.deepEqual(button.action, {
    key: 'refresh_all',
    params: { trips: TRIPS.map((trip) => trip.id) },
  });
});

test('trips widget: public transport rows show the first departure or the delay', () => {
  const late = buildTripsWidget({
    trips: [{ trip: OFFICE, state: state(1, TRANSIT_READING), threshold: 10, active: true }],
    hasKey: true,
    language: 'fr',
    now: NOW,
  });
  assertValid(late, 'transit late');
  const [row] = late.components[1].items;
  assert.deepEqual(row.badge, { text: '+3 min', color: 'warning' });
  assert.match(row.subtitle, /^45 min · 14,2 km · par RER A → Bus 144/);
  assert.match(row.description, /Premier départ 07:41, arrivée 08:15, 1 correspondance/);
  const onTime = buildTripsWidget({
    trips: [
      {
        trip: OFFICE,
        state: state(1, { ...TRANSIT_READING, transitDelay: 0 }),
        threshold: 10,
        active: true,
      },
    ],
    hasKey: true,
    language: 'en',
    now: NOW,
  });
  assert.deepEqual(onTime.components[1].items[0].badge, { text: 'At 07:41', color: 'info' });
});

test('trips widget: no key, no trip, more trips than a list shows', () => {
  for (const language of LANGUAGES) {
    assertValid(buildTripsWidget({ trips: [], hasKey: false, language, now: NOW }), language);
    assertValid(buildTripsWidget({ trips: [], hasKey: true, language, now: NOW }), language);
  }
  const many = Array.from({ length: 12 }, (_, i) => ({ ...WORK, id: `0000000${i}`.slice(-8) }));
  const content = buildTripsWidget({ trips: shown(many), hasKey: true, language: 'fr', now: NOW });
  assertValid(content, 'many');
  assert.equal(content.components[1].items.length, 8);
});

test('trip widget: car (4 tiles), bicycle (2 tiles), no reading, error, unknown trip', () => {
  for (const language of LANGUAGES) {
    const car = buildTripWidget({
      trip: WORK,
      state: state(3),
      threshold: 10,
      hasKey: true,
      language,
      now: NOW,
    });
    assertValid(car, `${language} car`);
    assert.equal(types(car).filter((t) => t === 'value').length, 4);
    const bike = buildTripWidget({
      trip: SCHOOL,
      state: state(3),
      threshold: 10,
      hasKey: true,
      language,
      now: NOW,
    });
    assertValid(bike, `${language} bike`);
    assert.equal(types(bike).filter((t) => t === 'value').length, 2);
    const transit = buildTripWidget({
      trip: OFFICE,
      state: state(3, TRANSIT_READING),
      threshold: 10,
      hasKey: true,
      language,
      now: NOW,
    });
    assertValid(transit, `${language} transit`);
    const status = transit.components.find((c) => c.type === 'status');
    assert.match(status.items[1].value, /^07:41 → 08:15, 1 /);
    const none = buildTripWidget({
      trip: RIDE,
      state: null,
      threshold: 10,
      hasKey: true,
      language,
      now: NOW,
    });
    assertValid(none, `${language} none`);
    const failed = buildTripWidget({
      trip: WORK,
      state: state(90, READING, {
        message: 'Routing API unreachable: ETIMEDOUT and a long text',
        at: NOW,
      }),
      threshold: 10,
      hasKey: true,
      language,
      now: NOW,
    });
    assertValid(failed, `${language} failed`);
    assertValid(
      buildTripWidget({
        trip: null,
        state: null,
        threshold: 10,
        chosen: false,
        hasKey: true,
        language,
        now: NOW,
      }),
      language,
    );
    assertValid(
      buildTripWidget({
        trip: null,
        state: null,
        threshold: 10,
        hasKey: false,
        language,
        now: NOW,
      }),
      language,
    );
  }
});

test('budget widget: one gauge per SKU in use, the state of the key', () => {
  const usage = createUsage({ path: null, getPercent: () => 90, logger: silent });
  for (let i = 0; i < 3700; i += 1) usage.record('time_aware');
  usage.record('routing');
  const used = usage.used('time_aware');
  for (const language of LANGUAGES) {
    for (const keyState of ['ok', 'unknown', 'refused', 'missing', 'paused']) {
      const content = buildBudgetWidget({
        usage,
        planned: { time_aware: 2600, routing: 347 },
        percent: 90,
        keyState,
        language,
      });
      assertValid(content, `${language} ${keyState}`);
      const gauges = content.components.filter((c) => c.type === 'gauge');
      assert.equal(gauges.length, 2);
      assert.equal(gauges[0].value, used);
      assert.equal(gauges[0].color, 'warning');
      gauges.forEach((gauge) => assert.ok(gauge.label.length <= 24, gauge.label));
    }
  }
  const fresh = createUsage({ path: null, getPercent: () => 90, logger: silent });
  const empty = buildBudgetWidget({
    usage: fresh,
    planned: {},
    percent: 90,
    keyState: 'missing',
    language: 'de',
  });
  assertValid(empty, 'empty');
  assert.equal(empty.components.filter((c) => c.type === 'gauge').length, 1);
  // Every SKU in use: 5 gauges at most, the most used first.
  const busy = createUsage({ path: null, getPercent: () => 90, logger: silent });
  ['time_aware', 'routing', 'truck', 'scooter', 'transit', 'geocode'].forEach((sku, i) => {
    for (let n = 0; n <= i * 10; n += 1) busy.record(sku);
  });
  const full = buildBudgetWidget({
    usage: busy,
    planned: {},
    percent: 90,
    keyState: 'ok',
    language: 'fr',
  });
  assertValid(full, 'six SKUs');
  const labels = full.components.filter((c) => c.type === 'gauge').map((g) => g.label);
  assert.equal(labels.length, 5);
  // time_aware: 1 / 4,500 is the smallest share of its budget.
  assert.ok(!labels.some((label) => label.startsWith('Trafic')), labels.join(' | '));
});

test('helpers: colors, HERE WeGo link, miles', () => {
  assert.deepEqual(
    [colorOf(0, 10), colorOf(3, 10), colorOf(10, 10)],
    ['success', 'warning', 'danger'],
  );
  assert.equal(
    mapsUrl({ from: { lat: 45.764, lng: 4.8357 }, to: { lat: 48.8584123, lng: 2.2945 } }),
    'https://share.here.com/r/45.764,4.8357/48.85841,2.2945',
  );
  assert.equal(mapsUrl({ from: { lat: 1, lng: 2 }, to: null }), null);
  assert.equal(mapsUrl(null), null);
  assert.equal(distanceOf(16093, 'imperial', 'en').text, '10 mi');
  assert.equal(distanceOf(24530, 'metric', 'fr').text, '24,5 km');
});
