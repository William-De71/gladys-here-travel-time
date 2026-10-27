// The integration end to end, against the fake Gladys of the SDK and a fake
// fetch of the HERE APIs: the configuration buttons, the places (geocoding
// once, houses), the Discovery list, the clock (days, hours, interval,
// restart), the errors (refused key, 429, budget), the scene triggers and
// actions, the widgets and their buttons.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp, ACTIONS } from '../src/app.js';
import { TRIGGERS } from '../src/events.js';
import { dataPaths, fakeFetch, route, keyError, silent } from './helpers/fixtures.js';

const manifest = JSON.parse(
  (await import('node:fs')).readFileSync(
    new URL('../gladys-assistant-integration.json', import.meta.url),
    'utf8',
  ),
);
const outputsOf = (key) =>
  manifest.scene_actions
    .find((a) => a.key === key)
    .outputs.map((o) => o.key)
    .sort();
const variablesOf = (key) =>
  manifest.scene_triggers
    .find((t) => t.key === key)
    .variables.map((v) => v.key)
    .sort();

const FORM = {
  name: 'Work',
  origin: '1 place de la Comédie, Lyon',
  destination: 'Gare Part-Dieu, Lyon',
  mode: 'car',
  days: 'weekdays',
};

/**
 * @description A started integration on a controllable clock.
 * @param {object} [options] - Options.
 * @param {string} [options.at] - The instant (ISO): Monday 19 October 2026, 7:30 in Paris.
 * @param {object} [options.config] - The configuration.
 * @param {object|Array} [options.replies] - Replies of the fake fetch.
 * @param {object[]} [options.houses] - The houses of Gladys.
 * @param {object} [options.paths] - The /data files (to restart on them).
 * @returns {Promise<object>} `{ gladys, app, clock, fetchImpl, paths }`.
 */
async function start({
  at = '2026-10-19T05:30:00Z',
  config = {},
  replies,
  paths = dataPaths(),
  fetchImpl = fakeFetch(replies),
  houses = [{ id: 'h1', name: 'Maison', selector: 'maison', latitude: 48.85, longitude: 2.35 }],
} = {}) {
  const clock = { now: new Date(at) };
  const gladys = createFakeGladys({
    config: { language: 'en', api_key: 'HERETESTKEY', ...config },
  });
  gladys.getHouses = async () => houses;
  let n = 0;
  const app = createApp(gladys, {
    now: () => clock.now,
    timezone: 'Europe/Paris',
    fetchImpl,
    statePath: paths.state,
    usagePath: paths.usage,
    geocodePath: paths.geocode,
    sleep: async () => {},
    newId: () => `e000000${(n += 1)}`.slice(-8),
    tickMs: 0,
    logger: silent,
  });
  await gladys.connect();
  return { gladys, app, clock, fetchImpl, paths };
}

const ok = (ack) => {
  assert.equal(ack.success, true, ack.error);
  return ack.data.message ?? ack.data.content ?? ack.data.outputs;
};
const later = (clock, minutes) => {
  clock.now = new Date(clock.now.getTime() + minutes * 60000);
};
const create = async (gladys) => {
  for (const device of gladys.fake.discoveredDevices) await gladys.fake.deviceCreated(device);
};
const routing = (fetchImpl) => fetchImpl.calls.filter((call) => call.api !== 'geocode');
const geocoding = (fetchImpl) => fetchImpl.calls.filter((call) => call.api === 'geocode');
const last = (gladys, key) => gladys.fake.lastState(`ext:test-integration:trip:e0000001:${key}`);

test('no key: the status says what to do, and nothing goes out', async () => {
  const { gladys, app, fetchImpl } = await start({ config: { api_key: '' } });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /clé d’API HERE/);
  ok(await gladys.fake.action(ACTIONS.ADD, FORM));
  await app.tick();
  assert.equal(fetchImpl.calls.length, 0);
  const widget = ok(await gladys.fake.widgetGet('trips', { language: 'en' }));
  assert.match(widget.components[0].text, /API key/);
});

