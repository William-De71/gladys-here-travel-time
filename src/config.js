// -----------------------------------------------------------------------------
// Configuration of the HERE Travel Time integration.
//
// Fields of the config_schema:
//   - `api_key`          the HERE API key of the user (an app of the HERE
//                        platform, Base plan), a secret: never logged;
//   - `refresh_minutes`  default reading interval of a trip, in minutes;
//   - `delay_threshold`  default traffic delay, in minutes, from which a trip
//                        shows in orange then red in the widgets;
//   - `budget_percent`   share of the monthly free usage of each SKU the
//                        integration may spend (90 by default; above 100,
//                        HERE bills the extra requests);
//   - `language`         language of the texts Gladys does not ask for in a
//                        language (feature names, scene summaries, messages
//                        of the configuration buttons, route language): `auto`
//                        follows the last widget request, and guesses it from
//                        the timezone of Gladys until a widget is shown.
//
// Internal keys, outside the config_schema (never shown in the UI, stored by
// setConfig in the Gladys database, so they follow the Gladys backups):
//   - `trips`          the registry of the trips (see trips.js);
//   - `last_language`  language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';

const REFRESH_MINUTES = { min: 5, max: 240, default: 15 };
const DELAY_THRESHOLD = { min: 1, max: 240, default: 10 };
const BUDGET_PERCENT = { min: 1, max: 1000, default: 90 };
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { registry: 'trips', language: 'last_language' };

/**
 * @description Read a bounded whole number, falling back to its default.
 * @param {unknown} raw - The raw value (the form can send numbers as strings).
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('20', REFRESH_MINUTES); // -> 20
 */
function readNumber(raw, bounds) {
  if (raw === '' || raw === null || raw === undefined) {
    return bounds.default;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {{ apiKey: string, refreshMinutes: number, delayThreshold: number,
 *   budgetPercent: number, language: string }} The config.
 * @example
 * normalizeConfig({ api_key: ' abc… ', refresh_minutes: 10 });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  return {
    apiKey: typeof config.api_key === 'string' ? config.api_key.trim() : '',
    refreshMinutes: readNumber(config.refresh_minutes, REFRESH_MINUTES),
    delayThreshold: readNumber(config.delay_threshold, DELAY_THRESHOLD),
    budgetPercent: readNumber(config.budget_percent, BUDGET_PERCENT),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

// Timezones of the countries speaking one of the languages of the
// integration; any other one is English. A guess for the first devices only:
// the first widget shown gives the real language.
const TIMEZONE_LANGUAGES = {
  fr: [
    'Europe/Paris',
    'Europe/Monaco',
    'Europe/Brussels',
    'Europe/Luxembourg',
    'Indian/Reunion',
    'Indian/Mayotte',
    'America/Guadeloupe',
    'America/Martinique',
    'America/Cayenne',
    'America/Miquelon',
    'Pacific/Noumea',
    'Pacific/Tahiti',
    'America/Montreal',
    'Africa/Abidjan',
    'Africa/Dakar',
    'Africa/Casablanca',
    'Africa/Algiers',
    'Africa/Tunis',
  ],
  de: ['Europe/Berlin', 'Europe/Busingen', 'Europe/Vienna', 'Europe/Zurich', 'Europe/Vaduz'],
  es: [
    'Europe/Madrid',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'America/Mexico_City',
    'America/Bogota',
    'America/Lima',
    'America/Santiago',
    'America/Caracas',
    'America/Montevideo',
    'America/Asuncion',
    'America/La_Paz',
    'America/Guayaquil',
    'America/Havana',
    'America/Panama',
    'America/Costa_Rica',
    'America/Guatemala',
    'America/Santo_Domingo',
    'America/Puerto_Rico',
  ],
};

/**
 * @description The language of the texts guessed from a timezone, before
 * any widget was shown.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {string} en, fr, de or es.
 * @example
 * guessLanguage('Europe/Paris'); // -> 'fr'
 */
function guessLanguage(timezone) {
  const zone = String(timezone ?? '');
  if (zone.startsWith('America/Argentina/')) return 'es';
  const found = Object.entries(TIMEZONE_LANGUAGES).find(([, zones]) => zones.includes(zone));
  return found ? found[0] : 'en';
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  REFRESH_MINUTES,
  DELAY_THRESHOLD,
  BUDGET_PERCENT,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  readNumber,
  guessLanguage,
  normalizeConfig,
  readLanguage,
};
