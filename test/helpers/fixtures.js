// Shared fixtures of the tests: a few trips of a household, a fake fetch of
// the HERE APIs (routing, public transit, geocoding), a silent logger. Tests
// never touch the network.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

// Only what the device builders use from the SDK client.
const fakeGladys = {
  externalIds: (type, id) => {
    const device = `ext:test-integration:${type}:${id}`;
    return { device, feature: (key) => `${device}:${key}` };
  },
};

const trip = (values) => ({
  mode: 'car',
  traffic: true,
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  days: 'weekdays',
  hours: [[360, 1260]],
  interval: null,
  threshold: null,
  ...values,
});

const WORK = trip({
  id: 'a1b2c3d4',
  name: 'Work',
  origin: '1 place de la Comédie, Lyon',
  destination: 'Gare Part-Dieu, Lyon',
});
const SCHOOL = trip({
  id: 'b2c3d4e5',
  name: 'School',
  origin: '45.7640, 4.8357',
  destination: 'Lycée du Parc, Lyon',
  mode: 'bicycle',
  hours: [
    [420, 540],
    [960, 1080],
  ],
});
const RIDE = trip({
  id: 'c3d4e5f6',
  name: 'Ride',
  origin: 'Lyon',
  destination: 'Annecy',
  mode: 'scooter',
  days: 'weekend',
  avoidHighways: true,
});
const OFFICE = trip({
  id: 'd4e5f6a7',
  name: 'Office',
  origin: 'home',
  destination: 'La Défense, Puteaux',
  mode: 'transit',
});
const TRIPS = [WORK, SCHOOL, RIDE];

// A reading as the HERE client returns it (seconds and meters).
const READING = {
  duration: 1920,
  staticDuration: 1500,
  delay: 420,
  distanceMeters: 24530,
  description: 'A6',
  signature: 'A6',
  departure: '07:30',
  arrival: '08:02',
  changes: null,
  transitDelay: 0,
};
const TRANSIT_READING = {
  duration: 2700,
  staticDuration: 2700,
  delay: 0,
  distanceMeters: 14200,
  description: 'RER A → Bus 144',
  signature: 'RER A → Bus 144',
  departure: '07:41',
  arrival: '08:15',
  changes: 1,
  transitDelay: 180,
};

/**
 * @description A temporary directory for the /data files.
 * @returns {{ state: string, usage: string, geocode: string }} The paths (the files do not exist).
 */
function dataPaths() {
  const dir = mkdtempSync(join(tmpdir(), 'here-travel-time-'));
  return {
    state: join(dir, 'state.json'),
    usage: join(dir, 'usage.json'),
    geocode: join(dir, 'geocode.json'),
  };
}

/**
 * @description A Routing API answer: one route, one section per summary.
 * @param {object} [values] - `{ sections, labels }` overrides.
 * @returns {object} The body.
 */
function route({
  sections = [{ duration: 1920, baseDuration: 1500, length: 24530 }],
  labels = ['A6'],
} = {}) {
  return {
    routes: [
      {
        id: 'r1',
        sections: sections.map((summary, index) => ({
          id: `s${index}`,
          type: 'vehicle',
          departure: { time: '2026-10-19T07:30:00+02:00', place: { type: 'place' } },
          arrival: { time: '2026-10-19T08:02:00+02:00', place: { type: 'place' } },
          summary,
          transport: { mode: 'car' },
        })),
        routeLabels: labels.map((value) => ({ label_type: 'RouteNumber', name: { value } })),
      },
    ],
  };
}

/**
 * @description A Public Transit API answer: walk, RER A, Bus 144, walk.
 * @returns {object} The body.
 */