test('add a trip: places checked, stored in Gladys, read at once, states once the device exists', async () => {
  const { gladys, fetchImpl } = await start();
  assert.match(gladys.fake.connectionStatus.message.en, /No trip yet/);
  const message = ok(await gladys.fake.action(ACTIONS.ADD, FORM));
  assert.match(
    message.en,
    /^Added: #1 Work — Car, Monday to Friday, 6-21, every 15 min \(≈ 1,300 requests a month\)/,
  );
  assert.match(message.en, /\nFrom: 1 place de la Comédie, Lyon\nTo: Gare Part-Dieu, Lyon/);
  assert.match(message.fr, /Ouvrez maintenant l’onglet Découverte/);
  assert.equal(gladys.fake.config.trips.length, 1);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.name),
    ['Work'],
  );
  assert.equal(geocoding(fetchImpl).length, 2, 'each address once');
  assert.equal(routing(fetchImpl).length, 1, 'read at once: 7:30 on a Monday');
  const [call] = routing(fetchImpl);
  assert.equal(call.query.get('transportMode'), 'car');
  assert.equal(call.query.get('origin'), '45.76,4.83');
  assert.equal(call.query.get('apiKey'), 'HERETESTKEY');
  assert.equal(gladys.fake.states.length, 0, 'no device yet');
  await create(gladys);
  assert.equal(last(gladys, 'duration'), 32);
  assert.equal(last(gladys, 'traffic_delay'), 7);
  assert.equal(last(gladys, 'route'), 'A6');
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /1 trip\(s\)\. This month: 1 \/ 4,500 “Time-aware routing” requests, 2 \/ 27,000 “Geocoding” requests/,
  );
  const refused = await gladys.fake.action(ACTIONS.ADD, { ...FORM, hours: 'tea time' });
  assert.equal(refused.success, false);
  assert.match(refused.error, /Hours not understood/);
  assert.equal(fetchImpl.calls.length, 3, 'a wrong form spends nothing');
});

test('an address HERE does not know refuses the form; home and coordinates spend no geocoding', async () => {
  const { gladys, fetchImpl } = await start({
    replies: { geocode: [{ status: 200, body: { items: [] } }] },
  });
  const refused = await gladys.fake.action(ACTIONS.ADD, { ...FORM, origin: 'Nowhere at all' });
  assert.equal(refused.success, false);
  assert.match(refused.error, /HERE does not know the address “Nowhere at all”/);
  assert.equal(gladys.fake.config.trips, undefined, 'nothing saved');
  const message = ok(
    await gladys.fake.action(ACTIONS.ADD, {
      ...FORM,
      origin: 'maison',
      destination: '48.8925, 2.2370',
      mode: 'transit',
    }),
  );
  assert.match(message.fr, /Départ : Maison\nArrivée : 48\.8925, 2\.2370/);
  assert.equal(geocoding(fetchImpl).length, 1, 'only the unknown address');
  const [call] = routing(fetchImpl);
  assert.equal(call.api, 'transit');
  assert.equal(call.query.get('origin'), '48.85,2.35');
  const unknown = await gladys.fake.action(ACTIONS.ADD, { ...FORM, origin: '@Chalet' });
  assert.match(unknown.error, /No house of Gladys is called “Chalet”/);
});

test('public transport: lines and times as the route, no traffic features', async () => {
  const { gladys } = await start({ config: { language: 'fr' } });
  ok(await gladys.fake.action(ACTIONS.ADD, { ...FORM, mode: 'transit' }));
  const [device] = gladys.fake.discoveredDevices;
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').pop()),
    ['duration', 'distance', 'route'],
  );
  await create(gladys);
  assert.equal(last(gladys, 'duration'), 45);
  assert.equal(last(gladys, 'route'), 'RER A → Bus 144 · 07:41–08:15');
  const outputs = ok(
    await gladys.fake.sceneAction('refresh_trip', { trip: 'ext:test-integration:trip:e0000001' }),
  );
  assert.equal(outputs.departure_time, '07:41');
  assert.equal(outputs.arrival_time, '08:15');
  assert.equal(
    outputs.summary,
    'Work : 45 min, RER A → Bus 144, premier départ à 07:41, arrivée à 08:15 (1 correspondance(s)), 3 min de retard, 14,2 km.',
  );
});

