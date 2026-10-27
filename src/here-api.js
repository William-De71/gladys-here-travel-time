// -----------------------------------------------------------------------------
// Client of the HERE APIs: Routing API v8, Public Transit API v8 and the
// Geocoding & Search API v7 (geocode only).
//
// Documented contract (OpenAPI specs served by the APIs themselves, read on
// 2026-10-26: router.hereapi.com/v8/openapi 8.165.0,
// transit.router.hereapi.com/v8/openapi 8.0.1, docs.here.com Geocoding and
// Search API v7 7.162):
//   GET https://router.hereapi.com/v8/routes
//       transportMode car | truck | scooter | bicycle | pedestrian,
//       origin / destination "lat,lng", return=summary,routeLabels, lang,
//       departureTime=any (planning mode: no time-aware information),
//       avoid[features]=tollRoad,controlledAccessHighway,ferry,
//       scooter[allowHighway]=true.
//       Answer: routes[0].sections[].summary { duration, baseDuration, length }
//       (seconds, meters; a ferry section has no baseDuration), departure /
//       arrival { time }, routes[0].routeLabels[].name.value. No route: 200
//       with `routes: []` and a critical notice (noRouteFound,
//       couldNotMatchOrigin…).
//   GET https://transit.router.hereapi.com/v8/routes
//       origin / destination "lat,lng", return=travelSummary, lang.
//       Answer: sections of type pedestrian / transit with departure / arrival
//       { time, place { name }, delay }, transport { mode, name, category,
//       headsign }, travelSummary { duration, length }. No route: `routes: []`
//       and a notice (noRouteFound, noCoverage, noStationsFound…).
//   GET https://geocode.search.hereapi.com/v1/geocode?q=…&limit=1&lang=…
//       Answer: items[0].position { lat, lng }, items[0].title.
// Authentication: the `apiKey` query parameter (the only key-based scheme of
// the three APIs, the other one is an OAuth bearer token). The URL therefore
// holds the key: it is never logged, and every message is scrubbed of it.
// Errors: 401 { error, error_description } for a missing or invalid key; 403
// for credentials not allowed (simple error) or a region not allowed
// (E605101); 400 { title, status, code, cause } for a malformed request; 429
// too many requests.
//
// Billing (HERE Base plan, pricing data of www.here.com/get-started/pricing
// read on 2026-10-26; 1 transaction per request):
//   time_aware  car with live traffic (Time aware routing)    5,000 free/month
//   routing     car without traffic (departureTime=any),
//               bicycle, pedestrian                            30,000 free/month
//   truck       Routing Truck                                  5,000 free/month
//   scooter     Routing Scooter                                5,000 free/month
//   transit     Public Transit                                 5,000 free/month
//   geocode     Geocode and Reverse Geocode                    30,000 free/month
// HERE: "Routing Car is without time-aware information. You must specify
// either departureTime=any or traffic[mode]=disabled in your API request to
// use this mode. Otherwise, usage will be billed as Time-Aware Routing" — so
// every request without traffic sends departureTime=any.
// -----------------------------------------------------------------------------

const ROUTING_URL = 'https://router.hereapi.com/v8/routes';
const TRANSIT_URL = 'https://transit.router.hereapi.com/v8/routes';
const GEOCODE_URL = 'https://geocode.search.hereapi.com/v1/geocode';
const TIMEOUT_MS = 15 * 1000;

const MODES = ['car', 'truck', 'scooter', 'bicycle', 'pedestrian', 'transit'];
// The modes whose route goes on roads with traffic, and take the avoid options.
const ROAD_MODES = ['car', 'truck', 'scooter'];
const SKUS = {
  TIME_AWARE: 'time_aware',
  ROUTING: 'routing',
  TRUCK: 'truck',
  SCOOTER: 'scooter',
  TRANSIT: 'transit',
  GEOCODE: 'geocode',
};
// Free transactions per month and per SKU (HERE Base plan).
const FREE_USAGE = {
  time_aware: 5000,
  routing: 30000,
  truck: 5000,
  scooter: 5000,
  transit: 5000,
  geocode: 30000,
};
// BCP 47 codes of the languages of the integration, for the texts of HERE.
const HERE_LANGUAGES = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
// Road names kept from the route labels ("A6, A7, D383").
const MAX_LABELS = 3;

