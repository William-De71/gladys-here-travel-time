// Where a trip starts and ends: coordinates, the houses of Gladys, and the
// addresses geocoded once then read from /data/geocode.json.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import {
  createPlaces,
  parseCoordinates,
  houseQuery,
  keyOf,
  PlaceError,
  MAX_ENTRIES,
} from '../src/places.js';
import { dataPaths, silent } from './helpers/fixtures.js';

const HOUSES = [
  { id: 'h1', name: 'Chalet', selector: 'chalet', latitude: null, longitude: null },
  { id: 'h2', name: 'Maison', selector: 'maison', latitude: 48.85, longitude: 2.35 },
];

/**
 * @description A resolver on a fake geocoder.
 * @param {object} [options] - `{ path, houses }`.
 * @returns {object} `{ places, geocoded, houseReads }`.
 */
function make({ path = dataPaths().geocode, houses = HOUSES } = {}) {
  const geocoded = [];
  let houseReads = 0;
  const api = {
    async geocode(text) {
      geocoded.push(text);
      return { lat: 45.76, lng: 4.86, label: `${text}, France` };
    },
  };
  const places = createPlaces({
    api,
    getHouses: async () => {
      houseReads += 1;
      if (houses instanceof Error) throw houses;
      return houses;
    },
    path,
    logger: silent,
  });
  return { places, geocoded, reads: () => houseReads, path };
}

test('typed places: coordinates, home words, @name, addresses', () => {
  assert.deepEqual(parseCoordinates('45.76, 4.83'), { lat: 45.76, lng: 4.83 });
  assert.deepEqual(parseCoordinates('-33.9;18.42'), { lat: -33.9, lng: 18.42 });
  assert.equal(parseCoordinates('95, 4'), null);
  assert.equal(parseCoordinates('12 rue de la Paix'), null);
  for (const word of ['home', 'Maison', 'DOMICILE', 'zuhause', 'casa', 'hogar']) {
    assert.deepEqual(houseQuery(word), { name: null }, word);
  }
  assert.deepEqual(houseQuery('@ Chalet '), { name: 'Chalet' });
  assert.equal(houseQuery('@'), null);
  assert.equal(houseQuery('Maison de la Radio, Paris'), null);
  assert.equal(keyOf('  Gare   Part-Dieu, LYON '), 'gare part-dieu, lyon');
});

test('an address is geocoded once, then read from /data across restarts', async () => {
  const first = make();
  const a = await first.places.resolve('Gare Part-Dieu, Lyon', 'fr');
  assert.deepEqual(a, {
    lat: 45.76,
    lng: 4.86,
    label: 'Gare Part-Dieu, Lyon, France',
    source: 'geocode',
  });
  const b = await first.places.resolve(' gare part-dieu,   LYON', 'fr');
  assert.equal(b.source, 'cache');
  assert.equal(first.geocoded.length, 1);
  assert.equal(statSync(first.path).mode & 0o777, 0o600);
  const again = make({ path: first.path });
  assert.equal((await again.places.resolve('Gare Part-Dieu, Lyon', 'fr')).source, 'cache');
  assert.equal(again.geocoded.length, 0);
  assert.deepEqual(again.places.known('Gare Part-Dieu, Lyon'), { lat: 45.76, lng: 4.86 });
  assert.equal(again.places.known('Somewhere else'), null);
  const coordinates = await again.places.resolve('48.8584, 2.2945', 'fr');
  assert.equal(coordinates.source, 'coordinates');
  assert.equal(again.geocoded.length, 0);
});

test('the cache keeps the most recently used addresses', async () => {
  const { places, path } = make();
  for (let i = 0; i <= MAX_ENTRIES; i += 1) await places.resolve(`Address ${i}`, 'en');
  const stored = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(Object.keys(stored).length, MAX_ENTRIES);
});

test('an unreadable cache starts empty', async () => {
  const path = dataPaths().geocode;
  writeFileSync(path, '{ nope');
  const { places, geocoded } = make({ path });
  await places.resolve('Lyon', 'en');
  assert.equal(geocoded.length, 1);
});

test('houses: the first located one for "home", by name with @, read again when missing', async () => {
  const { places, geocoded, reads } = make();
  assert.deepEqual(await places.resolve('home', 'en'), {
    lat: 48.85,
    lng: 2.35,
    label: 'Maison',
    source: 'house',
  });
  assert.equal(reads(), 1);
  await places.resolve('maison', 'fr');
  assert.equal(reads(), 1, 'kept in memory');
  await assert.rejects(
    places.resolve('@Chalet', 'en'),
    (err) => err instanceof PlaceError && err.key === 'errorHouseNoLocation',
  );
  await assert.rejects(
    places.resolve('@Studio', 'en'),
    (err) => err instanceof PlaceError && err.key === 'errorUnknownHouse',
  );
  assert.equal(reads(), 2, 'read again for the missing house only');
  assert.equal(geocoded.length, 0);
  assert.deepEqual(places.known('home'), { lat: 48.85, lng: 2.35 });
  assert.equal(places.known('@Chalet'), null);
});

test('houses: none located, or not readable (no location permission)', async () => {
  const unlocated = make({ houses: [HOUSES[0]] });
  await assert.rejects(unlocated.places.resolve('home', 'en'), (err) => err.key === 'errorNoHouse');
  const refused = make({ houses: new Error('403 Forbidden') });
  await assert.rejects(refused.places.resolve('home', 'en'), (err) => err.key === 'errorNoHouse');
});