test('the clock: every interval within the hours, never outside, nothing twice after a restart', async () => {
  const paths = dataPaths();
  const { gladys, app, clock, fetchImpl } = await start({ paths });
  ok(await gladys.fake.action(ACTIONS.ADD, { ...FORM, hours: '7-9', interval_minutes: 10 }));
  assert.equal(routing(fetchImpl).length, 1);
  later(clock, 5);
  await app.tick();
  assert.equal(routing(fetchImpl).length, 1, 'too soon');
  later(clock, 5);
  await app.tick();
  assert.equal(routing(fetchImpl).length, 2);
  // A restart keeps the last reading, the time of the last request and the
  // geocoded places.
  later(clock, 5);
  app.stop();
  const again = await start({
    paths,
    at: clock.now.toISOString(),
    config: { trips: gladys.fake.config.trips },
  });
  assert.equal(again.fetchImpl.calls.length, 0, 'read 5 minutes before the restart');
  const widget = ok(await again.gladys.fake.widgetGet('trips', { language: 'en' }));
  assert.match(widget.components[1].items[0].subtitle, /^32 min · 24\.5 km · via A6$/);
  assert.match(widget.components[1].items[0].links[0].url, /^https:\/\/share\.here\.com\/r\//);
  later(again.clock, 5);
  await again.app.tick();
  assert.equal(again.fetchImpl.calls.length, 1, 'no geocoding after a restart');
  later(again.clock, 120);
  await again.app.tick();
  assert.equal(again.fetchImpl.calls.length, 1, 'after 9:00');
});

test('the route changes: one event at a scheduled reading, none after a manual one', async () => {
  const replies = {
    routing: [
      { status: 200, body: route() },
      {
        status: 200,
        body: route({
          sections: [{ duration: 2400, baseDuration: 1500, length: 26000 }],
          labels: ['N7'],
        }),
      },
      { status: 200, body: route({ labels: ['A7'] }) },
    ],
  };
  const { gladys, app, clock } = await start({ replies });
  ok(await gladys.fake.action(ACTIONS.ADD, FORM));
  later(clock, 15);
  await app.tick();
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [{ key, data }] = gladys.fake.sceneEvents;
  assert.equal(key, TRIGGERS.ROUTE_CHANGED);
  assert.deepEqual(Object.keys(data).sort(), [...variablesOf(key), 'trip'].sort());
  assert.equal(data.trip, 'ext:test-integration:trip:e0000001');
  assert.deepEqual([data.previous_route, data.route, data.duration], ['A6', 'N7', 40]);
  later(clock, 2);
  const outputs = ok(await gladys.fake.sceneAction('refresh_trip', { trip: data.trip }));
  assert.equal(outputs.route, 'A7');
  assert.equal(gladys.fake.sceneEvents.length, 1, 'never an event from an action');
});

test('a refused key: status, one event, a retry an hour later, and a new key starts again', async () => {
  const replies = { routing: [keyError], geocode: [keyError] };
  const { gladys, app, clock, fetchImpl } = await start({ replies });
  const added = ok(await gladys.fake.action(ACTIONS.ADD, FORM));
  assert.doesNotMatch(added.en, /From:/, 'places not checked, the trip is saved anyway');
  assert.equal(gladys.fake.config.trips.length, 1);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /API_KEY_INVALID.*copy it again/);
  const attempts = fetchImpl.calls.length;
  later(clock, 1);
  await app.tick();
  await app.tick();
  const events = gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.API_KEY_REFUSED);
  assert.equal(events.length, 1);
  assert.deepEqual(Object.keys(events[0].data).sort(), variablesOf(TRIGGERS.API_KEY_REFUSED));
  assert.equal(events[0].data.reason, 'API_KEY_INVALID');
  later(clock, 20);
  await app.tick();
  assert.equal(fetchImpl.calls.length, attempts, 'waits before trying the key again');
  later(clock, 45);
  await app.tick();
  assert.equal(fetchImpl.calls.length, attempts + 1, 'an hour later');
  const test = await gladys.fake.action(ACTIONS.TEST_KEY);
  assert.equal(test.success, false);
  assert.match(test.error, /HERE refuses the API key/);
  assert.doesNotMatch(JSON.stringify(gladys.fake.connectionStatus), /HERETESTKEY/);
  // A new key: the refusal is forgotten, the next reading uses it.
  await gladys.fake.configUpdated({ ...gladys.fake.config, api_key: 'NEWKEY' });
  assert.equal(gladys.fake.connectionStatus.connected, true);
  later(clock, 15);
  await app.tick();
  assert.equal(fetchImpl.calls.at(-1).query.get('apiKey'), 'NEWKEY');
});

