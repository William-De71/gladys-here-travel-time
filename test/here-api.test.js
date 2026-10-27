// The HERE client: what goes out (queries, SKU, the key), what comes back
// (sums of sections, labels, lines), and how each failure is classified.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  skuOf,
  hasTraffic,
  routingQuery,
  transitQuery,
  readRoute,
  readTransitRoute,
  readGeocode,
  classifyError,
  lineName,
  scrub,
  createHereApi,
  ApiKeyError,
  QuotaError,
  TripError,
  BudgetExceededError,
  HereError,
  FREE_USAGE,
} from '../src/here-api.js';
import { createUsage } from '../src/usage.js';
import { fakeFetch, route, transit, place, keyError, silent, WORK } from './helpers/fixtures.js';

const LYON = { lat: 45.764043, lng: 4.835659 };
const PART_DIEU = { lat: 45.7606, lng: 4.8594 };

test('SKUs: one per request type, with the free usage of the HERE Base plan', () => {
  assert.equal(skuOf({ mode: 'car' }), 'time_aware');
  assert.equal(skuOf({ mode: 'car', traffic: false }), 'routing');
  assert.equal(skuOf({ mode: 'bicycle' }), 'routing');
  assert.equal(skuOf({ mode: 'pedestrian' }), 'routing');
  assert.equal(skuOf({ mode: 'truck', traffic: false }), 'truck');
  assert.equal(skuOf({ mode: 'scooter' }), 'scooter');
  assert.equal(skuOf({ mode: 'transit' }), 'transit');
  assert.deepEqual(FREE_USAGE, {
    time_aware: 5000,
    routing: 30000,
    truck: 5000,
    scooter: 5000,
    transit: 5000,
    geocode: 30000,
  });
  assert.equal(hasTraffic({ mode: 'truck', traffic: false }), true, 'always by truck');
  assert.equal(hasTraffic({ mode: 'pedestrian' }), false);
});

test('routing query: live traffic by default, planning mode without it', () => {
  const live = routingQuery(WORK, LYON, PART_DIEU, 'fr');
  assert.equal(live.get('transportMode'), 'car');
  assert.equal(live.get('origin'), '45.764043,4.835659');
  assert.equal(live.get('destination'), '45.7606,4.8594');
  assert.equal(live.get('return'), 'summary,routeLabels');
  assert.equal(live.get('lang'), 'fr-FR');
  assert.equal(live.has('departureTime'), false, 'now: time-aware');
  assert.equal(live.has('apiKey'), false, 'the key is added by the client only');
  const planning = routingQuery({ ...WORK, traffic: false }, LYON, PART_DIEU, 'xx');
  assert.equal(planning.get('departureTime'), 'any', 'billed as Routing, not Time-Aware');
  assert.equal(planning.get('lang'), 'en-US');
  const walk = routingQuery({ mode: 'pedestrian', avoidTolls: true }, LYON, PART_DIEU, 'de');
  assert.equal(walk.get('departureTime'), 'any');
  assert.equal(walk.has('avoid[features]'), false, 'no avoid option on foot');
  const avoid = routingQuery(
    { mode: 'truck', avoidTolls: true, avoidHighways: true, avoidFerries: true },
    LYON,
    PART_DIEU,
    'es',
  );
  assert.equal(avoid.get('avoid[features]'), 'tollRoad,controlledAccessHighway,ferry');
  assert.equal(avoid.has('departureTime'), false);
  const moto = routingQuery({ mode: 'scooter' }, LYON, PART_DIEU, 'en');
  assert.equal(moto.get('scooter[allowHighway]'), 'true');
  const scooter = routingQuery({ mode: 'scooter', avoidHighways: true }, LYON, PART_DIEU, 'en');
  assert.equal(scooter.has('scooter[allowHighway]'), false);
  assert.equal(
    routingQuery(WORK, LYON, PART_DIEU, 'en', { labels: false }).get('return'),
    'summary',
  );
  const pt = transitQuery(LYON, PART_DIEU, 'fr');
  assert.deepEqual(Object.fromEntries(pt), {
    origin: '45.764043,4.835659',
    destination: '45.7606,4.8594',
    return: 'travelSummary',
    lang: 'fr-FR',
  });
});

