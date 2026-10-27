// -----------------------------------------------------------------------------
// The registry of the trips the user declared with the configuration buttons
// ("Add a trip", "Edit a trip", "Remove a trip"): no JSON to type, a plain
// form whose fields are checked here.
//
// Stored through setConfig() under INTERNAL_KEYS.registry, a key outside the
// config_schema: the configuration lives in the Gladys database, so the trips
// follow the Gladys backups (/data does not). A change is applied in memory
// only once Gladys saved it, and changes run one after the other: two quick
// buttons never lose a trip.
//
// Each trip gets a random identifier at creation (8 hex digits), kept for
// ever: it builds the external ids of its device, never its name nor its
// addresses (an edited address keeps the device and its history).
// -----------------------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { INTERNAL_KEYS, REFRESH_MINUTES, DELAY_THRESHOLD } from './config.js';
import { MODES } from './here-api.js';
import { DAY_PRESETS, DEFAULT_DAYS, parseHours, formatHours } from './schedule.js';

// Far beyond a household; 50 trips read every 5 minutes would spend any
// budget anyway.
const MAX_TRIPS = 50;
const NAME_MAX = 60;
const PLACE_MAX = 200;
const KEEP = 'keep';
const ID_PATTERN = /^[0-9a-f]{8}$/;

class RegistryError extends Error {
  /**
   * @param {string} key - The TEXTS key of the message.
   * @param {object} [params] - Its substitutions.
   */
  constructor(key, params = {}) {
    super(key);
    this.key = key;
    this.params = params;
  }
}

const isEmpty = (value) => value === undefined || value === null || value === '';
const clean = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

/**
 * @description Read a whole number of a form (numbers can come as strings).
 * @param {unknown} raw - The value.
 * @returns {number|null|undefined} The number, null when empty, undefined when invalid.
 */
function readInteger(raw) {
  if (isEmpty(raw)) {
    return null;
  }
  const value = Number(typeof raw === 'string' ? raw.trim() : raw);
  return Number.isInteger(value) ? value : undefined;
}

/**
 * @description Read a boolean of a form, or of a keep/yes/no select.
 * @param {unknown} raw - The value.
 * @returns {boolean|null} The boolean, null for keep or empty.
 */
function readFlag(raw) {
  if (raw === true || raw === 'true' || raw === 'yes' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 'no' || raw === 0 || raw === '0') return false;
  return null;
}

/**
 * @description Check a complete trip and return its normalized form.
 * @param {object} trip - The candidate.
 * @returns {object} The trip.
 * @throws {RegistryError} When a field is invalid.
 */
function validateTrip(trip) {
  const name = clean(trip.name);
  if (name.length === 0 || name.length > NAME_MAX) {
    throw new RegistryError('errorName', { max: NAME_MAX });
  }
  const origin = clean(trip.origin);
  const destination = clean(trip.destination);
  if (origin.length < 2 || origin.length > PLACE_MAX) {
    throw new RegistryError('errorOrigin', { max: PLACE_MAX });
  }
  if (destination.length < 2 || destination.length > PLACE_MAX) {
    throw new RegistryError('errorDestination', { max: PLACE_MAX });
  }
  if (origin.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
    throw new RegistryError('errorSamePlace');
  }
  if (!MODES.includes(trip.mode)) {
    throw new RegistryError('errorChoice', { value: trip.mode });
  }
  if (!DAY_PRESETS.includes(trip.days)) {
    throw new RegistryError('errorChoice', { value: trip.days });
  }
  if (!Array.isArray(trip.hours) || trip.hours.length === 0) {
    throw new RegistryError('errorHours');
  }
  const interval = trip.interval ?? null;
  if (
    interval !== null &&
    (!Number.isInteger(interval) ||
      interval < REFRESH_MINUTES.min ||
      interval > REFRESH_MINUTES.max)
  ) {
    throw new RegistryError('errorInterval', REFRESH_MINUTES);
  }
  const threshold = trip.threshold ?? null;
  if (
    threshold !== null &&
    (!Number.isInteger(threshold) ||
      threshold < DELAY_THRESHOLD.min ||
      threshold > DELAY_THRESHOLD.max)
  ) {
    throw new RegistryError('errorThreshold', DELAY_THRESHOLD);
  }
  return {
    id: trip.id,
    name,
    origin,
    destination,
    mode: trip.mode,
    // Car only: live traffic (time-aware routing) or not (routing).
    traffic: trip.traffic !== false,
    avoidTolls: Boolean(trip.avoidTolls),
    avoidHighways: Boolean(trip.avoidHighways),
    avoidFerries: Boolean(trip.avoidFerries),
    days: trip.days,
    hours: trip.hours.map(([from, to]) => [from, to]),
    interval,
    threshold,
  };
}