function transit() {
  const at = (time) => `2026-10-19T${time}:00+02:00`;
  return {
    routes: [
      {
        id: 'R0',
        sections: [
          {
            id: 'R0-S0',
            type: 'pedestrian',
            departure: { time: at('07:30'), place: { type: 'place' } },
            arrival: { time: at('07:38'), place: { name: 'Nation', type: 'station' } },
            travelSummary: { duration: 480, length: 600 },
            transport: { mode: 'pedestrian' },
          },
          {
            id: 'R0-S1',
            type: 'transit',
            departure: { time: at('07:41'), place: { name: 'Nation', type: 'station' } },
            arrival: { time: at('07:58'), place: { name: 'La Défense', type: 'station' } },
            travelSummary: { duration: 1020, length: 11000 },
            transport: { mode: 'cityTrain', name: 'RER A', category: 'RER' },
          },
          {
            id: 'R0-S2',
            type: 'transit',
            departure: { time: at('08:03'), place: { name: 'La Défense', type: 'station' } },
            arrival: { time: at('08:12'), place: { name: 'Puteaux', type: 'station' }, delay: 180 },
            travelSummary: { duration: 540, length: 2300 },
            transport: { mode: 'bus', name: '144', category: 'Bus', headsign: 'Rueil' },
          },
          {
            id: 'R0-S3',
            type: 'pedestrian',
            departure: { time: at('08:12'), place: { name: 'Puteaux', type: 'station' } },
            arrival: { time: at('08:15'), place: { type: 'place' } },
            travelSummary: { duration: 180, length: 300 },
            transport: { mode: 'pedestrian' },
          },
        ],
      },
    ],
  };
}

/**
 * @description A Geocoding answer.
 * @param {number} lat - Latitude.
 * @param {number} lng - Longitude.
 * @param {string} [label] - The address label.
 * @returns {object} The body.
 */
function place(lat, lng, label = 'Somewhere, France') {
  return {
    items: [
      {
        title: label,
        resultType: 'houseNumber',
        address: { label },
        position: { lat, lng },
      },
    ],
  };
}

const keyError = {
  status: 401,
  body: { error: 'Unauthorized', error_description: 'apiKey invalid. apiKey not found.' },
};

/**
 * @description The default answer of each HERE API.
 * @param {object} request - `{ url, api, query }`.
 * @returns {{ status: number, body: object }} The answer.
 */
function defaultReply(request) {
  if (request.api === 'geocode') {
    return { status: 200, body: place(45.76, 4.83, request.query.get('q')) };
  }
  if (request.api === 'transit') return { status: 200, body: transit() };
  return { status: 200, body: route() };
}

/**
 * @description A fake fetch of the HERE APIs. Each reply list is per API
 * (routing, transit, geocode): the queued replies in order, the last one
 * forever; a missing list answers a default route, transit route or place.
 * @param {object|Array} [replies] - `{ routing, transit, geocode }` lists of
 *   `{ status, body }`, `(request) => ({ status, body })` or an Error; an
 *   array is the routing list.
 * @returns {Function & { calls: object[] }} The fetch; `calls` holds
 *   `{ url, api, query }` (the key included, as HERE receives it).
 */
function fakeFetch(replies = {}) {
  const lists = Array.isArray(replies) ? { routing: replies } : replies;
  const queues = Object.fromEntries(Object.entries(lists).map(([api, list]) => [api, [...list]]));
  const calls = [];
  const impl = async (url, options = {}) => {
    const parsed = new URL(url);
    const api = parsed.hostname.startsWith('geocode')
      ? 'geocode'
      : parsed.hostname.startsWith('transit')
        ? 'transit'
        : 'routing';
    const request = { url, api, query: parsed.searchParams, method: options.method };
    calls.push(request);
    const queue = queues[api];
    let reply = queue ? (queue.length > 1 ? queue.shift() : queue[0]) : defaultReply;
    if (typeof reply === 'function') reply = reply(request);
    if (reply instanceof Error) throw reply;
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => reply.body,
    };
  };
  impl.calls = calls;
  return impl;
}

export {
  silent,
  fakeGladys,
  trip,
  WORK,
  SCHOOL,
  RIDE,
  OFFICE,
  TRIPS,
  READING,
  TRANSIT_READING,
  dataPaths,
  fakeFetch,
  route,
  transit,
  place,
  keyError,
};