test('the test button: one routing walk from coordinates, and the key is accepted', async () => {
  const { gladys, fetchImpl } = await start({ config: { language: 'fr' } });
  const message = ok(await gladys.fake.action(ACTIONS.TEST_KEY));
  assert.match(message.fr, /La clé fonctionne.*32 min, 24,5 km \(1 requête « Routage »\)/);
  assert.equal(fetchImpl.calls.length, 1, 'no geocoding');
  assert.equal(fetchImpl.calls[0].query.get('transportMode'), 'pedestrian');
  assert.equal(fetchImpl.calls[0].query.get('departureTime'), 'any');
  const budget = ok(await gladys.fake.widgetGet('budget', { language: 'fr' }));
  assert.equal(budget.components.at(-1).items.at(-1).value, 'Acceptée');
});

test('429: a pause of 15 minutes for every trip', async () => {
  const replies = {
    routing: [
      { status: 429, body: { title: 'Too many requests', status: 429, code: 'E605501' } },
      { status: 200, body: route() },
    ],
  };
  const { gladys, app, clock, fetchImpl } = await start({ replies });
  ok(await gladys.fake.action(ACTIONS.ADD, FORM));
  ok(await gladys.fake.action(ACTIONS.ADD, { ...FORM, name: 'Gym', destination: 'Bron' }));
  assert.equal(routing(fetchImpl).length, 1, 'the second trip waits too');
  later(clock, 14);
  await app.tick();
  assert.equal(routing(fetchImpl).length, 1);
  const paused = ok(await gladys.fake.widgetGet('budget', { language: 'en' }));
  assert.equal(paused.components.at(-1).items.at(-1).value, 'Paused (429)');
  later(clock, 2);
  await app.tick();
  assert.equal(routing(fetchImpl).length, 3);
});

test('the budget: intervals stretched to fit, alerts at 80 % then 100 %, once each', async () => {
  // 1 % of 5,000 time-aware requests: a budget of 50.
  const { gladys, app, fetchImpl } = await start({ config: { budget_percent: 1 } });
  ok(await gladys.fake.action(ACTIONS.ADD, { ...FORM, interval_minutes: 5 }));
  const list = ok(await gladys.fake.action(ACTIONS.LIST));
  assert.match(list.en, /every 434 min .* \(stretched from 5 min to stay within the budget\)/);
  const compute = () =>
    gladys.fake.sceneAction('compute_route', {
      origin: '45.76, 4.83',
      destination: '45.75, 4.92',
      mode: 'car',
    });
  for (let i = 0; i < 39; i += 1) ok(await compute());
  await app.tick();
  await app.tick();
  for (let i = 0; i < 10; i += 1) ok(await compute());
  await app.tick();
  await app.tick();
  const alerts = gladys.fake.sceneEvents.filter((e) => e.key === TRIGGERS.BUDGET_ALERT);
  assert.deepEqual(
    alerts.map((a) => [a.data.level, a.data.used]),
    [
      ['warning', 40],
      ['exhausted', 50],
    ],
  );
  assert.deepEqual(Object.keys(alerts[0].data).sort(), variablesOf(TRIGGERS.BUDGET_ALERT));
  assert.equal(alerts[1].data.sku, 'time_aware');
  const refused = await compute();
  assert.equal(refused.success, false);
  assert.match(refused.error, /The 50 “Time-aware routing” requests of the month are used/);
  assert.equal(routing(fetchImpl).length, 50);
  // Other SKUs go on: a car without live traffic is plain routing.
  const plain = ok(
    await gladys.fake.sceneAction('compute_route', {
      origin: '45.76, 4.83',
      destination: '45.75, 4.92',
      mode: 'car',
      traffic: false,
    }),
  );
  assert.equal(plain.traffic_delay, 0);
  assert.equal(routing(fetchImpl).at(-1).query.get('departureTime'), 'any');
});