/**
 * @description The hours of a form, checked.
 * @param {unknown} raw - The typed hours.
 * @returns {number[][]} The ranges.
 * @throws {RegistryError} When they cannot be read.
 */
function hoursOf(raw) {
  const hours = parseHours(raw);
  if (hours === null) {
    throw new RegistryError('errorHours');
  }
  return hours;
}

/**
 * @description A new trip from the fields of the "Add a trip" form.
 * @param {object} fields - The form values.
 * @param {string} id - Its identifier.
 * @returns {object} The trip.
 * @throws {RegistryError} When a field is invalid.
 * @example
 * tripFromFields({ name: 'Work', origin: 'Lyon', destination: 'Villeurbanne' }, 'a1b2c3d4');
 */
function tripFromFields(fields, id) {
  const read = (key, error, params) => {
    const value = readInteger(fields[key]);
    if (value === undefined) {
      throw new RegistryError(error, params);
    }
    return value;
  };
  return validateTrip({
    id,
    name: fields.name,
    origin: fields.origin,
    destination: fields.destination,
    mode: isEmpty(fields.mode) ? 'car' : fields.mode,
    traffic: readFlag(fields.traffic) ?? true,
    avoidTolls: readFlag(fields.avoid_tolls) ?? false,
    avoidHighways: readFlag(fields.avoid_highways) ?? false,
    avoidFerries: readFlag(fields.avoid_ferries) ?? false,
    days: isEmpty(fields.days) ? DEFAULT_DAYS : fields.days,
    hours: hoursOf(fields.hours),
    interval: read('interval_minutes', 'errorInterval', REFRESH_MINUTES),
    threshold: read('delay_threshold', 'errorThreshold', DELAY_THRESHOLD),
  });
}

/**
 * @description A trip changed by the fields of the "Edit a trip" form: an
 * empty field (or "Unchanged") keeps the current value; an interval or a
 * threshold of 0 goes back to the default of the configuration.
 * @param {object} current - The current trip.
 * @param {object} fields - The form values.
 * @returns {object} The new trip.
 * @throws {RegistryError} When a field is invalid.
 */
function editedTrip(current, fields) {
  const integer = (key, error, params) => {
    const value = readInteger(fields[key]);
    if (value === undefined) {
      throw new RegistryError(error, params);
    }
    return value;
  };
  const choice = (key) => (isEmpty(fields[key]) || fields[key] === KEEP ? undefined : fields[key]);
  const next = { ...current };
  if (!isEmpty(fields.name)) next.name = fields.name;
  if (!isEmpty(fields.origin)) next.origin = fields.origin;
  if (!isEmpty(fields.destination)) next.destination = fields.destination;
  const mode = choice('mode');
  if (mode !== undefined) next.mode = mode;
  [
    ['traffic', 'traffic'],
    ['avoid_tolls', 'avoidTolls'],
    ['avoid_highways', 'avoidHighways'],
    ['avoid_ferries', 'avoidFerries'],
  ].forEach(([key, property]) => {
    const flag = readFlag(choice(key));
    if (flag !== null) next[property] = flag;
  });
  const days = choice('days');
  if (days !== undefined) next.days = days;
  if (!isEmpty(fields.hours)) next.hours = hoursOf(fields.hours);
  const interval = integer('interval_minutes', 'errorInterval', REFRESH_MINUTES);
  if (interval !== null) next.interval = interval === 0 ? null : interval;
  const threshold = integer('delay_threshold', 'errorThreshold', DELAY_THRESHOLD);
  if (threshold !== null) next.threshold = threshold === 0 ? null : threshold;
  return validateTrip(next);
}

/**
 * @description Read the stored registry, dropping what is not a valid trip.
 * @param {*} stored - The stored value (an array, or its JSON).
 * @param {object} [logger] - Logger.
 * @returns {object[]} The trips.
 */