/** @description Any failure of a HERE API. */
class HereError extends Error {
  /**
   * @param {string} message - The message (never contains the key).
   * @param {number|null} status - The HTTP status (null: network).
   * @param {string|null} [reason] - The HERE code or notice, or ours.
   */
  constructor(message, status, reason = null) {
    super(message);
    this.name = 'HereError';
    this.status = status;
    this.reason = reason;
  }
}

/**
 * @description The key is missing, invalid, or its credentials are not
 * allowed to use the API. Retrying will not help until the user acts.
 */
class ApiKeyError extends HereError {
  constructor(message, status, reason) {
    super(message, status, reason);
    this.name = 'ApiKeyError';
  }
}

/** @description HERE refused for rate or quota (429). */
class QuotaError extends HereError {
  constructor(message, status, reason) {
    super(message, status, reason);
    this.name = 'QuotaError';
  }
}

/**
 * @description The request of one trip is wrong: an address HERE cannot
 * place, a place off the road network, no route at all. The other trips go on.
 */
class TripError extends HereError {
  constructor(message, status, reason) {
    super(message, status, reason);
    this.name = 'TripError';
  }
}

/** @description The monthly budget of a SKU is spent. */
class BudgetExceededError extends HereError {
  /**
   * @param {string} sku - The SKU.
   * @param {number} budget - Its budget.
   */
  constructor(sku, budget) {
    super(`Monthly budget of ${budget} ${sku} requests reached`, null, 'BUDGET_EXCEEDED');
    this.name = 'BudgetExceededError';
    this.sku = sku;
  }
}

/**
 * @description Whether a trip is read with live traffic: always by truck and
 * scooter (their SKU is the same either way), by car unless the user turned
 * it off (30,000 free requests instead of 5,000).
 * @param {object} trip - `{ mode, traffic }`.
 * @returns {boolean} True with live traffic.
 * @example
 * hasTraffic({ mode: 'car', traffic: false }); // -> false
 */
function hasTraffic(trip) {
  if (trip.mode === 'car') return trip.traffic !== false;
  return trip.mode === 'truck' || trip.mode === 'scooter';
}

/**
 * @description The SKU a trip is billed under.
 * @param {object} trip - `{ mode, traffic }`.
 * @returns {string} One of SKUS.
 * @example
 * skuOf({ mode: 'car', traffic: true }); // -> 'time_aware'
 */
function skuOf(trip) {
  switch (trip.mode) {
    case 'truck':
      return SKUS.TRUCK;
    case 'scooter':
      return SKUS.SCOOTER;
    case 'transit':
      return SKUS.TRANSIT;
    case 'car':
      return hasTraffic(trip) ? SKUS.TIME_AWARE : SKUS.ROUTING;
    default:
      return SKUS.ROUTING;
  }
}

/**
 * @description Remove the key from a text (an URL in an error, a cause).
 * @param {string} text - The text.
 * @returns {string} The text without the key.
 */