test('list, edit and remove; an edit of the mode or the traffic says to update the device', async () => {
  const { gladys, fetchImpl } = await start({ at: '2026-10-18T10:00:00Z' });
  ok(await gladys.fake.action(ACTIONS.ADD, FORM));
  const edited = ok(
    await gladys.fake.action(ACTIONS.EDIT, { trip: '#1', mode: 'bicycle', hours: '7-9' }),
  );
  assert.match(edited.en, /Changed: #1 Work — Bicycle, Monday to Friday, 7-9/);
  assert.match(edited.en, /click “Update” on the Discover tab/);
  assert.equal(geocoding(fetchImpl).length, 2, 'places unchanged: not checked again');
  const car = ok(
    await gladys.fake.action(ACTIONS.EDIT, { trip: '#1', mode: 'car', traffic: 'no' }),
  );
  assert.match(car.en, /Car \(no live traffic\)/);
  const moved = ok(await gladys.fake.action(ACTIONS.EDIT, { trip: 'work', destination: 'Bron' }));
  assert.match(moved.en, /To: Bron/);
  assert.doesNotMatch(moved.en, /Update/);
  assert.equal(geocoding(fetchImpl).length, 3);
  const list = ok(await gladys.fake.action(ACTIONS.LIST));
  assert.match(list.en, /^1 trip\(s\), timezone Europe\/Paris/);
  assert.match(list.en, /last reading: never/);
  ok(await gladys.fake.action(ACTIONS.REMOVE, { trip: 'work' }));
  assert.deepEqual(gladys.fake.config.trips, []);
  assert.match(ok(await gladys.fake.action(ACTIONS.LIST)).en, /No trip yet/);
});

test('scene action compute_route: the declared outputs only, scalars', async () => {
  const { gladys, fetchImpl } = await start();
  const outputs = ok(
    await gladys.fake.sceneAction('compute_route', {
      origin: 'Lyon',
      destination: 'Grenoble',
      mode: 'truck',
      avoid_tolls: true,
    }),
  );
  assert.deepEqual(Object.keys(outputs).sort(), outputsOf('compute_route'));
  for (const value of Object.values(outputs)) {
    assert.ok(['string', 'number'].includes(typeof value));
  }
  assert.equal(outputs.summary, 'Lyon → Grenoble: 32 min, 7 min of traffic, 24.5 km via A6.');
  assert.deepEqual([outputs.departure_time, outputs.arrival_time], ['07:30', '08:02']);
  const call = routing(fetchImpl)[0];
  assert.equal(call.query.get('transportMode'), 'truck');
  assert.equal(call.query.get('avoid[features]'), 'tollRoad');
  const refused = await gladys.fake.sceneAction('compute_route', { origin: '', destination: 'x' });
  assert.equal(refused.success, false);
  const noRoute = await start({
    replies: {
      routing: [
        {
          status: 200,
          body: { routes: [], notices: [{ code: 'noRouteFound', severity: 'critical' }] },
        },
      ],
    },
  });
  const none = await noRoute.gladys.fake.sceneAction('compute_route', {
    origin: '45.76, 4.83',
    destination: '-33.9, 18.42',
  });
  assert.equal(none.success, false);
  assert.match(none.error, /HERE found no route for this trip.*noRouteFound/);
});

test('widgets: the trips, one trip, the refresh buttons and their toasts', async () => {
  const { gladys, clock, fetchImpl } = await start();
  ok(await gladys.fake.action(ACTIONS.ADD, FORM));
  await create(gladys);
  const trips = ok(await gladys.fake.widgetGet('trips', { language: 'de' }));
  assert.equal(trips.components[1].items[0].badge.text, '+7 Min.');
  const id = 'ext:test-integration:trip:e0000001';
  const one = ok(await gladys.fake.widgetGet('trip', { language: 'es', settings: { trip: id } }));
  assert.equal(one.components[0].text, 'Work');
  // Read a moment ago: the button keeps the reading, no request.
  const toast = ok(await gladys.fake.widgetAction('trip', 'refresh', { trip: 'e0000001' }));
  assert.match(toast.en, /^Refreshed: Work: 32 min/);
  assert.equal(routing(fetchImpl).length, 1);
  later(clock, 2);
  const all = ok(
    await gladys.fake.widgetAction('trips', 'refresh_all', { trips: ['e0000001', 'nope'] }),
  );
  assert.equal(all.fr, 'Actualisé : Work : 32 min, dont 7 min de trafic, 24,5 km par A6.');
  assert.equal(routing(fetchImpl).length, 2);
  assert.ok(gladys.fake.widgetRefreshes.length > 0);
  const gone = ok(
    await gladys.fake.widgetGet('trip', {
      language: 'en',
      settings: { trip: 'ext:x:trip:ffffffff' },
    }),
  );
  assert.match(gone.components[0].text, /no longer exists/);
});
