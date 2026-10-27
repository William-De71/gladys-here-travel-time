// -----------------------------------------------------------------------------
// One device per trip, offered on the Discovery screen, named after the trip.
//
// Features (category / type pairs of the SDK constants, with an icon and the
// unit in the Gladys front):
//   - duration             duration / integer, minutes: travel time now (with
//                          live traffic by car, truck and scooter; door to
//                          door, waits included, by public transport)
//   - duration_no_traffic  duration / integer, minutes: the same route at
//                          free-flow speed (HERE baseDuration) — live traffic
//                          trips only
//   - traffic_delay        duration / integer, minutes: the difference, 0 at
//                          least — live traffic trips only
//   - distance             distance-sensor / decimal, km (`integer` has no
//                          icon nor label in the Gladys front)
//   - route                text / text: the main roads ("A6, A7"), or the
//                          lines and times by public transport
//                          ("Bus 21 → RER B · 08:12–08:47")
//
// External ids: `trip:<id>`, the random identifier given to the trip at
// creation: never its name nor its addresses. The readings come from the
// integration's own timer (the trip's days, hours and interval, several
// minutes apart): `should_poll` is false.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';
import { hasTraffic } from './here-api.js';

const DEVICE_TYPE = 'trip';
// 100 hours, 40,000 km: any trip on Earth.
const MAX_MINUTES = 6000;
const MAX_KM = 40000;

const minutes = {
  category: CATEGORIES.DURATION,
  type: TYPES.DURATION.INTEGER,
  unit: UNITS.MINUTES,
  min: 0,
  max: MAX_MINUTES,
  read_only: true,
  has_feedback: false,
  keep_history: true,
};

/**
 * @description Whole minutes of a number of seconds.
 * @param {number} value - Seconds.
 * @returns {number} Minutes.
 */
const toMinutes = (value) => Math.round(value / 60);

/**
 * @description Kilometers with one decimal.
 * @param {number} meters - Meters.
 * @returns {number} Kilometers.
 */
const toKm = (meters) => Math.round(meters / 100) / 10;

const traffic = (trip) => hasTraffic(trip);

/**
 * @description The route of a reading as one line: the main roads, or the
 * lines and the times of a public transport trip (language-neutral).
 * @param {object} reading - The reading.
 * @returns {string} The text, "—" when HERE names nothing.
 * @example
 * routeText({ description: 'Bus 21 → RER B', changes: 1, departure: '08:12', arrival: '08:47' });
 * // -> 'Bus 21 → RER B · 08:12–08:47'
 */
function routeText(reading) {
  const route = reading.description || '—';
  if (reading.changes === null || reading.changes === undefined) return route;
  const times =
    reading.departure && reading.arrival ? ` · ${reading.departure}–${reading.arrival}` : '';
  return `${route}${times}`.slice(0, 250);
}

const FEATURES = [
  {
    key: 'duration',
    name: (trip) => (traffic(trip) ? 'featureDurationTraffic' : 'featureDuration'),
    shape: minutes,
    when: () => true,
    state: (r) => toMinutes(r.duration),
  },
  {
    key: 'duration_no_traffic',
    name: () => 'featureDurationNoTraffic',
    shape: minutes,
    when: traffic,
    state: (r) => toMinutes(r.staticDuration),
  },
  {
    key: 'traffic_delay',
    name: () => 'featureDelay',
    shape: minutes,
    when: traffic,
    state: (r) => toMinutes(r.delay),
  },
  {
    key: 'distance',
    name: () => 'featureDistance',
    shape: {
      category: CATEGORIES.DISTANCE_SENSOR,
      type: TYPES.SENSOR.DECIMAL,
      unit: UNITS.KM,
      min: 0,
      max: MAX_KM,
      read_only: true,
      has_feedback: false,
      keep_history: true,
    },
    when: () => true,
    state: (r) => toKm(r.distanceMeters),
  },
  {
    key: 'route',
    name: () => 'featureRoute',
    shape: {
      category: CATEGORIES.TEXT,
      type: TYPES.TEXT.TEXT,
      min: 0,
      max: 0,
      read_only: true,
      has_feedback: false,
      keep_history: false,
    },
    when: () => true,
    // A text state cannot be empty: "—" when HERE names no road.
    state: (r) => ({ text: routeText(r) }),
  },
];

/**
 * @description The external ids of a trip.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The identifier of the trip.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, id) => gladys.externalIds(DEVICE_TYPE, id);

/**
 * @description The identifier of a trip from a device external id.
 * @param {string} externalId - `ext:<selector>:trip:<id>`.
 * @returns {string|null} The identifier.
 */
function idFromExternalId(externalId) {
  const match = /:trip:([0-9a-f]{8})$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The feature specs a trip has (they depend on its mode).
 * @param {object} trip - The trip.
 * @returns {object[]} The specs.
 */
const specsOf = (trip) => FEATURES.filter((spec) => spec.when(trip));

/**
 * @description The device of a trip.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} trip - The trip.
 * @param {string} [language] - Language of the feature names.
 * @returns {object} The discovered device.
 * @example
 * buildDevice(gladys, trip, 'fr');
 */
function buildDevice(gladys, trip, language = 'en') {
  const ids = idsOf(gladys, trip.id);
  return {
    name: trip.name,
    external_id: ids.device,
    model: t(`mode_${trip.mode}`, language),
    should_poll: false,
    params: [
      // Shown as is under "Technical parameters"; nothing reads them back.
      { name: 'ORIGIN', value: trip.origin },
      { name: 'DESTINATION', value: trip.destination },
      { name: 'MODE', value: t(`mode_${trip.mode}`, language) },
    ],
    features: specsOf(trip).map((spec) => ({
      name: t(spec.name(trip), language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a trip from a reading.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} trip - The trip.
 * @param {object} reading - The reading (seconds and meters).
 * @returns {object[]} The states.
 */
function buildStates(gladys, trip, reading) {
  const ids = idsOf(gladys, trip.id);
  return specsOf(trip).map((spec) => {
    const value = spec.state(reading);
    const id = ids.feature(spec.key);
    return typeof value === 'object'
      ? { device_feature_external_id: id, text: value.text }
      : { device_feature_external_id: id, state: value };
  });
}

/**
 * @description The feature keys of a trip, to tell whether an edit changed
 * them (Gladys then shows "Update" on the Discovery screen).
 * @param {object} trip - The trip.
 * @returns {string} The keys.
 */
const featureSignature = (trip) =>
  specsOf(trip)
    .map((spec) => spec.key)
    .join(',');

export {
  DEVICE_TYPE,
  FEATURES,
  toMinutes,
  toKm,
  routeText,
  idsOf,
  idFromExternalId,
  specsOf,
  buildDevice,
  buildStates,
  featureSignature,
};