const scrub = (text) => String(text ?? '').replace(/apiKey=[^&\s"']*/gi, 'apiKey=***');

/**
 * @description Read a HERE error body: the simple form `{ error,
 * error_description }` (authentication) or the service form `{ title, status,
 * code, cause, action }`.
 * @param {object|null} body - The parsed body.
 * @returns {{ message: string, code: string|null }} The error.
 */
function readError(body) {
  if (!body || typeof body !== 'object') return { message: '', code: null };
  const parts = [body.error, body.error_description, body.title, body.cause]
    .filter((part) => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim());
  return {
    message: scrub(parts.join(': ')).slice(0, 300),
    code: typeof body.code === 'string' ? body.code : null,
  };
}

/**
 * @description Turn an HTTP failure into the right error class.
 * @param {string} api - Name of the API, for the message.
 * @param {number} httpStatus - The HTTP status.
 * @param {object|null} body - The parsed body.
 * @returns {HereError} The error.
 * @example
 * classifyError('Routing API', 401, { error: 'Unauthorized', error_description: 'apiKey invalid. apiKey not found.' });
 */
function classifyError(api, httpStatus, body) {
  const { message, code } = readError(body);
  const text = `${api} ${httpStatus}${message ? `: ${message}` : ''}`;
  if (httpStatus === 401) {
    const missing = /no credentials/i.test(message);
    return new ApiKeyError(text, httpStatus, missing ? 'API_KEY_MISSING' : 'API_KEY_INVALID');
  }
  if (httpStatus === 403) {
    // E605101: a region the credentials may not route in (Japan): this trip
    // only. A simple error: the credentials are not allowed at all.
    if (code !== null) return new TripError(text, httpStatus, code);
    return new ApiKeyError(text, httpStatus, 'FORBIDDEN');
  }
  if (httpStatus === 429) {
    return new QuotaError(text, httpStatus, code ?? 'TOO_MANY_REQUESTS');
  }
  if (httpStatus === 400 || httpStatus === 404) {
    return new TripError(text, httpStatus, code ?? 'BAD_REQUEST');
  }
  return new HereError(text, httpStatus, code);
}

/**
 * @description The first critical notice of an answer without a route.
 * @param {object} body - The answer.
 * @returns {string} The notice code.
 */
function noticeOf(body) {
  const notices = Array.isArray(body?.notices) ? body.notices : [];
  const notice =
    notices.find((n) => n?.severity === 'critical' && typeof n.code === 'string') ??
    notices.find((n) => typeof n?.code === 'string');
  return notice?.code ?? 'noRouteFound';
}

/**
 * @description "lat,lng" of a point, 6 decimals (about 10 cm).
 * @param {{ lat: number, lng: number }} point - The point.
 * @returns {string} The text.
 */
const pointText = ({ lat, lng }) => `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`;

/**
 * @description The query of a Routing API request for a road, bicycle or
 * pedestrian trip.
 * @param {object} trip - `{ mode, traffic, avoidTolls, avoidHighways, avoidFerries }`.
 * @param {{ lat: number, lng: number }} origin - Start.
 * @param {{ lat: number, lng: number }} destination - End.
 * @param {string} language - en, fr, de or es.
 * @param {object} [options] - Options.
 * @param {boolean} [options.labels] - Ask for the route labels (main roads).
 * @returns {URLSearchParams} The query, without the key.
 */
function routingQuery(trip, origin, destination, language, { labels = true } = {}) {
  const query = new URLSearchParams({
    transportMode: trip.mode,
    origin: pointText(origin),
    destination: pointText(destination),
    return: labels ? 'summary,routeLabels' : 'summary',
    lang: HERE_LANGUAGES[language] ?? HERE_LANGUAGES.en,
  });
  if (!hasTraffic(trip)) {
    // Planning mode: no live traffic, billed as Routing (not Time-Aware).
    query.set('departureTime', 'any');
  }
  if (ROAD_MODES.includes(trip.mode)) {
    const avoid = [
      trip.avoidTolls ? 'tollRoad' : null,
      trip.avoidHighways ? 'controlledAccessHighway' : null,
      trip.avoidFerries ? 'ferry' : null,
    ].filter(Boolean);
    if (avoid.length > 0) query.set('avoid[features]', avoid.join(','));
    // HERE keeps scooters off motorways by default; the integration follows
    // the "Avoid motorways" choice of the user instead (motorcycles).
    if (trip.mode === 'scooter' && !trip.avoidHighways) {
      query.set('scooter[allowHighway]', 'true');
    }
  }
  return query;
}

/**
 * @description The query of a Public Transit API request.
 * @param {{ lat: number, lng: number }} origin - Start.
 * @param {{ lat: number, lng: number }} destination - End.
 * @param {string} language - en, fr, de or es.
 * @returns {URLSearchParams} The query, without the key.
 */
function transitQuery(origin, destination, language) {
  return new URLSearchParams({
    origin: pointText(origin),
    destination: pointText(destination),
    return: 'travelSummary',
    lang: HERE_LANGUAGES[language] ?? HERE_LANGUAGES.en,
  });
}

const finite = (value) => (Number.isFinite(value) ? value : null);

/**
 * @description The local time "HH:MM" of a HERE time ("2026-10-19T08:12:00+02:00"):
 * HERE gives each time in the timezone of its place.
 * @param {unknown} value - The time.
 * @returns {string} "HH:MM", or '' when unknown.
 */
function clockOf(value) {
  const match = /T(\d{2}:\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : '';
}

/**
 * @description Seconds between two HERE times.
 * @param {unknown} from - Start.
 * @param {unknown} to - End.
 * @returns {number|null} Seconds, null when unknown.
 */
function secondsBetween(from, to) {
  const start = Date.parse(String(from ?? ''));
  const end = Date.parse(String(to ?? ''));
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.round((end - start) / 1000)
    : null;
}

/**
 * @description The reading of a road, bicycle or pedestrian trip.
 * @param {object} body - The Routing API answer.
 * @param {object} trip - The trip (its mode and traffic).
 * @returns {object} `{ duration, staticDuration, delay, distanceMeters,
 *   description, signature, departure, arrival, changes, transitDelay }`.
 * @throws {TripError} When there is no route.
 */
function readRoute(body, trip) {
  const route = Array.isArray(body?.routes) ? body.routes[0] : undefined;
  const sections = Array.isArray(route?.sections) ? route.sections : [];
  if (!route || sections.length === 0 || sections.some((s) => !finite(s?.summary?.duration))) {
    const notice = noticeOf(body);
    throw new TripError(`No route found (${notice})`, 200, notice);
  }
  let duration = 0;
  let staticDuration = 0;
  let distanceMeters = 0;
  sections.forEach(({ summary }) => {
    duration += summary.duration;
    // A ferry section has no baseDuration: its duration does not depend on
    // the traffic.
    staticDuration += finite(summary.baseDuration) ?? summary.duration;
    distanceMeters += finite(summary.length) ?? 0;
  });
  if (!hasTraffic(trip)) staticDuration = duration;
  const labels = (Array.isArray(route.routeLabels) ? route.routeLabels : [])
    .map((label) => label?.name?.value)
    .filter((name) => typeof name === 'string' && name.trim() !== '')
    .map((name) => name.trim());
  const unique = [...new Set(labels)].slice(0, MAX_LABELS);
  const description = unique.join(', ').slice(0, 200);
  return {
    duration,
    staticDuration,
    // baseDuration can exceed duration when the traffic is faster than the
    // free-flow speed (HERE docs): the delay is never negative.
    delay: Math.max(0, duration - staticDuration),
    distanceMeters,
    description,
    signature: description,
    departure: clockOf(sections[0].departure?.time),
    arrival: clockOf(sections.at(-1).arrival?.time),
    changes: null,
    transitDelay: 0,
  };
}

/**
 * @description The name of a transit line: "Bus 21", "RER B", "U2".
 * @param {object} transport - The transport of a section.
 * @returns {string} The name.
 */
function lineName(transport) {
  const name = String(transport?.name ?? transport?.shortName ?? '').trim();
  const category = String(transport?.category ?? '').trim();
  if (!name) return category || String(transport?.mode ?? '');
  // "Bus 21", but not "RER RER B" nor "Train TER 123456".
  if (category && !name.toLowerCase().startsWith(category.toLowerCase()) && name.length <= 4) {
    return `${category} ${name}`;
  }
  return name;
}

/**
 * @description The reading of a public transport trip. Its travel time runs
 * from the first departure (walking from the origin) to the last arrival,
 * waits included; the route is the lines taken.
 * @param {object} body - The Public Transit API answer.
 * @returns {object} The reading (see readRoute), `changes` and `transitDelay`
 *   (the real-time delay announced at the last arrival, in seconds).
 * @throws {TripError} When there is no route.
 */
function readTransitRoute(body) {
  const routes = Array.isArray(body?.routes) ? body.routes : [];
  const hasTransit = (route) => (route?.sections ?? []).some((s) => s?.type === 'transit');
  // HERE may add a walking-only route: a route with a line comes first.
  const route = routes.find(hasTransit) ?? routes[0];
  const sections = Array.isArray(route?.sections) ? route.sections : [];
  if (!route || sections.length === 0) {
    const notice = noticeOf(body);
    throw new TripError(`No route found (${notice})`, 200, notice);
  }
  const rides = sections.filter((s) => s?.type === 'transit');
  const travel = sections.reduce((sum, s) => sum + (finite(s?.travelSummary?.duration) ?? 0), 0);
  const first = sections[0];
  const last = sections.at(-1);
  const duration = secondsBetween(first.departure?.time, last.arrival?.time) ?? travel;
  const lines = rides.map((s) => lineName(s.transport)).filter(Boolean);
  const lastRide = rides.at(-1);
  return {
    duration,
    staticDuration: duration,
    delay: 0,
    distanceMeters: sections.reduce((sum, s) => sum + (finite(s?.travelSummary?.length) ?? 0), 0),
    description: lines.join(' → ').slice(0, 200),
    signature: lines.join(' → ').slice(0, 200),
    // The first line leaves at:
    departure: clockOf((rides[0] ?? first).departure?.time),
    arrival: clockOf(last.arrival?.time),
    changes: Math.max(0, rides.length - 1),
    transitDelay: Math.max(0, finite(lastRide?.arrival?.delay) ?? 0),
  };
}

/**
 * @description The place of a Geocoding answer.
 * @param {object} body - The answer.
 * @returns {{ lat: number, lng: number, label: string }} The place.
 * @throws {TripError} When HERE found nothing.
 */
function readGeocode(body) {
  const item = Array.isArray(body?.items) ? body.items[0] : undefined;
  const lat = finite(item?.position?.lat);
  const lng = finite(item?.position?.lng);
  if (lat === null || lng === null) {
    throw new TripError('Address not found', 200, 'ADDRESS_NOT_FOUND');
  }
  const label = String(item.address?.label ?? item.title ?? '').slice(0, 200);
  return { lat, lng, label };
}

/**
 * @description Create the HERE client.
 * @param {object} options - Options.
 * @param {Function} options.getApiKey - `() => string`.
 * @param {object} options.usage - The usage counter (usage.js).
 * @param {Function} [options.fetchImpl] - `fetch` (injected by the tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ route: Function, geocode: Function }} The client.
 * @example
 * const api = createHereApi({ getApiKey: () => key, usage });
 */
function createHereApi({ getApiKey, usage, fetchImpl = fetch, logger = console }) {
  // Set when HERE refuses `return=routeLabels` (E605013, invalid return
  // options): the integration then asks without, the roads stay unnamed.
  let labels = true;

  /**
   * @description One GET, counted in its SKU when HERE answers 200.
   * @param {string} api - Name of the API, for the messages.
   * @param {string} url - The endpoint.
   * @param {URLSearchParams} query - The query, without the key.
   * @param {string} sku - The SKU.
   * @returns {Promise<object>} The parsed answer.
   */
  async function get(api, url, query, sku) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new ApiKeyError('No API key configured', null, 'API_KEY_MISSING');
    }
    if (usage.exhausted(sku)) {
      throw new BudgetExceededError(sku, usage.budget(sku));
    }
    const withKey = new URLSearchParams(query);
    withKey.set('apiKey', apiKey);
    let response;
    try {
      response = await fetchImpl(`${url}?${withKey}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new HereError(`${api} unreachable: ${scrub(err.message)}`, null);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      throw classifyError(api, response.status, body);
    }
    // HERE counts one transaction per request: a 200 without a route too.
    usage.record(sku);
    logger.debug?.(`${api} OK (${usage.used(sku)} ${sku} request(s) this month)`);
    return body;
  }

  return {
    /**
     * @description Compute the route of a trip, now.
     * @param {object} trip - The trip.
     * @param {{ lat: number, lng: number }} origin - Start.
     * @param {{ lat: number, lng: number }} destination - End.
     * @param {string} language - Language of the texts.
     * @returns {Promise<object>} The reading and its `sku`.
     */
    async route(trip, origin, destination, language) {
      const sku = skuOf(trip);
      if (trip.mode === 'transit') {
        const body = await get(
          'Public Transit API',
          TRANSIT_URL,
          transitQuery(origin, destination, language),
          sku,
        );
        return { ...readTransitRoute(body), sku };
      }
      let body;
      try {
        body = await get(
          'Routing API',
          ROUTING_URL,
          routingQuery(trip, origin, destination, language, { labels }),
          sku,
        );
      } catch (err) {
        if (!(labels && err instanceof TripError && err.reason === 'E605013')) throw err;
        labels = false;
        logger.warn('Routing API: route labels refused, the roads stay unnamed');
        body = await get(
          'Routing API',
          ROUTING_URL,
          routingQuery(trip, origin, destination, language, { labels }),
          sku,
        );
      }
      return { ...readRoute(body, trip), sku };
    },

    /**
     * @description The coordinates of an address.
     * @param {string} text - The address, as typed.
     * @param {string} language - Language of the label.
     * @returns {Promise<{ lat: number, lng: number, label: string }>} The place.
     */
    async geocode(text, language) {
      const query = new URLSearchParams({
        q: text,
        limit: '1',
        lang: HERE_LANGUAGES[language] ?? HERE_LANGUAGES.en,
      });
      const body = await get('Geocoding API', GEOCODE_URL, query, SKUS.GEOCODE);
      return readGeocode(body);
    },
  };
}

export {
  ROUTING_URL,
  TRANSIT_URL,
  GEOCODE_URL,
  MODES,
  ROAD_MODES,
  SKUS,
  FREE_USAGE,
  HERE_LANGUAGES,
  HereError,
  ApiKeyError,
  QuotaError,
  TripError,
  BudgetExceededError,
  hasTraffic,
  skuOf,
  scrub,
  readError,
  classifyError,
  pointText,
  routingQuery,
  transitQuery,
  clockOf,
  readRoute,
  lineName,
  readTransitRoute,
  readGeocode,
  createHereApi,
};
