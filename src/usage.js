// -----------------------------------------------------------------------------
// Monthly counter of the billable HERE requests, per SKU.
//
// HERE counts one transaction per request, under one SKU (time-aware routing,
// routing, truck, scooter, public transit, geocoding: see here-api.js), each
// with its own free monthly usage on the Base plan. This counter is the
// integration's own safety net: once the budget of a SKU is reached in a
// calendar month, no more request of that SKU goes out until the next month
// (the last readings stay shown).
//
// The budget of a SKU is `budget_percent` % of its free usage (90 % by
// default, under the free tier). The count lives in /data/usage.json so that
// a restart does not reset it. It is an estimate: the month is the UTC
// calendar month, and HERE's own count (platform.here.com → Usage) is the
// reference — hence a default kept below 100 %. The free usage is per HERE
// account: other apps of the account count too.
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FREE_USAGE, SKUS } from './here-api.js';

const SKU_LIST = Object.values(SKUS);
const zero = () => Object.fromEntries(SKU_LIST.map((sku) => [sku, 0]));

/**
 * @description The UTC calendar month of an instant.
 * @param {number} instant - The instant in ms.
 * @returns {string} "YYYY-MM".
 * @example
 * monthOf(Date.parse('2026-10-17T08:00:00Z')); // -> '2026-10'
 */
function monthOf(instant) {
  return new Date(instant).toISOString().slice(0, 7);
}

/**
 * @description The budget of a SKU for a share of its free usage.
 * @param {string} sku - The SKU.
 * @param {number} percent - The share, in %.
 * @returns {number} Requests a month, at least 1.
 * @example
 * budgetOf('time_aware', 90); // -> 4500
 */
function budgetOf(sku, percent) {
  return Math.max(1, Math.floor((FREE_USAGE[sku] * percent) / 100));
}

/**
 * @description Create the usage counter.
 * @param {object} options - Options.
 * @param {string|null} options.path - The JSON file (null: memory only).
 * @param {Function} options.getPercent - `() => number`, read on every check.
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The counter.
 * @example
 * const usage = createUsage({ path: '/data/usage.json', getPercent: () => 90 });
 */
function createUsage({ path, getPercent, now = () => Date.now(), logger = console }) {
  let state = { month: monthOf(now()), calls: zero() };
  if (path) {
    try {
      const stored = JSON.parse(readFileSync(path, 'utf8'));
      if (typeof stored?.month === 'string' && stored.calls && typeof stored.calls === 'object') {
        const calls = zero();
        SKU_LIST.forEach((sku) => {
          if (Number.isInteger(stored.calls[sku]) && stored.calls[sku] > 0) {
            calls[sku] = stored.calls[sku];
          }
        });
        state = { month: stored.month, calls };
      }
    } catch {
      // No file yet (first start) or unreadable: start from zero.
    }
  }

  const rollOver = () => {
    const month = monthOf(now());
    if (month !== state.month) {
      state = { month, calls: zero() };
    }
  };

  const save = () => {
    if (!path) {
      return;
    }
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(state), { mode: 0o600 });
    } catch (err) {
      logger.warn(`Unable to store the API usage counter: ${err.message}`);
    }
  };

  const usage = {
    /** @param {string} sku - The SKU. @returns {number} Its requests this month. */
    used(sku) {
      rollOver();
      return state.calls[sku] ?? 0;
    },
    /** @param {string} sku - The SKU. @returns {number} Its monthly budget. */
    budget: (sku) => budgetOf(sku, getPercent()),
    /** @param {string} sku - The SKU. @returns {number} The requests left. */
    remaining: (sku) => Math.max(0, usage.budget(sku) - usage.used(sku)),
    /** @param {string} sku - The SKU. @returns {boolean} Whether its budget is spent. */
    exhausted: (sku) => usage.used(sku) >= usage.budget(sku),
    /** @returns {string} The current month, "YYYY-MM". */
    month() {
      rollOver();
      return state.month;
    },
    /** @param {string} sku - Count one successful (billable) request. */
    record(sku) {
      rollOver();
      state.calls[sku] = (state.calls[sku] ?? 0) + 1;
      save();
    },
  };
  return usage;
}

export { SKU_LIST, monthOf, budgetOf, createUsage };
