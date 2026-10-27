// -----------------------------------------------------------------------------
// Scene triggers and scene actions of the integration.
//
// Triggers, one event per transition (never a periodic snapshot):
//   - `route_changed`   the fastest route of a trip goes by other roads than
//                       at the previous reading (a closed motorway, an
//                       accident), or other lines by public transport: the
//                       main roads (route labels) or the lines change;
//   - `budget_alert`    a SKU reaches 80 % of its monthly budget (`warning`),
//                       then 100 % (`exhausted`): once each per month;
//   - `api_key_refused` HERE starts refusing the key (missing, invalid or
//                       revoked, credentials not allowed): once, until a
//                       request succeeds again.
// The traffic delay, the travel time and the distance are device features:
// "the delay goes above 10 minutes" is a device-state trigger of Gladys,
// not one of the integration.
//
// Actions:
//   - `compute_route`   any trip, now (origin, destination, mode, traffic,
//                       avoid): travel time, traffic delay, distance, route,
//                       departure and arrival times, summary;
//   - `refresh_trip`    read a declared trip now, outside its hours too, and
//                       update its device (same outputs).
// Every event value is a flat scalar; never an event as the consequence of
// an action.
// -----------------------------------------------------------------------------

import { idsOf, toMinutes, toKm } from './device.js';
import { hasTraffic } from './here-api.js';
import { t, formatNumber } from './i18n.js';

const TRIGGERS = {
  ROUTE_CHANGED: 'route_changed',
  BUDGET_ALERT: 'budget_alert',
  API_KEY_REFUSED: 'api_key_refused',
};
const SCENE_ACTIONS = { COMPUTE_ROUTE: 'compute_route', REFRESH_TRIP: 'refresh_trip' };
const BUDGET_LEVELS = { WARNING: 'warning', EXHAUSTED: 'exhausted' };
// Share of the budget of a SKU that fires the warning.
const WARNING_SHARE = 0.8;

/**
 * @description The sentence of a reading, for a message or a voice.
 * @param {string} name - The name of the trip.
 * @param {object} trip - Its mode and traffic (`{ mode, traffic }`).
 * @param {object} reading - The reading (seconds and meters).
 * @param {string} language - The language.
 * @returns {string} The sentence.
 * @example
 * summaryOf('Work', { mode: 'car' }, reading, 'en'); // -> 'Work: 32 min, 7 min of traffic, 24.5 km via A6.'
 */
function summaryOf(name, trip, reading, language) {
  const values = {
    name,
    duration: toMinutes(reading.duration),
    delay: toMinutes(reading.delay),
    distance: formatNumber(toKm(reading.distanceMeters), language),
    route: reading.description
      ? t('summaryRouteSuffix', language, { route: reading.description })
      : '',
  };
  if (trip.mode === 'transit') {
    if (!reading.description) return t('summaryWalk', language, values);
    const late = toMinutes(reading.transitDelay ?? 0);
    return t('summaryTransit', language, {
      ...values,
      lines: reading.description,
      departure: reading.departure || '?',
      arrival: reading.arrival || '?',
      changes: reading.changes ?? 0,
      late: late >= 1 ? t('summaryTransitLate', language, { n: late }) : '',
    });
  }
  if (!hasTraffic(trip)) return t('summaryNoTraffic', language, values);
  return t(values.delay >= 1 ? 'summaryTraffic' : 'summaryNoDelay', language, values);
}

/**
 * @description The outputs of both scene actions.
 * @param {string} name - The name of the trip (or "origin → destination").
 * @param {object} trip - Its mode and traffic.
 * @param {object} reading - The reading.
 * @param {string} language - The language of the summary.
 * @returns {object} The declared outputs, scalars only.
 */
function readingOutputs(name, trip, reading, language) {
  return {
    duration: toMinutes(reading.duration),
    duration_no_traffic: toMinutes(reading.staticDuration),
    traffic_delay: toMinutes(reading.delay),
    distance: toKm(reading.distanceMeters),
    route: reading.description,
    departure_time: reading.departure ?? '',
    arrival_time: reading.arrival ?? '',
    summary: summaryOf(name, trip, reading, language).slice(0, 1000),
  };
}

/**
 * @description The data of a route_changed event.
 * @param {object} gladys - The SDK client (external ids).
 * @param {object} trip - The trip.
 * @param {string} previous - The previous route.
 * @param {object} reading - The new reading.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function routeChangedData(gladys, trip, previous, reading, language) {
  return {
    trip: idsOf(gladys, trip.id).device,
    name: trip.name,
    route: reading.description,
    previous_route: previous,
    duration: toMinutes(reading.duration),
    traffic_delay: toMinutes(reading.delay),
    distance: toKm(reading.distanceMeters),
    summary: t('routeChangedSummary', language, {
      name: trip.name,
      route: reading.description,
      previous,
      duration: toMinutes(reading.duration),
    }).slice(0, 1000),
  };
}

/**
 * @description The budget level reached by a count.
 * @param {number} used - Requests of the month.
 * @param {number} budget - The monthly budget.
 * @returns {string|null} warning, exhausted, or null.
 */
function budgetLevel(used, budget) {
  if (used >= budget) return BUDGET_LEVELS.EXHAUSTED;
  if (used >= Math.ceil(budget * WARNING_SHARE)) return BUDGET_LEVELS.WARNING;
  return null;
}

/**
 * @description The data of a budget_alert event.
 * @param {string} level - warning or exhausted.
 * @param {string} sku - The SKU.
 * @param {number} used - Requests of the month.
 * @param {number} budget - The monthly budget.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function budgetData(level, sku, used, budget, language) {
  const values = { used, budget, sku: t(`sku_${sku}`, language) };
  return {
    level,
    sku,
    used,
    budget,
    summary: t(
      level === BUDGET_LEVELS.EXHAUSTED ? 'budgetExhaustedSummary' : 'budgetWarningSummary',
      language,
      values,
    ),
  };
}

/**
 * @description The data of an api_key_refused event.
 * @param {string} reason - The reason (API_KEY_INVALID, FORBIDDEN…).
 * @param {string} hint - What to do, in the language.
 * @param {string} language - The language of the summary.
 * @returns {object} The flat data.
 */
function keyRefusedData(reason, hint, language) {
  return { reason, summary: t('apiErrorSummary', language, { reason, hint }).slice(0, 1000) };
}

export {
  TRIGGERS,
  SCENE_ACTIONS,
  BUDGET_LEVELS,
  WARNING_SHARE,
  summaryOf,
  readingOutputs,
  routeChangedData,
  budgetLevel,
  budgetData,
  keyRefusedData,
};
