// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

import { buildDevice, buildStates, idFromExternalId, featureSignature } from '../src/device.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  fakeGladys,
  TRIPS,
  WORK,
  SCHOOL,
  RIDE,
  OFFICE,
  READING,
  TRANSIT_READING,
} from './helpers/fixtures.js';

const ALL = [...TRIPS, OFFICE, { ...WORK, id: 'e5f6a7b8', mode: 'truck' }];
const devices = (language) => ALL.map((trip) => buildDevice(fakeGladys, trip, language));

// DEVICE_FEATURE_UNITS_BY_CATEGORY of the Gladys core (server/utils/constants.js)
// for `duration` and `distance-sensor`, and the pairs with an icon in the front
// (front/src/utils/consts.js: duration/integer -> clock, distance-sensor/decimal
// -> italic, text/text).
const UNITS_OF = {
  [CATEGORIES.DURATION]: [UNITS.MINUTES],
  [CATEGORIES.DISTANCE_SENSOR]: [UNITS.KM],
};
const PAIRS = [
  [CATEGORIES.DURATION, TYPES.DURATION.INTEGER],
  [CATEGORIES.DISTANCE_SENSOR, TYPES.SENSOR.DECIMAL],
  [CATEGORIES.TEXT, TYPES.TEXT.TEXT],
];

test('devices are never polled by Gladys: the integration has its own clock', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max']) {
          assert.equal(typeof feature[key], 'number', `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true, feature.external_id);
        assert.equal(feature.has_feedback, false, feature.external_id);
        assert.ok(feature.name, feature.external_id);
      }
    }
  }
});

test('every category / type pair has an icon in Gladys, every unit belongs to its category', () => {
  for (const device of devices('en')) {
    for (const feature of device.features) {
      assert.ok(
        PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
        `${feature.external_id}: ${feature.category} / ${feature.type}`,
      );
      if (UNITS_OF[feature.category]) {
        assert.ok(UNITS_OF[feature.category].includes(feature.unit), feature.external_id);
      }
    }
  }
});

test('the features follow the mode: traffic features with live traffic only', () => {
  const keys = (trip) =>
    buildDevice(fakeGladys, trip).features.map((f) => f.external_id.split(':').pop());
  assert.deepEqual(keys(WORK), [
    'duration',
    'duration_no_traffic',
    'traffic_delay',
    'distance',
    'route',
  ]);
  assert.deepEqual(keys(RIDE), keys(WORK));
  assert.deepEqual(keys({ ...WORK, mode: 'truck' }), keys(WORK));
  assert.deepEqual(keys(SCHOOL), ['duration', 'distance', 'route']);
  assert.deepEqual(keys(OFFICE), ['duration', 'distance', 'route']);
  assert.deepEqual(keys({ ...WORK, traffic: false }), ['duration', 'distance', 'route']);
  assert.deepEqual(keys({ ...RIDE, traffic: false }), keys(WORK), 'a scooter always has traffic');
  assert.notEqual(featureSignature(WORK), featureSignature(SCHOOL));
  assert.notEqual(featureSignature(WORK), featureSignature({ ...WORK, traffic: false }));
  assert.equal(featureSignature(WORK), featureSignature({ ...WORK, mode: 'scooter' }));
});

test('external ids come from the identifier of the trip, never its name nor its addresses', () => {
  const device = buildDevice(fakeGladys, WORK, 'fr');
  assert.equal(device.external_id, 'ext:test-integration:trip:a1b2c3d4');
  assert.equal(idFromExternalId(device.external_id), 'a1b2c3d4');
  assert.equal(idFromExternalId('ext:x:trip:Work'), null);
  const renamed = buildDevice(fakeGladys, { ...WORK, name: 'Job', origin: 'Bron' }, 'fr');
  assert.deepEqual(
    renamed.features.map((f) => f.external_id),
    device.features.map((f) => f.external_id),
  );
  assert.equal(device.name, 'Work');
  assert.equal(device.features[0].name, 'Durée avec trafic');
});

test('states: whole minutes, km with one decimal, the route as text', () => {
  const states = buildStates(fakeGladys, WORK, READING);
  const byKey = Object.fromEntries(
    states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]),
  );
  assert.deepEqual(byKey, {
    duration: 32,
    duration_no_traffic: 25,
    traffic_delay: 7,
    distance: 24.5,
    route: 'A6',
  });
  const noRoad = buildStates(fakeGladys, SCHOOL, { ...READING, description: '' });
  assert.equal(noRoad.at(-1).text, '—');
  const transit = buildStates(fakeGladys, OFFICE, TRANSIT_READING);
  assert.deepEqual(
    transit.map((s) => s.state ?? s.text),
    [45, 14.2, 'RER A → Bus 144 · 07:41–08:15'],
  );
});

test('the whole Discovery batch is accepted by the fake Gladys', async () => {
  const gladys = createFakeGladys();
  await gladys.connect();
  await gladys.publishDiscoveredDevices(devices('es'));
  assert.equal(gladys.fake.discoveredDevices.length, ALL.length);
  await gladys.disconnect?.();
});
