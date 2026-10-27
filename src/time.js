// -----------------------------------------------------------------------------
// Timezone helpers, on top of Intl (full ICU ships with the official Node
// images, Alpine included): no date library needed.
//
// Which timezone: the one of Gladys. The supervisor starts every integration
// container with `TZ=<the timezone set in Gladys>`, so a day starts at the
// midnight of the house, not at the midnight of UTC. Every helper still takes
// the timezone explicitly, so the tests run the same on any machine.
// -----------------------------------------------------------------------------

const FALLBACK_TIMEZONE = 'UTC';
const formatters = new Map();

/**
 * @description True for a timezone Intl knows.
 * @param {string} timezone - IANA timezone.
 * @returns {boolean} True when usable.
 * @example
 * isValidTimezone('Europe/Paris'); // -> true
 */
function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || timezone.length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * @description The timezone of Gladys: TZ (set by the supervisor), else the
 * one the process resolved, else UTC.
 * @param {object} [env] - Environment variables.
 * @returns {string} IANA timezone.
 * @example
 * resolveTimezone({ TZ: 'Europe/Paris' }); // -> 'Europe/Paris'
 */
function resolveTimezone(env = process.env) {
  if (isValidTimezone(env.TZ)) {
    return env.TZ;
  }
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimezone(resolved) ? resolved : FALLBACK_TIMEZONE;
}

/**
 * @description Wall-clock parts of an instant in a timezone.
 * @param {Date} date - The instant.
 * @param {string} timezone - IANA timezone.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }} The parts.
 * @example
 * wallClock(new Date('2026-10-15T22:30:00Z'), 'Europe/Paris'); // -> { day: 16, hour: 0, ... }
 */
function wallClock(date, timezone) {
  let formatter = formatters.get(timezone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  const parts = {};
  formatter.formatToParts(date).forEach(({ type, value }) => {
    if (type !== 'literal') {
      parts[type] = Number(value);
    }
  });
  return parts;
}

/**
 * @description The local calendar day of an instant, as YYYY-MM-DD.
 * @param {Date} date - The instant.
 * @param {string} timezone - IANA timezone.
 * @returns {string} The local day.
 * @example
 * localDay(new Date('2026-10-15T22:30:00Z'), 'Europe/Paris'); // -> '2026-10-16'
 */
function localDay(date, timezone) {
  const { year, month, day } = wallClock(date, timezone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * @description Seconds until the next local midnight, from the wall clock.
 * @param {Date} now - The current instant.
 * @param {string} timezone - IANA timezone.
 * @returns {number} Seconds, at least 1.
 * @example
 * secondsUntilMidnight(new Date('2026-10-15T21:00:00Z'), 'Europe/Paris'); // -> 3600
 */
function secondsUntilMidnight(now, timezone) {
  const { hour, minute, second } = wallClock(now, timezone);
  // Wall-clock seconds left in the day: right except across a DST change,
  // where it is one hour off at most — the TTL of a widget, nothing more.
  return Math.max(1, 24 * 3600 - (hour * 3600 + minute * 60 + second));
}

export {
  FALLBACK_TIMEZONE,
  isValidTimezone,
  resolveTimezone,
  wallClock,
  localDay,
  secondsUntilMidnight,
};
