// -----------------------------------------------------------------------------
// The HERE Travel Time integration: every handler, registered on a Gladys
// client.
//
//   - the trips are declared with the configuration buttons (trips.js),
//     stored in the Gladys configuration; their places are coordinates, a
//     house of Gladys or an address geocoded once (places.js);
//   - one device per trip (device.js): travel time (with live traffic by car,
//     truck and scooter), time without traffic, traffic delay, distance,
//     route (main roads, or lines and times by public transport);
//   - the integration's own clock reads each trip on its days and hours, at
//     its interval (schedule.js), stretched when the trips would spend more
//     than the monthly budget of a SKU (usage.js);
//   - scene triggers (events.js): the route changes, the budget is almost or
//     fully used, HERE refuses the key;
//   - scene actions: compute any route now, read a trip now;
//   - dashboard widgets (widgets.js): the trips, one trip, the budget.
//
// Transport: cloud (HERE Routing, Public Transit and Geocoding & Search APIs,
// the user's own API key).
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK and a fake fetch (test/app.test.js).
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  guessLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
} from './config.js';
import { createRegistry, RegistryError, formatHours, tripFromFields, editedTrip } from './trips.js';
import { createState, DEFAULT_PATH } from './state.js';
import { createUsage, SKU_LIST } from './usage.js';
import {
  createHereApi,
  MODES,
  ApiKeyError,
  QuotaError,
  TripError,
  BudgetExceededError,
} from './here-api.js';
import { createPlaces, houseQuery, PlaceError, DEFAULT_GEOCODE_PATH } from './places.js';
import { isActive, planOf, plannedPerMonth } from './schedule.js';
import { resolveTimezone } from './time.js';
import { buildDevice, buildStates, idFromExternalId, featureSignature, toKm } from './device.js';
import {
  TRIGGERS,
  SCENE_ACTIONS,
  readingOutputs,
  routeChangedData,
  budgetLevel,
  budgetData,
  keyRefusedData,
  summaryOf,
} from './events.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  MAX_ITEMS,
  buildTripsWidget,
  buildTripWidget,
  buildBudgetWidget,
} from './widgets.js';
import { t, all, ago, isLanguage, formatNumber } from './i18n.js';

const ACTIONS = {
  ADD: 'add_trip',
  EDIT: 'edit_trip',
  REMOVE: 'remove_trip',
  LIST: 'list_trips',
  TEST_KEY: 'test_api_key',
};
const USAGE_PATH = '/data/usage.json';
// The clock is read this often: a trip is read within this delay of its
// due time.
const TICK_MS = 30 * 1000;
// Requests of one round are spaced: far under the rate limits of HERE.
const REQUEST_SPACING_MS = 1000;
// A trip read less than this ago is not read again by a button or an action.
const MIN_MANUAL_GAP_MS = 60 * 1000;
// After a 429, no request for this long.
const QUOTA_PAUSE_MS = 15 * 60 * 1000;
// A refused key is tried again this often (the user may fix the Cloud project
// without touching the key).
const KEY_RETRY_MS = 60 * 60 * 1000;
// requestWidgetRefresh: at most once every 10 s per widget.
const WIDGET_REFRESH_GAP_MS = 10 * 1000;
// The walk the "Test the API key" button computes, Eiffel Tower → Louvre,
// from coordinates and without traffic: one routing request, no geocoding.
const TEST_TRIP = {
  name: 'Test',
  mode: 'pedestrian',
  traffic: false,
  from: { lat: 48.8584, lng: 2.2945 },
  to: { lat: 48.8606, lng: 2.3376 },
};

/**
 * @description The TEXTS key of what to do about a refused key.
 * @param {string|null} reason - The reason (API_KEY_INVALID, FORBIDDEN…).
 * @returns {string} The key.
 */
