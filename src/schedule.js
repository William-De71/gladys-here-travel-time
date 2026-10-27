// -----------------------------------------------------------------------------
// When a trip is read: its days, its hours, its interval — and how many
// requests a month that plans.
//
// Every request is billed, so a trip is only read when it matters: on its
// days (every day, Monday to Friday, the weekend, Monday to Saturday) and in
// its hours ("6-10, 16-20": up to four ranges, H or H:MM, in the timezone of
// Gladys; "22-2" crosses midnight). The default is every 15 minutes from 6
// to 21, Monday to Friday: about 1,300 requests a month.
//
// When the trips of a SKU plan more requests than its monthly budget allows,
// their intervals are stretched by the same factor (the plan keeps 10 % of
// the budget for the scene action and the refresh buttons): the readings get
// rarer, but they never stop in the middle of the month.
// -----------------------------------------------------------------------------

import { wallClock } from './time.js';
import { skuOf } from './here-api.js';

const DAYS = {
  every_day: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [0, 6],
  mon_sat: [1, 2, 3, 4, 5, 6],
};
const DAY_PRESETS = Object.keys(DAYS);
const DEFAULT_DAYS = 'weekdays';
const DEFAULT_HOURS = '6-21';
const MAX_RANGES = 4;
// Weeks in an average month.
const WEEKS_PER_MONTH = 52 / 12;
// Share of the budget the plan may use: the rest is for the manual reads.
const PLAN_SHARE = 0.9;

/**
 * @description Minutes of the day of "7", "7:30", "24".
 * @param {string} text - The time.
 * @returns {number|null} The minutes, null when invalid.
 */
function minutesOf(text) {
  const match = /^(\d{1,2})(?:[:h](\d{2}))?$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] === undefined ? 0 : Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

/**
 * @description Parse the hours of a trip: "6-10, 16-20", "7:30-9", "0-24".
 * @param {unknown} raw - The typed text (empty: the default hours).
 * @returns {number[][]|null} Ranges of minutes [from, to), null when invalid.
 * @example
 * parseHours('6-10, 16:30-20'); // -> [[360, 600], [990, 1200]]
 */
function parseHours(raw) {
  const text = String(raw ?? '').trim() || DEFAULT_HOURS;
  const parts = text.split(/[,;]/).map((part) => part.trim());
  if (parts.length === 0 || parts.length > MAX_RANGES) return null;
  const ranges = [];
  for (const part of parts) {
    const match = /^([\d:h]+)\s*(?:-|–|à|to|bis|a)\s*([\d:h]+)$/i.exec(part);
    if (!match) return null;
    const from = minutesOf(match[1]);
    const to = minutesOf(match[2]);
    if (from === null || to === null || from === to || from === 24 * 60) return null;
    ranges.push([from, to]);
  }
  return ranges;
}

/**
 * @description The hours written back: "6-10, 16:30-20".
 * @param {number[][]} ranges - The ranges.
 * @returns {string} The text.
 */
function formatHours(ranges) {
  const time = (minutes) =>
    minutes % 60 === 0
      ? String(minutes / 60)
      : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  return ranges.map(([from, to]) => `${time(from)}-${time(to)}`).join(', ');
}

/**
 * @description Minutes a range covers in a day (across midnight included).
 * @param {number[]} range - [from, to).
 * @returns {number} The minutes.
 */
const lengthOf = ([from, to]) => (to > from ? to - from : 24 * 60 - from + to);

/**
 * @description Whether a trip is to be read at an instant.
 * @param {object} trip - `{ days, hours }`.
 * @param {Date} date - The instant.
 * @param {string} timezone - IANA timezone of Gladys.
 * @returns {boolean} True in one of its ranges, on one of its days.
 */
function isActive(trip, date, timezone) {
  const clock = wallClock(date, timezone);
  const minute = clock.hour * 60 + clock.minute;
  const weekday = new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay();
  const days = DAYS[trip.days] ?? DAYS[DEFAULT_DAYS];
  return trip.hours.some(([from, to]) => {
    if (from < to) {
      return days.includes(weekday) && minute >= from && minute < to;
    }
    // Across midnight: the evening belongs to its day, the night after to
    // the day before.
    if (minute >= from) return days.includes(weekday);
    return minute < to && days.includes((weekday + 6) % 7);
  });
}

/**
 * @description The requests a month a trip plans at an interval.
 * @param {object} trip - `{ days, hours }`.
 * @param {number} interval - Minutes between two reads.
 * @returns {number} The requests (rounded up).
 */
function plannedPerMonth(trip, interval) {
  const perDay = trip.hours.reduce((sum, range) => sum + Math.ceil(lengthOf(range) / interval), 0);
  const days = (DAYS[trip.days] ?? DAYS[DEFAULT_DAYS]).length;
  return Math.ceil(perDay * days * WEEKS_PER_MONTH);
}

/**
 * @description The plan of the trips: the requests a month per SKU and the
 * interval each trip is really read at.
 * @param {object[]} trips - The trips.
 * @param {object} options - Options.
 * @param {number} options.defaultInterval - Interval of the trips without their own.
 * @param {Function} options.budget - `(sku) => number`, the monthly budget.
 * @returns {{ intervals: Map<string, number>, planned: object, stretched: object }}
 *   Effective intervals by trip id, requests a month and stretch factor per SKU.
 * @example
 * planOf(trips, { defaultInterval: 15, budget: () => 4500 });
 */
function planOf(trips, { defaultInterval, budget }) {
  const planned = {};
  trips.forEach((trip) => {
    const sku = skuOf(trip);
    planned[sku] = (planned[sku] ?? 0) + plannedPerMonth(trip, trip.interval ?? defaultInterval);
  });
  const stretched = {};
  Object.entries(planned).forEach(([sku, count]) => {
    const factor = count / (budget(sku) * PLAN_SHARE);
    stretched[sku] = factor > 1 ? factor : 1;
  });
  const intervals = new Map(
    trips.map((trip) => [
      trip.id,
      Math.ceil((trip.interval ?? defaultInterval) * stretched[skuOf(trip)]),
    ]),
  );
  const effective = {};
  trips.forEach((trip) => {
    const sku = skuOf(trip);
    effective[sku] = (effective[sku] ?? 0) + plannedPerMonth(trip, intervals.get(trip.id));
  });
  return { intervals, planned, effective, stretched };
}

export {
  DAYS,
  DAY_PRESETS,
  DEFAULT_DAYS,
  DEFAULT_HOURS,
  MAX_RANGES,
  parseHours,
  formatHours,
  isActive,
  plannedPerMonth,
  planOf,
};
