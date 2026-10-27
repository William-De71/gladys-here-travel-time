// -----------------------------------------------------------------------------
// Where a trip starts and ends: what the user typed, turned into coordinates
// (the HERE routing APIs only take points).
//
//   - "48.8584, 2.2945"   coordinates, used as they are (no request);
//   - "home" (or maison, domicile, Zuhause, casa, hogar)
//                         the first house of Gladys that has a location;
//   - "@Name"             the house of Gladys called Name;
//   - anything else       an address, geocoded by HERE (Geocoding & Search
//                         API v7, the `geocode` SKU) and kept in
//                         /data/geocode.json: an address is geocoded once,
//                         not at each reading.
//
// The houses need the `location` permission of the manifest; they are read
// at startup and again when one is missing (an added house).
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_GEOCODE_PATH = '/data/geocode.json';
// Addresses kept: the trips, and the latest ones of the scene action.
const MAX_ENTRIES = 200;
const HOME_WORDS = ['home', 'maison', 'domicile', 'zuhause', 'casa', 'hogar'];

/** @description A place that cannot be resolved without HERE: no request was made. */
class PlaceError extends Error {
  /**
   * @param {string} key - The TEXTS key of the message.
   * @param {object} [params] - Its substitutions.
   */
  constructor(key, params = {}) {
    super(key);
    this.name = 'PlaceError';
    this.key = key;
    this.params = params;
  }
}

/**
 * @description The coordinates of a typed "latitude, longitude".
 * @param {string} text - The typed place.
 * @returns {{ lat: number, lng: number }|null} The point, null when not coordinates.
 * @example
 * parseCoordinates('45.76, 4.83'); // -> { lat: 45.76, lng: 4.83 }
 */
function parseCoordinates(text) {
  const match = /^(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(
    String(text ?? '').trim(),
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/**
 * @description Which house a typed place names.
 * @param {string} text - The typed place.
 * @returns {{ name: string|null }|null} `{ name: null }` for the home words,
 *   `{ name }` for "@Name", null for an address.
 * @example
 * houseQuery('@Chalet'); // -> { name: 'Chalet' }
 */
function houseQuery(text) {
  const value = String(text ?? '').trim();
  if (HOME_WORDS.includes(value.toLocaleLowerCase())) return { name: null };
  if (value.startsWith('@') && value.length > 1) return { name: value.slice(1).trim() };
  return null;
}

/**
 * @description The cache key of an address: case and spaces do not matter.
 * @param {string} text - The address.
 * @returns {string} The key.
 */
const keyOf = (text) =>
  String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();

/**
 * @description Create the place resolver.
 * @param {object} options - Options.
 * @param {object} options.api - The HERE client (`geocode`).
 * @param {Function} options.getHouses - `() => Promise<object[]>` (the SDK).
 * @param {string|null} [options.path] - The geocoding cache (null: memory only).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The resolver.
 */
function createPlaces({
  api,
  getHouses,
  path = DEFAULT_GEOCODE_PATH,
  now = () => Date.now(),
  logger = console,
}) {
  let cache = {};
  let houses = null;
  if (path) {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8'));
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) cache = stored;
    } catch {
      // No file yet (first start) or unreadable: geocode again.
    }
  }

  const save = () => {
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(cache), { mode: 0o600 });
    } catch (err) {
      logger.warn(`Unable to store the geocoding cache: ${err.message}`);
    }
  };

  /** @description Read the houses of Gladys (once, or again when one is missing). */
  async function loadHouses() {
    try {
      const list = await getHouses();
      houses = Array.isArray(list) ? list : [];
    } catch (err) {
      logger.warn(`Unable to read the houses of Gladys: ${err.message}`);
      houses = [];
    }
    return houses;
  }

  /**
   * @description The point of a house.
   * @param {{ name: string|null }} query - Which house.
   * @returns {Promise<{ lat: number, lng: number, label: string }>} The point.
   * @throws {PlaceError} When no house matches or it has no location.
   */
  async function house(query) {
    const find = (list) => {
      const located = list.filter(
        (h) => Number.isFinite(h?.latitude) && Number.isFinite(h?.longitude),
      );
      if (query.name === null) return located[0];
      const wanted = query.name.toLocaleLowerCase();
      return list.find((h) => String(h?.name ?? '').toLocaleLowerCase() === wanted);
    };
    let found = find(houses ?? (await loadHouses()));
    if (!found) found = find(await loadHouses());
    if (!found) {
      throw new PlaceError(query.name === null ? 'errorNoHouse' : 'errorUnknownHouse', {
        name: query.name ?? '',
      });
    }
    if (!Number.isFinite(found.latitude) || !Number.isFinite(found.longitude)) {
      throw new PlaceError('errorHouseNoLocation', { name: found.name });
    }
    return { lat: found.latitude, lng: found.longitude, label: found.name };
  }

  const places = {
    /**
     * @description The point of a typed place.
     * @param {string} text - What the user typed.
     * @param {string} language - Language of the geocoding label.
     * @returns {Promise<{ lat: number, lng: number, label: string, source: string }>}
     *   source: coordinates, house, cache or geocode.
     */
    async resolve(text, language) {
      const point = parseCoordinates(text);
      if (point) return { ...point, label: String(text).trim(), source: 'coordinates' };
      const query = houseQuery(text);
      if (query) return { ...(await house(query)), source: 'house' };
      const key = keyOf(text);
      const cached = cache[key];
      if (cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lng)) {
        cached.used = now();
        return { lat: cached.lat, lng: cached.lng, label: cached.label ?? '', source: 'cache' };
      }
      const found = await api.geocode(String(text).trim(), language);
      cache[key] = { lat: found.lat, lng: found.lng, label: found.label, used: now() };
      const keys = Object.keys(cache);
      if (keys.length > MAX_ENTRIES) {
        keys
          .sort((a, b) => (cache[a].used ?? 0) - (cache[b].used ?? 0))
          .slice(0, keys.length - MAX_ENTRIES)
          .forEach((old) => delete cache[old]);
      }
      save();
      return { ...found, source: 'geocode' };
    },

    /**
     * @description The cached point of a typed place, without any request
     * (the map links of the widgets).
     * @param {string} text - What the user typed.
     * @returns {{ lat: number, lng: number }|null} The point.
     */
    known(text) {
      const point = parseCoordinates(text);
      if (point) return point;
      const query = houseQuery(text);
      if (query) {
        const list = houses ?? [];
        const found =
          query.name === null
            ? list.find((h) => Number.isFinite(h?.latitude))
            : list.find(
                (h) => String(h?.name ?? '').toLocaleLowerCase() === query.name.toLocaleLowerCase(),
              );
        return found && Number.isFinite(found.latitude)
          ? { lat: found.latitude, lng: found.longitude }
          : null;
      }
      const cached = cache[keyOf(text)];
      return cached ? { lat: cached.lat, lng: cached.lng } : null;
    },

    /** @description Read the houses again (at startup and reconnection). */
    refreshHouses: () => loadHouses(),
  };
  return places;
}

export {
  DEFAULT_GEOCODE_PATH,
  MAX_ENTRIES,
  HOME_WORDS,
  PlaceError,
  parseCoordinates,
  houseQuery,
  keyOf,
  createPlaces,
};
