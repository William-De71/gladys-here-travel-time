// The registry of the trips: forms -> trips, checks, edits, lookups, and the
// serialized setConfig writes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tripFromFields,
  editedTrip,
  parseRegistry,
  createRegistry,
  RegistryError,
} from '../src/trips.js';
import { WORK, silent } from './helpers/fixtures.js';

const FORM = {
  name: '  Work ',
  origin: '1 place de la Comédie, Lyon',
  destination: 'Gare Part-Dieu, Lyon',
  mode: 'car',
  avoid_tolls: false,
  avoid_highways: false,
  avoid_ferries: false,
  days: 'weekdays',
};

const refused = (fn, key) =>
  assert.throws(fn, (err) => err instanceof RegistryError && err.key === key, key);

test('a form becomes a trip, with the defaults', () => {
  assert.deepEqual(tripFromFields(FORM, 'a1b2c3d4'), WORK);
  assert.equal(tripFromFields({ ...FORM, mode: undefined }, 'a1b2c3d4').mode, 'car');
  assert.equal(tripFromFields({ ...FORM, traffic: false }, 'a1b2c3d4').traffic, false);
  for (const mode of ['truck', 'scooter', 'bicycle', 'pedestrian', 'transit']) {
    assert.equal(tripFromFields({ ...FORM, mode }, 'a1b2c3d4').mode, mode);
  }
  const own = tripFromFields(
    { ...FORM, hours: '7-9, 17-19', interval_minutes: '10', delay_threshold: 5, avoid_tolls: true },
    'a1b2c3d4',
  );
  assert.deepEqual(
    [own.hours, own.interval, own.threshold, own.avoidTolls],
    [
      [
        [420, 540],
        [1020, 1140],
      ],
      10,
      5,
      true,
    ],
  );
});

test('a form is checked field by field', () => {
  refused(() => tripFromFields({ ...FORM, name: '' }, 'a1b2c3d4'), 'errorName');
  refused(() => tripFromFields({ ...FORM, origin: 'x' }, 'a1b2c3d4'), 'errorOrigin');
  refused(
    () => tripFromFields({ ...FORM, destination: undefined }, 'a1b2c3d4'),
    'errorDestination',
  );
  refused(
    () => tripFromFields({ ...FORM, destination: ' 1 PLACE de la Comédie, Lyon' }, 'a1b2c3d4'),
    'errorSamePlace',
  );
  refused(() => tripFromFields({ ...FORM, mode: 'drive' }, 'a1b2c3d4'), 'errorChoice');
  refused(() => tripFromFields({ ...FORM, hours: 'morning' }, 'a1b2c3d4'), 'errorHours');
  refused(() => tripFromFields({ ...FORM, interval_minutes: 2 }, 'a1b2c3d4'), 'errorInterval');
  refused(() => tripFromFields({ ...FORM, delay_threshold: 'x' }, 'a1b2c3d4'), 'errorThreshold');
});

test('an edit changes only what is filled; 0 goes back to the default', () => {
  const own = { ...WORK, interval: 10, threshold: 5 };
  const edited = editedTrip(own, {
    trip: '#1',
    mode: 'keep',
    avoid_tolls: 'yes',
    days: 'keep',
    interval_minutes: 0,
    destination: 'Villeurbanne',
  });
  assert.deepEqual(
    [
      edited.mode,
      edited.avoidTolls,
      edited.days,
      edited.interval,
      edited.threshold,
      edited.destination,
      edited.name,
    ],
    ['car', true, 'weekdays', null, 5, 'Villeurbanne', 'Work'],
  );
  assert.equal(editedTrip(own, { mode: 'pedestrian' }).mode, 'pedestrian');
  assert.equal(editedTrip(own, { traffic: 'no' }).traffic, false);
  assert.equal(editedTrip({ ...own, traffic: false }, { traffic: 'keep' }).traffic, false);
});

test('the stored registry drops what is not a valid trip', () => {
  const trips = parseRegistry(
    JSON.stringify([
      WORK,
      { ...WORK },
      { ...WORK, id: 'nothex!!' },
      { ...WORK, id: 'ffffffff', mode: 'boat' },
    ]),
    silent,
  );
  assert.deepEqual(trips, [WORK]);
  assert.deepEqual(parseRegistry('{', silent), []);
  assert.deepEqual(parseRegistry(null, silent), []);
});

test('the registry saves through setConfig, one change at a time, and finds trips', async () => {
  const saved = [];
  const gladys = { setConfig: async (values) => saved.push(values.trips) };
  let n = 0;
  const registry = createRegistry(gladys, { newId: () => `0000000${(n += 1)}` });
  await Promise.all([registry.add(FORM), registry.add({ ...FORM, name: 'Work' })]);
  assert.equal(registry.list().length, 2);
  assert.equal(saved.length, 2);
  assert.equal(registry.find('#2').id, '00000002');
  refused(() => registry.find('work'), 'errorAmbiguous');
  refused(() => registry.find('nowhere'), 'errorNotFound');
  refused(() => registry.find(''), 'errorTarget');
  await registry.edit({ trip: '#2', name: 'Gym' });
  assert.equal(registry.find('GYM').id, '00000002');
  await registry.remove('gym');
  assert.deepEqual(
    registry.list().map((trip) => trip.id),
    ['00000001'],
  );
  // A refused save changes nothing in memory.
  const failing = createRegistry({ setConfig: async () => Promise.reject(new Error('nope')) });
  await assert.rejects(failing.add(FORM), /nope/);
  assert.deepEqual(failing.list(), []);
});