test('a route: the sections add up, a ferry has no baseDuration, the delay is never negative', () => {
  const reading = readRoute(
    route({
      sections: [
        { duration: 541, baseDuration: 501, length: 3898 },
        { duration: 5449, length: 40565 },
        { duration: 440, baseDuration: 396, length: 5273 },
      ],
      labels: ['A16', 'E402', 'A16', 'D940', 'N1'],
    }),
    WORK,
  );
  assert.deepEqual(
    [reading.duration, reading.staticDuration, reading.delay, reading.distanceMeters],
    [6430, 6346, 84, 49736],
  );
  assert.equal(reading.description, 'A16, E402, D940');
  assert.equal(reading.signature, reading.description);
  assert.deepEqual([reading.departure, reading.arrival, reading.changes], ['07:30', '08:02', null]);
  const faster = readRoute(
    route({ sections: [{ duration: 900, baseDuration: 1000, length: 1 }] }),
    WORK,
  );
  assert.equal(faster.delay, 0);
  const noTraffic = readRoute(route(), { mode: 'car', traffic: false });
  assert.equal(noTraffic.staticDuration, noTraffic.duration);
  assert.equal(readRoute(route({ labels: [] }), WORK).description, '');
});

test('no route: the critical notice is the reason', () => {
  assert.throws(
    () =>
      readRoute(
        {
          routes: [],
          notices: [
            { code: 'mainLanguageNotFound', severity: 'info' },
            { title: "Couldn't match origin.", code: 'couldNotMatchOrigin', severity: 'critical' },
          ],
        },
        WORK,
      ),
    (err) => err instanceof TripError && err.reason === 'couldNotMatchOrigin',
  );
  assert.throws(
    () => readTransitRoute({ routes: [], notices: [{ code: 'noCoverage' }] }),
    (err) => err instanceof TripError && err.reason === 'noCoverage',
  );
  assert.throws(
    () => readGeocode({ items: [] }),
    (err) => err.reason === 'ADDRESS_NOT_FOUND',
  );
});

test('public transport: door to door with the waits, the lines, the changes, the delay', () => {
  const reading = readTransitRoute(transit());
  assert.equal(reading.duration, 2700, '07:30 → 08:15');
  assert.equal(reading.staticDuration, 2700);
  assert.equal(reading.delay, 0);
  assert.equal(reading.distanceMeters, 14200);
  assert.equal(reading.description, 'RER A → Bus 144');
  assert.deepEqual([reading.departure, reading.arrival], ['07:41', '08:15']);
  assert.equal(reading.changes, 1);
  assert.equal(reading.transitDelay, 180);
  // A walking-only route given first: the route with a line wins.
  const walkFirst = transit();
  walkFirst.routes.unshift({ id: 'R1', sections: [walkFirst.routes[0].sections[0]] });
  assert.equal(readTransitRoute(walkFirst).description, 'RER A → Bus 144');
  assert.equal(lineName({ mode: 'subway', name: 'U2', category: 'U-Bahn' }), 'U-Bahn U2');
  assert.equal(
    lineName({ mode: 'regionalTrain', name: 'TER 886123', category: 'TER' }),
    'TER 886123',
  );
  assert.equal(lineName({ mode: 'bus', category: 'Bus' }), 'Bus');
});

test('geocoding: the first item', () => {
  assert.deepEqual(readGeocode(place(45.76, 4.86, 'Gare Part-Dieu, 69003 Lyon, France')), {
    lat: 45.76,
    lng: 4.86,
    label: 'Gare Part-Dieu, 69003 Lyon, France',
  });
});

test('errors: refused key, credentials not allowed, region, 429, malformed request', () => {
  const invalid = classifyError('Routing API', 401, keyError.body);
  assert.ok(invalid instanceof ApiKeyError);
  assert.equal(invalid.reason, 'API_KEY_INVALID');
  assert.match(invalid.message, /401: Unauthorized: apiKey invalid/);
  assert.equal(
    classifyError('Routing API', 401, {
      error: 'Unauthorized',
      error_description: 'No credentials found',
    }).reason,
    'API_KEY_MISSING',
  );
  const forbidden = classifyError('Public Transit API', 403, {
    error: 'Forbidden',
    error_description: 'These credentials do not authorize access',
  });
  assert.ok(forbidden instanceof ApiKeyError);
  assert.equal(forbidden.reason, 'FORBIDDEN');
  const japan = classifyError('Routing API', 403, {
    title: 'Not allowed',
    status: 403,
    code: 'E605101',
    cause: 'Your credentials are not allowed to calculate routes in Japan',
  });
  assert.ok(japan instanceof TripError);
  assert.equal(japan.reason, 'E605101');
  const quota = classifyError('Routing API', 429, { title: 'Too many requests', code: 'E605501' });
  assert.ok(quota instanceof QuotaError);
  const bad = classifyError('Routing API', 400, {
    title: 'Malformed request',
    code: 'E605001',
    cause: 'missing field `destination`',
  });
  assert.ok(bad instanceof TripError);
  assert.equal(bad.reason, 'E605001');
  assert.ok(classifyError('Routing API', 503, null) instanceof HereError);
  assert.equal(
    scrub('GET https://x/?a=1&apiKey=SECRET123&b=2'),
    'GET https://x/?a=1&apiKey=***&b=2',
  );
});