function parseRegistry(stored, logger) {
  let list = stored;
  if (typeof stored === 'string') {
    try {
      list = JSON.parse(stored);
    } catch {
      logger?.warn('Travel time: the stored trips are not valid JSON, ignored');
      return [];
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  const trips = [];
  for (const raw of list) {
    try {
      if (!raw || !ID_PATTERN.test(raw.id) || seen.has(raw.id)) {
        throw new RegistryError('invalid');
      }
      trips.push(validateTrip(raw));
      seen.add(raw.id);
    } catch {
      // Never log the addresses: the name is enough to recognize a trip.
      logger?.warn(`Travel time: stored trip ignored (${String(raw?.name ?? '?').slice(0, 60)})`);
    }
  }
  return trips.slice(0, MAX_TRIPS);
}

/**
 * @description The registry of the trips.
 * @param {object} gladys - SDK client (setConfig).
 * @param {object} [options] - Options.
 * @param {object} [options.logger] - Logger.
 * @param {Function} [options.newId] - `() => string`, 8 hex digits (tests).
 * @returns {object} The registry.
 */
function createRegistry(gladys, { logger, newId = () => randomBytes(4).toString('hex') } = {}) {
  let trips = [];
  let writing = Promise.resolve();

  // One change at a time, computed from the previous one once it is saved.
  const serial = (change) => {
    const run = writing.then(async () => {
      const { next, result } = change(trips);
      await gladys.setConfig({ [INTERNAL_KEYS.registry]: next });
      trips = next;
      return result;
    });
    writing = run.catch(() => {});
    return run;
  };

  const registry = {
    /** @param {object} config - `gladys.config`. @returns {object[]} The trips. */
    load(config) {
      trips = parseRegistry(config?.[INTERNAL_KEYS.registry], logger);
      return trips;
    },

    list: () => trips,

    /** @param {string} id - Identifier. @returns {object|undefined} The trip. */
    byId: (id) => trips.find((trip) => trip.id === id),

    /** @param {object} trip - A trip. @returns {number} Its number in the list (1…). */
    numberOf: (trip) => trips.findIndex((other) => other.id === trip.id) + 1,

    /**
     * @description Find a trip by its number in the list (#2 or 2), its name
     * (any case) or its identifier.
     * @param {string} query - What the user typed.
     * @returns {object} The trip.
     * @throws {RegistryError} When none or several match.
     */
    find(query) {
      const value = String(query ?? '').trim();
      if (!value) {
        throw new RegistryError('errorTarget');
      }
      const number = /^#?(\d{1,4})$/.exec(value);
      if (number) {
        const trip = trips[Number(number[1]) - 1];
        if (trip) return trip;
      }
      const lower = value.toLocaleLowerCase();
      const byName = trips.filter((trip) => trip.name.toLocaleLowerCase() === lower);
      if (byName.length === 1) return byName[0];
      if (byName.length > 1) {
        throw new RegistryError('errorAmbiguous', {
          query: value,
          numbers: byName.map((trip) => `#${trips.indexOf(trip) + 1}`).join(', '),
        });
      }
      const byId = trips.find((trip) => trip.id === lower);
      if (byId) return byId;
      throw new RegistryError('errorNotFound', { query: value });
    },

    /**
     * @description Add a trip from the "Add a trip" form.
     * @param {object} fields - The form values.
     * @returns {Promise<object>} The new trip.
     */
    add(fields) {
      return serial((current) => {
        if (current.length >= MAX_TRIPS) {
          throw new RegistryError('errorFull', { max: MAX_TRIPS });
        }
        let id = newId();
        while (current.some((trip) => trip.id === id)) {
          id = newId();
        }
        const trip = tripFromFields(fields, id);
        return { next: [...current, trip], result: trip };
      });
    },

    /**
     * @description Change a trip from the "Edit a trip" form.
     * @param {object} fields - The form values (`trip`: which one).
     * @returns {Promise<{ before: object, after: object }>} The change.
     */
    edit(fields) {
      return serial((current) => {
        const before = registry.find(fields.trip);
        const after = editedTrip(before, fields);
        return {
          next: current.map((trip) => (trip.id === before.id ? after : trip)),
          result: { before, after },
        };
      });
    },

    /**
     * @description Remove a trip.
     * @param {string} query - Its number, name or identifier.
     * @returns {Promise<object>} The removed trip.
     */
    remove(query) {
      return serial((current) => {
        const trip = registry.find(query);
        return { next: current.filter((other) => other.id !== trip.id), result: trip };
      });
    },
  };
  return registry;
}

export {
  MAX_TRIPS,
  NAME_MAX,
  PLACE_MAX,
  KEEP,
  RegistryError,
  validateTrip,
  tripFromFields,
  editedTrip,
  parseRegistry,
  createRegistry,
  formatHours,
};