function hintKey(reason) {
  const known = ['API_KEY_MISSING', 'API_KEY_INVALID', 'FORBIDDEN'];
  return known.includes(reason) ? `hint_${reason}` : 'hint_default';
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.now] - `() => Date` (tests).
 * @param {string} [options.timezone] - IANA timezone (default: TZ).
 * @param {Function} [options.fetchImpl] - `fetch` (tests).
 * @param {string|null} [options.statePath] - File of the state.
 * @param {string|null} [options.usagePath] - File of the usage counter.
 * @param {string|null} [options.geocodePath] - File of the geocoding cache.
 * @param {Function} [options.sleep] - `(ms) => Promise` (tests).
 * @param {Function} [options.newId] - Identifier of a new trip (tests).
 * @param {number} [options.tickMs] - Clock period, 0 for none (tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ tick: Function, registry: object, usage: object, stop: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    now = () => new Date(),
    timezone = resolveTimezone(),
    fetchImpl = fetch,
    statePath = DEFAULT_PATH,
    usagePath = USAGE_PATH,
    geocodePath = DEFAULT_GEOCODE_PATH,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    newId,
    tickMs = TICK_MS,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the language of the texts Gladys
  // does not ask for in a language, when the `language` setting is `auto`.
  let language = guessLanguage(timezone);
  let timer = null;
  let running = Promise.resolve();
  let lastStatus = null;
  // missing, unknown (no request yet), ok, refused.
  let keyState = 'missing';
  let keyReason = null;
  let keyRefusedAt = 0;
  let plan = { intervals: new Map(), planned: {}, effective: {}, stretched: {} };
  const widgetRefreshedAt = new Map();

  const registry = createRegistry(gladys, { logger, ...(newId ? { newId } : {}) });
  const state = createState({ path: statePath, logger });
  const usage = createUsage({
    path: usagePath,
    getPercent: () => config.budgetPercent,
    now: () => now().getTime(),
    logger,
  });
  const api = createHereApi({ getApiKey: () => config.apiKey, usage, fetchImpl, logger });
  const places = createPlaces({
    api,
    getHouses: () => gladys.getHouses(),
    path: geocodePath,
    now: () => ms(),
    logger,
  });

  const ms = () => now().getTime();
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);
  const thresholdOf = (trip) => trip.threshold ?? config.delayThreshold;
  const intervalOf = (trip) =>
    plan.intervals.get(trip.id) ?? trip.interval ?? config.refreshMinutes;
  const createdIds = () =>
    new Set((gladys.devices ?? []).map((device) => idFromExternalId(device.external_id)));

  /** @description Compute the plan of the trips again. */
  function replan() {
    plan = planOf(registry.list(), {
      defaultInterval: config.refreshMinutes,
      budget: (sku) => usage.budget(sku),
    });
  }

  /**
   * @description The requests of the month, as text.
   * @param {string} lang - The language.
   * @returns {string} The text.
   */
  function usageText(lang) {
    const skus = SKU_LIST.filter((sku) => (plan.planned[sku] ?? 0) > 0 || usage.used(sku) > 0);
    if (skus.length === 0) return t('statusNoUsage', lang);
    return skus
      .map((sku) =>
        t('statusUsage', lang, {
          used: formatNumber(usage.used(sku), lang),
          budget: formatNumber(usage.budget(sku), lang),
          sku: t(`sku_${sku}`, lang),
        }),
      )
      .join(', ');
  }

  /**
   * @description Remember the language of a widget request, and store it
   * when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!isLanguage(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
    if (config.language === AUTO_LANGUAGE) {
      publishDiscovery();
    }
  }

  /** @description Offer every trip on the Discovery screen. */
  async function publishDiscovery() {
    if (!gladys.connected) return;
    try {
      await gladys.publishDiscoveredDevices(
        registry.list().map((trip) => buildDevice(gladys, trip, textLanguage())),
      );
    } catch (err) {
      logger.error('Unable to publish the discovered trips', err);
    }
  }

  /**
   * @description Publish the states of trips whose device exists (only the
   * changed values).
   * @param {object[]} trips - The trips.
   */
  async function publishStates(trips) {
    if (!gladys.connected) return;
    const created = createdIds();
    const states = trips.flatMap((trip) => {
      const reading = state.get(trip.id)?.reading;
      return reading && created.has(trip.id) ? buildStates(gladys, trip, reading) : [];
    });
    if (states.length === 0) return;
    try {
      await gladys.publishChangedStates(states);
    } catch (err) {
      logger.error('Unable to publish the states', err);
    }
  }

  /** @description Ask Gladys to fetch the widgets again (10 s apart at least). */
  function refreshWidgets() {
    if (!gladys.connected) return;
    Object.values(WIDGETS).forEach((key) => {
      const last = widgetRefreshedAt.get(key) ?? -Infinity;
      if (ms() - last < WIDGET_REFRESH_GAP_MS) return;
      widgetRefreshedAt.set(key, ms());
      try {
        gladys.requestWidgetRefresh(key);
      } catch (err) {
        logger.warn(`Unable to refresh the widget ${key}: ${err.message}`);
      }
    });
  }

  /** @description Show the trips and the requests of the month in the Configuration screen. */
  async function reportStatus() {
    let connected = true;
    let message;
    if (!config.apiKey) {
      connected = false;
      message = all('statusNoKey');
    } else if (keyState === 'refused') {
      connected = false;
      message = all((lang) =>
        t('statusKeyError', lang, { reason: keyReason, hint: t(hintKey(keyReason), lang) }),
      );
    } else if (registry.list().length === 0) {
      message = all('statusEmpty');
    } else {
      message = all((lang) =>
        t('statusOk', lang, { count: registry.list().length, usage: usageText(lang) }),
      );
    }
    const signature = JSON.stringify([connected, message]);
    if (!gladys.connected || signature === lastStatus) return;
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the status', err);
    }
  }

  /**
   * @description Fire a scene event; a refusal is logged, never thrown.
   * @param {string} key - The trigger.
   * @param {object} data - Its data.
   * @returns {Promise<boolean>} Whether Gladys accepted it.
   */
  async function fire(key, data) {
    try {
      await gladys.publishSceneEvent(key, data);
      return true;
    } catch (err) {
      logger.warn(`Scene event ${key} refused: ${err.message}`);
      return false;
    }
  }

  /**
   * @description The message of a failed request, in a language.
   * @param {Error} err - The error.
   * @param {string} lang - The language.
   * @returns {string} The message.
   */
  function errorMessage(err, lang) {
    if (err instanceof BudgetExceededError) {
      return t('errorBudget', lang, {
        budget: usage.budget(err.sku),
        sku: t(`sku_${err.sku}`, lang),
      });
    }
    if (err instanceof ApiKeyError) {
      return t('statusKeyError', lang, { reason: err.reason, hint: t(hintKey(err.reason), lang) });
    }
    if (err instanceof QuotaError) return t('errorQuota', lang);
    if (err instanceof PlaceError) return t(err.key, lang, err.params);
    if (err instanceof TripError) {
      if (err.reason === 'ADDRESS_NOT_FOUND') {
        return t('errorAddress', lang, { address: err.address ?? '' });
      }
      return t('errorTrip', lang, { message: err.message });
    }
    return t('errorUnreachable', lang, { message: err.message });
  }

  /**
   * @description The points of a trip: coordinates, a house of Gladys, or an
   * address (geocoded once, then from the cache).
   * @param {object} trip - `{ origin, destination }`.
   * @returns {Promise<{ from: object, to: object }>} The points.
   */
  async function pointsOf(trip) {
    const resolve = async (text) => {
      try {
        return await places.resolve(text, textLanguage());
      } catch (err) {
        if (err instanceof TripError && err.reason === 'ADDRESS_NOT_FOUND') err.address = text;
        throw err;
      }
    };
    const from = await resolve(trip.origin);
    const to = await resolve(trip.destination);
    return { from, to };
  }

  /**
   * @description Read one trip now, store the reading and publish its states.
   * A refused key, a 429 or a spent budget change the state of the whole
   * integration; any other error stays with the trip.
   * @param {object} trip - The trip.
   * @param {object} [options] - Options.
   * @param {boolean} [options.manual] - A button or an action (no scene event).
   * @returns {Promise<object>} The reading.
   * @throws {Error} The error of the request.
   */
  async function read(trip, { manual = false } = {}) {
    const previous = state.get(trip.id)?.reading ?? null;
    let reading;
    try {
      const { from, to } = await pointsOf(trip);
      reading = await api.route(trip, from, to, textLanguage());
    } catch (err) {
      state.failure(
        trip.id,
        { reason: err.reason ?? null, message: err.message.slice(0, 200) },
        ms(),
      );
      if (err instanceof ApiKeyError) {
        keyState = config.apiKey ? 'refused' : 'missing';
        keyReason = err.reason;
        keyRefusedAt = ms();
      } else if (err instanceof QuotaError) {
        state.pause(ms() + QUOTA_PAUSE_MS);
      }
      logger.warn(`Trip ${trip.id}: ${err.message}`);
      await reportStatus();
      throw err;
    }
    const stored = { ...reading };
    delete stored.sku;
    state.reading(trip.id, stored, ms());
    if (keyState !== 'ok') {
      keyState = 'ok';
      keyReason = null;
      state.setFlag('key_refused', false);
    }
    await publishStates([trip]);
    if (
      !manual &&
      previous?.signature &&
      stored.signature &&
      previous.signature !== stored.signature
    ) {
      await fire(
        TRIGGERS.ROUTE_CHANGED,
        routeChangedData(gladys, trip, previous.description, stored, textLanguage()),
      );
    }
    await reportStatus();
    return stored;
  }

  /** @description Fire the budget alerts not fired yet this month. */
  async function checkBudget() {
    for (const sku of SKU_LIST) {
      const used = usage.used(sku);
      const budget = usage.budget(sku);
      const level = budgetLevel(used, budget);
      if (!level) continue;
      const flag = `budget:${usage.month()}:${sku}:${level}`;
      if (state.flag(flag)) continue;
      if (await fire(TRIGGERS.BUDGET_ALERT, budgetData(level, sku, used, budget, textLanguage()))) {
        state.setFlag(flag, true);
        // An exhausted budget implies its warning: never fire it after.
        if (level === 'exhausted') state.setFlag(`budget:${usage.month()}:${sku}:warning`, true);
      }
    }
  }

  /** @description Fire the refused-key event once per refusal. */
  async function checkKey() {
    if (keyState !== 'refused' || state.flag('key_refused')) return;
    const data = keyRefusedData(keyReason, t(hintKey(keyReason), textLanguage()), textLanguage());
    if (await fire(TRIGGERS.API_KEY_REFUSED, data)) state.setFlag('key_refused', true);
  }

  /**
   * @description One look at the clock: read the trips that are due (in
   * their hours, their interval elapsed), one after the other. Never two
   * rounds at once.
   * @returns {Promise<void>}
   */
  function tick() {
    running = running.then(async () => {
      if (!gladys.connected) return;
      await checkKey();
      await checkBudget();
      if (!config.apiKey || ms() < state.pausedUntil()) return;
      if (keyState === 'refused' && ms() - keyRefusedAt < KEY_RETRY_MS) return;
      const date = now();
      const due = registry.list().filter((trip) => {
        if (!isActive(trip, date, timezone)) return false;
        const attempt = state.get(trip.id)?.attempt ?? 0;
        return ms() - attempt >= intervalOf(trip) * 60 * 1000;
      });
      let readings = 0;
      for (const [index, trip] of due.entries()) {
        if (index > 0) await sleep(REQUEST_SPACING_MS);
        try {
          await read(trip);
          readings += 1;
        } catch (err) {
          // The whole round stops on what concerns every trip.
          if (err instanceof ApiKeyError || err instanceof QuotaError) break;
        }
      }
      if (due.length > 0) {
        if (readings > 0) refreshWidgets();
        await checkKey();
        await checkBudget();
      }
    });
    running = running.catch((err) => logger.error('Clock round failed', err));
    return running;
  }

  /** @description Everything that follows a change of the trips. */
  async function tripsChanged() {
    replan();
    state.keep(registry.list().map((trip) => trip.id));
    await publishDiscovery();
    await publishStates(registry.list());
    refreshWidgets();
    await reportStatus();
  }

  /**
   * @description A one-line description of a trip.
   * @param {object} trip - The trip.
   * @param {string} lang - The language.
   * @returns {string} The line.
   */
  function describe(trip, lang) {
    const current = state.get(trip.id);
    const avoid = [
      trip.avoidTolls ? t('avoidTolls', lang) : null,
      trip.avoidHighways ? t('avoidHighways', lang) : null,
      trip.avoidFerries ? t('avoidFerries', lang) : null,
    ].filter(Boolean);
    const interval = intervalOf(trip);
    const own = trip.interval ?? config.refreshMinutes;
    const last = current?.reading
      ? `${summaryOf(trip.name, trip, current.reading, lang)} (${ago(current.at, ms(), lang)})`
      : t('never', lang);
    if (trip.mode === 'car' && trip.traffic === false) avoid.unshift(t('noLiveTraffic', lang));
    return (
      t('listLine', lang, {
        n: registry.numberOf(trip),
        name: trip.name,
        mode: t(`mode_${trip.mode}`, lang),
        avoid: avoid.length > 0 ? ` (${avoid.join(', ')})` : '',
        days: t(`days_${trip.days}`, lang),
        hours: formatHours(trip.hours),
        interval,
        planned: formatNumber(plannedPerMonth(trip, interval), lang),
        last,
      }) +
      (interval > own ? t('listStretched', lang, { interval: own }) : '') +
      (current?.error ? t('listError', lang, { message: current.error.message }) : '')
    );
  }

  /**
   * @description Run a change of the registry, turning its errors into a
   * message in the language of the integration.
   * @param {Function} change - `() => Promise`.
   * @returns {Promise<*>} The result of the change.
   */
  async function guarded(change) {
    try {
      return await change();
    } catch (err) {
      if (err instanceof RegistryError) {
        throw new Error(t(err.key, textLanguage(), err.params), { cause: err });
      }
      throw new Error(t('errorSave', textLanguage(), { message: err.message }), { cause: err });
    }
  }

  /**
   * @description Read a trip now for a button or an action, unless it was
   * read a moment ago (the reading is then kept: no request).
   * @param {object} trip - The trip.
   * @returns {Promise<object>} The reading.
   * @throws {Error} The error of the request, in the language of the texts.
   */
  async function readNow(trip) {
    const current = state.get(trip.id);
    if (current?.reading && ms() - current.at < MIN_MANUAL_GAP_MS) {
      return current.reading;
    }
    if (ms() < state.pausedUntil()) {
      throw new Error(t('errorQuota', textLanguage()));
    }
    try {
      return await read(trip, { manual: true });
    } catch (err) {
      throw new Error(errorMessage(err, textLanguage()), { cause: err });
    }
  }

  /**
   * @description Check the places of a trip being added or edited: an
   * address HERE does not know refuses the form; anything else (no key yet,
   * refused key, budget, network) lets it through, the first reading tells.
   * @param {object} trip - `{ origin, destination }`.
   * @returns {Promise<object|string>} The resolved places as a message of
   *   the four languages, or '' when they were not checked.
   * @throws {Error} When an address or a house is not found.
   */
  async function checkPlaces(trip) {
    if (!config.apiKey) return '';
    try {
      const { from, to } = await pointsOf(trip);
      return all((lang) => t('placesLine', lang, { from: from.label, to: to.label }));
    } catch (err) {
      if (err instanceof PlaceError || (err instanceof TripError && err.address)) {
        throw new Error(errorMessage(err, textLanguage()), { cause: err });
      }
      if (err instanceof ApiKeyError) {
        keyState = 'refused';
        keyReason = err.reason;
        keyRefusedAt = ms();
      } else if (err instanceof QuotaError) {
        state.pause(ms() + QUOTA_PAUSE_MS);
      }
      logger.warn(`Places not checked: ${err.message}`);
      return '';
    }
  }

  // --- Configuration buttons ------------------------------------------------
  gladys.onAction(ACTIONS.ADD, async (fields = {}) => {
    // The form is checked first (no request for a wrong form), the places
    // then, before anything is saved.
    const draft = await guarded(async () => tripFromFields(fields, '00000000'));
    const placesLine = await checkPlaces(draft);
    const trip = await guarded(() => registry.add(fields));
    logger.info(`Trip ${trip.id} added`);
    await tripsChanged();
    await tick();
    return all(
      (lang) =>
        t('added', lang, { line: describe(trip, lang) }) + (placesLine ? placesLine[lang] : ''),
    );
  });

  gladys.onAction(ACTIONS.EDIT, async (fields = {}) => {
    const current = await guarded(async () => registry.find(fields.trip));
    const draft = await guarded(async () => editedTrip(current, fields));
    const moved = draft.origin !== current.origin || draft.destination !== current.destination;
    const placesLine = moved ? await checkPlaces(draft) : '';
    const { before, after } = await guarded(() => registry.edit(fields));
    logger.info(`Trip ${after.id} edited`);
    await tripsChanged();
    await tick();
    const featuresChanged = featureSignature(before) !== featureSignature(after);
    return all(
      (lang) =>
        t('edited', lang, { line: describe(registry.byId(after.id), lang) }) +
        (placesLine ? placesLine[lang] : '') +
        (featuresChanged ? t('editedFeatures', lang) : ''),
    );
  });

  gladys.onAction(ACTIONS.REMOVE, async (fields = {}) => {
    const trip = await guarded(() => registry.remove(fields.trip));
    logger.info(`Trip ${trip.id} removed`);
    await tripsChanged();
    return all('removed', { name: trip.name });
  });

  gladys.onAction(ACTIONS.LIST, async () => {
    const trips = registry.list();
    if (trips.length === 0) {
      return all('listEmpty');
    }
    return all((lang) =>
      [
        t('listHeader', lang, { count: trips.length, timezone, usage: usageText(lang) }),
        ...trips.map((trip) => describe(trip, lang)),
      ].join('\n'),
    );
  });

  gladys.onAction(ACTIONS.TEST_KEY, async () => {
    let reading;
    try {
      reading = await api.route(TEST_TRIP, TEST_TRIP.from, TEST_TRIP.to, textLanguage());
    } catch (err) {
      if (err instanceof ApiKeyError) {
        keyState = config.apiKey ? 'refused' : 'missing';
        keyReason = err.reason;
        keyRefusedAt = ms();
        await reportStatus();
      } else if (err instanceof QuotaError) {
        state.pause(ms() + QUOTA_PAUSE_MS);
      }
      throw new Error(errorMessage(err, textLanguage()), { cause: err });
    }
    keyState = 'ok';
    keyReason = null;
    state.setFlag('key_refused', false);
    await reportStatus();
    refreshWidgets();
    return all((lang) =>
      t('testOk', lang, {
        duration: Math.round(reading.duration / 60),
        distance: formatNumber(toKm(reading.distanceMeters), lang),
        sku: t(`sku_${reading.sku}`, lang),
      }),
    );
  });

  // --- Scene actions --------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.COMPUTE_ROUTE, async (fields = {}) => {
    const origin = String(fields.origin ?? '').trim();
    const destination = String(fields.destination ?? '').trim();
    if (origin.length < 2 || origin.length > 200) {
      throw new Error(t('errorOrigin', textLanguage(), { max: 200 }));
    }
    if (destination.length < 2 || destination.length > 200) {
      throw new Error(t('errorDestination', textLanguage(), { max: 200 }));
    }
    const mode = MODES.includes(fields.mode) ? fields.mode : 'car';
    const trip = {
      name: `${origin} → ${destination}`.slice(0, 120),
      origin,
      destination,
      mode,
      traffic: fields.traffic !== false,
      avoidTolls: fields.avoid_tolls === true,
      avoidHighways: fields.avoid_highways === true,
      avoidFerries: fields.avoid_ferries === true,
    };
    if (ms() < state.pausedUntil()) throw new Error(t('errorQuota', textLanguage()));
    let reading;
    try {
      const { from, to } = await pointsOf(trip);
      reading = await api.route(trip, from, to, textLanguage());
    } catch (err) {
      if (err instanceof QuotaError) state.pause(ms() + QUOTA_PAUSE_MS);
      throw new Error(errorMessage(err, textLanguage()), { cause: err });
    }
    return readingOutputs(trip.name, trip, reading, textLanguage());
  });

  gladys.onSceneAction(SCENE_ACTIONS.REFRESH_TRIP, async (fields = {}) => {
    const trip = registry.byId(idFromExternalId(fields.trip));
    if (!trip) throw new Error(t('errorUnknownDevice', textLanguage()));
    const reading = await readNow(trip);
    refreshWidgets();
    return readingOutputs(trip.name, trip, reading, textLanguage());
  });

  // --- Widgets --------------------------------------------------------------
  /**
   * @description The trips of a widget, with what it shows of each.
   * @param {object[]} trips - The trips.
   * @returns {object[]} `{ trip, state, threshold, active }`.
   */
  const shownTrips = (trips) =>
    trips.map((trip) => ({
      trip,
      state: state.get(trip.id),
      threshold: thresholdOf(trip),
      active: isActive(trip, now(), timezone),
      points: { from: places.known(trip.origin), to: places.known(trip.destination) },
    }));

  gladys.onWidgetGet(WIDGETS.TRIPS, async ({ settings = {}, language: lang, units } = {}) => {
    rememberLanguage(lang);
    const wanted = new Set(
      []
        .concat(settings.trips ?? [])
        .filter(Boolean)
        .map(idFromExternalId),
    );
    const trips = registry.list().filter((trip) => wanted.size === 0 || wanted.has(trip.id));
    return buildTripsWidget({
      trips: shownTrips(trips),
      hasKey: Boolean(config.apiKey),
      language: isLanguage(lang) ? lang : textLanguage(),
      units,
      now: ms(),
    });
  });

  gladys.onWidgetGet(WIDGETS.TRIP, async ({ settings = {}, language: lang, units } = {}) => {
    rememberLanguage(lang);
    const trip = registry.byId(idFromExternalId(settings.trip)) ?? null;
    return buildTripWidget({
      trip,
      state: trip ? state.get(trip.id) : null,
      threshold: trip ? thresholdOf(trip) : config.delayThreshold,
      chosen: Boolean(settings.trip),
      hasKey: Boolean(config.apiKey),
      language: isLanguage(lang) ? lang : textLanguage(),
      units,
      now: ms(),
    });
  });

  gladys.onWidgetGet(WIDGETS.BUDGET, async ({ language: lang } = {}) => {
    rememberLanguage(lang);
    const paused = ms() < state.pausedUntil();
    return buildBudgetWidget({
      usage,
      planned: plan.effective,
      percent: config.budgetPercent,
      keyState: paused && keyState !== 'refused' ? 'paused' : keyState,
      language: isLanguage(lang) ? lang : textLanguage(),
    });
  });

  /**
   * @description The refresh buttons. The answer is a toast (200 characters
   * at most), a refused request included: the user reads why.
   * @param {string} actionKey - The action of the button.
   * @param {object} params - Its params (sent by the content: trip ids).
   * @returns {Promise<object>} The toast, in every language.
   */
  async function widgetAction(actionKey, params = {}) {
    const ids =
      actionKey === WIDGET_ACTIONS.REFRESH
        ? [params.trip]
        : actionKey === WIDGET_ACTIONS.REFRESH_ALL
          ? [].concat(params.trips ?? []).slice(0, MAX_ITEMS)
          : null;
    if (ids === null) {
      throw new Error(`Unknown widget action ${actionKey}`);
    }
    const trips = ids.map((id) => registry.byId(id)).filter(Boolean);
    if (trips.length === 0) {
      return all((lang) => t('widgetUnknownTrip', lang).slice(0, 200));
    }
    let count = 0;
    let lastReading = null;
    for (const [index, trip] of trips.entries()) {
      if (index > 0) await sleep(REQUEST_SPACING_MS);
      try {
        lastReading = await readNow(trip);
        count += 1;
      } catch (err) {
        const cause = err.cause ?? err;
        return all((lang) => errorMessage(cause, lang).slice(0, 200));
      }
    }
    refreshWidgets();
    if (trips.length === 1) {
      return all((lang) =>
        t('toastRefreshed', lang, {
          summary: summaryOf(trips[0].name, trips[0], lastReading, lang),
        }).slice(0, 200),
      );
    }
    return all((lang) => t('toastRefreshedAll', lang, { count }).slice(0, 200));
  }
  gladys.onWidgetAction(WIDGETS.TRIPS, widgetAction);
  gladys.onWidgetAction(WIDGETS.TRIP, widgetAction);

  // --- Devices and configuration --------------------------------------------
  gladys.onScanRequest(async () => {
    await publishDiscovery();
  });

  gladys.onDeviceCreated(async (device) => {
    const trip = registry.byId(idFromExternalId(device.external_id));
    if (trip) await publishStates([trip]);
    refreshWidgets();
  });

  gladys.onDeviceUpdated(async (device) => {
    const trip = registry.byId(idFromExternalId(device.external_id));
    if (trip) await publishStates([trip]);
  });

  gladys.onConfigUpdated(async (raw) => {
    const previous = { language: textLanguage(), apiKey: config.apiKey };
    config = normalizeConfig(raw);
    if (config.apiKey !== previous.apiKey) {
      keyState = config.apiKey ? 'unknown' : 'missing';
      keyReason = null;
      keyRefusedAt = 0;
      state.setFlag('key_refused', false);
    }
    replan();
    if (textLanguage() !== previous.language) {
      await publishDiscovery();
    }
    refreshWidgets();
    await reportStatus();
    await tick();
  });

  gladys.on('connected', async () => {
    const raw = gladys.config ?? {};
    config = normalizeConfig(raw);
    language = readLanguage(raw, language);
    registry.load(raw);
    state.keep(registry.list().map((trip) => trip.id));
    if (registry.list().some((trip) => houseQuery(trip.origin) || houseQuery(trip.destination))) {
      await places.refreshHouses();
    }
    if (!config.apiKey) keyState = 'missing';
    else if (keyState === 'missing') keyState = 'unknown';
    replan();
    lastStatus = null;
    logger.info(`${registry.list().length} trip(s), timezone ${timezone}`);
    await publishDiscovery();
    await publishStates(registry.list());
    await reportStatus();
    await tick();
    if (tickMs > 0 && timer === null) {
      timer = setInterval(() => tick(), tickMs);
      timer.unref?.();
    }
  });

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stop();
    await running;
  });

  return { tick, registry, usage, stop };
}

export { ACTIONS, TICK_MS, TEST_TRIP, hintKey, createApp };
