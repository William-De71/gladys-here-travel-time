// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The three widgets on the made-up trips of a household around Lyon, on a
// fixed morning (Monday 19 October 2026, 7:42): the travel times of the
// trips (car, public transport, bicycle), the "Work" trip alone, and the
// requests of the month.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildTripsWidget, buildTripWidget, buildBudgetWidget } = await load('src/widgets.js');
const { createUsage } = await load('src/usage.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const NOW = Date.parse('2026-10-19T05:42:00Z');
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
const reading = (minutes, noTraffic, km, description, minutesAgo) => ({
  at: NOW - minutesAgo * 60000,
  attempt: NOW - minutesAgo * 60000,
  reading: {
    duration: minutes * 60,
    staticDuration: noTraffic * 60,
    delay: Math.max(0, minutes - noTraffic) * 60,
    distanceMeters: km * 1000,
    description,
    signature: description,
    departure: '07:42',
    arrival: '08:20',
    changes: null,
    transitDelay: 0,
  },
  error: null,
});
const NAMES = {
  en: ['Work', 'Airport', 'Office (transit)', 'School', 'Grandparents'],
  fr: ['Travail', 'Aéroport', 'Bureau (TC)', 'Lycée', 'Grands-parents'],
  de: ['Arbeit', 'Flughafen', 'Büro (ÖPNV)', 'Schule', 'Großeltern'],
  es: ['Trabajo', 'Aeropuerto', 'Oficina (bus)', 'Instituto', 'Abuelos'],
};
// The points of the geocoded places (the map links of the list).
const CALUIRE = { lat: 45.7953, lng: 4.8467 };
const points = (lat, lng) => ({ from: CALUIRE, to: { lat, lng } });
const work = trip({
  id: 'a1b2c3d4',
  name: 'Work',
  origin: 'Caluire-et-Cuire',
  destination: 'Lyon Part-Dieu',
});
const office = {
  at: NOW - 3 * 60000,
  attempt: NOW - 3 * 60000,
  reading: {
    duration: 34 * 60,
    staticDuration: 34 * 60,
    delay: 0,
    distanceMeters: 7900,
    description: 'Bus C1 → Métro B',
    signature: 'Bus C1 → Métro B',
    departure: '07:49',
    arrival: '08:16',
    changes: 1,
    transitDelay: 120,
  },
  error: null,
};
const trips = [
  {
    trip: work,
    state: reading(38, 24, 11.8, 'M6, A6', 2),
    active: true,
    points: points(45.7606, 4.8594),
  },
  {
    trip: trip({
      id: 'b2c3d4e5',
      name: 'Airport',
      origin: 'Caluire-et-Cuire',
      destination: 'Lyon-Saint-Exupéry Airport',
      threshold: 15,
    }),
    state: reading(31, 27, 29.4, 'A46, N346', 2),
    active: true,
    points: points(45.7256, 5.0811),
  },
  {
    trip: trip({
      id: 'e5f6a7b8',
      name: 'Office',
      origin: 'home',
      destination: 'Gerland, Lyon',
      mode: 'transit',
    }),
    state: office,
    active: true,
    points: points(45.7298, 4.8293),
  },
  {
    trip: trip({
      id: 'c3d4e5f6',
      name: 'School',
      origin: 'Caluire-et-Cuire',
      destination: 'Lycée du Parc, Lyon',
      mode: 'bicycle',
    }),
    state: reading(17, 17, 4.6, 'Quai Clemenceau', 12),
    active: true,
    points: points(45.7701, 4.8538),
  },
  {
    trip: trip({
      id: 'd4e5f6a7',
      name: 'Grandparents',
      origin: 'Caluire-et-Cuire',
      destination: 'Annecy',
      days: 'weekend',
    }),
    state: reading(92, 91, 138.2, 'A43, A41', 2 * 24 * 60),
    active: false,
    points: points(45.8992, 6.1294),
  },
].map((item) => ({ ...item, threshold: item.trip.threshold ?? 10 }));

// Mid-month usage of a household with the trips above.
const usage = createUsage({ path: null, getPercent: () => 90, now: () => NOW });
for (let i = 0; i < 1985; i += 1) usage.record('time_aware');
for (let i = 0; i < 640; i += 1) usage.record('transit');
for (let i = 0; i < 214; i += 1) usage.record('routing');
for (let i = 0; i < 9; i += 1) usage.record('geocode');

const contents = {};
for (const language of LANGUAGES) {
  const named = trips.map((item, i) => ({
    ...item,
    trip: { ...item.trip, name: NAMES[language][i] },
  }));
  contents[language] = {
    trips: buildTripsWidget({ trips: named, hasKey: true, language, now: NOW }),
    trip: buildTripWidget({
      trip: named[0].trip,
      state: trips[0].state,
      threshold: 10,
      hasKey: true,
      language,
      now: NOW,
    }),
    budget: buildBudgetWidget({
      usage,
      planned: { time_aware: 2860, transit: 1300, routing: 347 },
      percent: 90,
      keyState: 'ok',
      language,
    }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