/**
 * @description A client on a fake fetch.
 * @param {object} replies - Replies of the fake fetch.
 * @param {object} [options] - `{ key, percent }`.
 * @returns {object} `{ api, usage, fetchImpl }`.
 */
function client(replies, { key = 'SECRETKEY', percent = 90 } = {}) {
  const fetchImpl = fakeFetch(replies);
  const usage = createUsage({ path: null, getPercent: () => percent, logger: silent });
  const api = createHereApi({ getApiKey: () => key, usage, fetchImpl, logger: silent });
  return { api, usage, fetchImpl };
}

test('client: the key in the query only, a 200 is counted in its SKU, an error is not', async () => {
  const { api, usage, fetchImpl } = client({ routing: [{ status: 200, body: route() }, keyError] });
  const reading = await api.route(WORK, LYON, PART_DIEU, 'fr');
  assert.equal(reading.sku, 'time_aware');
  assert.equal(reading.duration, 1920);
  assert.equal(fetchImpl.calls[0].query.get('apiKey'), 'SECRETKEY');
  assert.match(fetchImpl.calls[0].url, /^https:\/\/router\.hereapi\.com\/v8\/routes\?/);
  assert.equal(fetchImpl.calls[0].method, 'GET');
  assert.equal(usage.used('time_aware'), 1);
  await assert.rejects(api.route(WORK, LYON, PART_DIEU, 'fr'), (err) => {
    assert.ok(err instanceof ApiKeyError);
    assert.doesNotMatch(err.message, /SECRETKEY/);
    return true;
  });
  assert.equal(usage.used('time_aware'), 1);
  const pt = await api.route({ mode: 'transit' }, LYON, PART_DIEU, 'en');
  assert.equal(pt.sku, 'transit');
  assert.match(fetchImpl.calls[2].url, /^https:\/\/transit\.router\.hereapi\.com\/v8\/routes\?/);
  const found = await api.geocode('Gare Part-Dieu, Lyon', 'fr');
  assert.equal(found.lat, 45.76);
  assert.match(fetchImpl.calls[3].url, /^https:\/\/geocode\.search\.hereapi\.com\/v1\/geocode\?/);
  assert.equal(fetchImpl.calls[3].query.get('q'), 'Gare Part-Dieu, Lyon');
  assert.equal(fetchImpl.calls[3].query.get('limit'), '1');
  assert.equal(usage.used('geocode'), 1);
});

test('client: no route is billed (200), a network error carries no key', async () => {
  const { api, usage } = client({
    routing: [
      {
        status: 200,
        body: { routes: [], notices: [{ code: 'noRouteFound', severity: 'critical' }] },
      },
      new TypeError('fetch failed for https://router.hereapi.com/v8/routes?apiKey=SECRETKEY'),
    ],
  });
  await assert.rejects(api.route(WORK, LYON, PART_DIEU, 'en'), TripError);
  assert.equal(usage.used('time_aware'), 1);
  await assert.rejects(api.route(WORK, LYON, PART_DIEU, 'en'), (err) => {
    assert.ok(err instanceof HereError);
    assert.equal(err.status, null);
    assert.doesNotMatch(err.message, /SECRETKEY/);
    return true;
  });
});

test('client: no key, spent budget: nothing goes out', async () => {
  const none = client({}, { key: '' });
  await assert.rejects(none.api.route(WORK, LYON, PART_DIEU, 'en'), ApiKeyError);
  assert.equal(none.fetchImpl.calls.length, 0);
  const spent = client({}, { percent: 0.02 });
  await spent.api.route(WORK, LYON, PART_DIEU, 'en');
  await assert.rejects(spent.api.route(WORK, LYON, PART_DIEU, 'en'), BudgetExceededError);
  assert.equal(spent.fetchImpl.calls.length, 1);
});

test('client: route labels refused (E605013) -> asked once more without, then never', async () => {
  const refused = { status: 400, body: { title: 'Invalid return options', code: 'E605013' } };
  const { api, fetchImpl, usage } = client({
    routing: [refused, { status: 200, body: route({ labels: [] }) }],
  });
  const reading = await api.route(WORK, LYON, PART_DIEU, 'en');
  assert.equal(reading.description, '');
  assert.deepEqual(
    fetchImpl.calls.map((call) => call.query.get('return')),
    ['summary,routeLabels', 'summary'],
  );
  await api.route(WORK, LYON, PART_DIEU, 'en');
  assert.equal(fetchImpl.calls[2].query.get('return'), 'summary');
  assert.equal(usage.used('time_aware'), 2);
});
