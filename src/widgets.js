// -----------------------------------------------------------------------------
// Dashboard widgets of the HERE Travel Time integration.
//
//   - `trips`   the trips as a list: travel time, distance and main roads, a
//               badge with the traffic delay (green: fluid, orange: some
//               delay, red: the delay threshold of the trip is reached), the
//               link to the route on HERE WeGo, and a "Refresh all" button;
//               setting: which trips (empty: all, 8 at most);
//   - `trip`    one trip, chosen among the created devices: travel time,
//               traffic delay, distance, time without traffic, route, last
//               reading, and a "Refresh" button;
//   - `budget`  the requests of the month per SKU against their budget, what
//               the trips plan, and whether HERE accepts the key.
// A refresh button spends one request per trip (the badge of the budget
// shows it). Every text exists in the four languages (the content is cached
// per language and unit system); distances follow the unit system of the
// user in the widgets. Content budget of a card: 8 components, 1 main one,
// 6 tiles, 2 texts, 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { t, ago, formatNumber, formatMonth } from './i18n.js';
import { toMinutes, toKm } from './device.js';
import { hasTraffic, SKUS } from './here-api.js';
import { SKU_LIST } from './usage.js';
import { formatHours } from './schedule.js';

const WIDGETS = { TRIPS: 'trips', TRIP: 'trip', BUDGET: 'budget' };
const WIDGET_ACTIONS = { REFRESH: 'refresh', REFRESH_ALL: 'refresh_all' };
// The rows of a card-list in list display.
const MAX_ITEMS = 8;
const TTL = 300;
// Gauges of the budget widget (one per SKU in use).
const MAX_GAUGES = 5;
// Under this delay, in minutes, the traffic is "fluid".
const FLUID_MINUTES = 3;
const KM_PER_MILE = 1.609344;

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
const messageContent = (message, ttl = TTL) => ({
  ttl_seconds: ttl,
  components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
});

/**
 * @description A distance in the unit system of the user.
 * @param {number} meters - Meters.
 * @param {string} units - metric or imperial.
 * @param {string} language - The language.
 * @returns {{ value: number, unit: string, text: string }} The distance.
 */
function distanceOf(meters, units, language) {
  const imperial = units === 'imperial';
  const value = imperial ? Math.round(meters / 1000 / KM_PER_MILE / 0.1) / 10 : toKm(meters);
  const unit = t(imperial ? 'unitMi' : 'unitKm', language);
  return { value, unit, text: `${formatNumber(value, language)} ${unit}` };
}

/**
 * @description The color of a delay.
 * @param {number} delayMinutes - The traffic delay, in minutes.
 * @param {number} threshold - The delay threshold of the trip.
 * @returns {string} A semantic color.
 */
function colorOf(delayMinutes, threshold) {
  if (delayMinutes >= threshold) return 'danger';
  if (delayMinutes >= FLUID_MINUTES) return 'warning';
  return 'success';
}

/**
 * @description The HERE WeGo link of a trip (share.here.com route deeplink:
 * waypoints separated by slashes, no key needed), when both points are known.
 * @param {{ from: object|null, to: object|null }|null} points - The points.
 * @returns {string|null} The https URL.
 * @example
 * mapsUrl({ from: { lat: 45.76, lng: 4.83 }, to: { lat: 45.76, lng: 4.86 } });
 * // -> 'https://share.here.com/r/45.76,4.83/45.76,4.86'
 */
function mapsUrl(points) {
  const { from, to } = points ?? {};
  if (!from || !to) return null;
  const point = ({ lat, lng }) => `${Number(lat.toFixed(5))},${Number(lng.toFixed(5))}`;
  return `https://share.here.com/r/${point(from)}/${point(to)}`;
}

/**
 * @description The badge of a trip in the list.
 * @param {object} trip - The trip.
 * @param {object|null} reading - Its last reading.
 * @param {number} threshold - Its delay threshold.
 * @param {string} language - The language.
 * @returns {{ text: string, color: string }} The badge.
 */
function badgeOf(trip, reading, threshold, language) {
  if (!reading) return { text: clip(t('noReading', language), 16), color: 'neutral' };
  if (trip.mode === 'transit' && reading.description) {
    const late = toMinutes(reading.transitDelay ?? 0);
    if (late >= 1) {
      return { text: clip(t('delayBadge', language, { n: late }), 16), color: 'warning' };
    }
    return {
      text: clip(t('leaveAt', language, { time: reading.departure || '?' }), 16),
      color: 'info',
    };
  }
  if (!hasTraffic(trip)) {
    return { text: clip(t(`mode_${trip.mode}`, language), 16), color: 'info' };
  }
  const delay = toMinutes(reading.delay);
  return {
    text: clip(delay >= 1 ? t('delayBadge', language, { n: delay }) : t('onTime', language), 16),
    color: colorOf(delay, threshold),
  };
}

/**
 * @description The "trips" widget.
 * @param {object} options - Options.
 * @param {object[]} options.trips - The trips, with `{ trip, state, threshold, active, points }`.
 * @param {boolean} options.hasKey - Whether an API key is configured.
 * @param {string} options.language - The language.
 * @param {string} [options.units] - metric or imperial.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 */
function buildTripsWidget({ trips, hasKey, language, units = 'metric', now }) {
  if (!hasKey) return messageContent(t('widgetNoKey', language));
  if (trips.length === 0) return messageContent(t('widgetEmpty', language));
  const shown = trips.slice(0, MAX_ITEMS);
  const latest = Math.max(0, ...shown.map(({ state }) => state?.at ?? 0));
  return {
    ttl_seconds: TTL,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: clip(t('tripsCaption', language, { updated: ago(latest, now, language) }), 80),
      },
      {
        type: 'card-list',
        display: 'list',
        items: shown.map(({ trip, state, threshold, active, points }) => {
          const reading = state?.reading ?? null;
          const parts = reading
            ? [
                `${toMinutes(reading.duration)} ${t('unitMin', language)}`,
                distanceOf(reading.distanceMeters, units, language).text,
                reading.description ? t('viaRoute', language, { route: reading.description }) : '',
              ].filter(Boolean)
            : [t('noReading', language)];
          const details = [
            `${trip.origin} → ${trip.destination}`,
            `${t(`mode_${trip.mode}`, language)} · ${t(`days_${trip.days}`, language)}, ${formatHours(trip.hours)}`,
          ];
          if (reading && hasTraffic(trip)) {
            details.push(
              `${t('tileNoTraffic', language)}: ${toMinutes(reading.staticDuration)} ${t('unitMin', language)}`,
            );
          }
          if (reading && trip.mode === 'transit' && reading.description) {
            details.push(
              t('transitLine', language, {
                departure: reading.departure || '?',
                arrival: reading.arrival || '?',
                changes: reading.changes ?? 0,
              }),
            );
          }
          details.push(`${t('statusUpdated', language)}: ${ago(state?.at ?? 0, now, language)}`);
          if (!active) details.push(t('offHours', language));
          const url = mapsUrl(points);
          return {
            title: clip(trip.name, 60),
            subtitle: clip(parts.join(' · '), 60),
            badge: badgeOf(trip, reading, threshold, language),
            description: clip(details.join('\n'), 2000),
            ...(url ? { links: [{ url, label: 'HERE WeGo' }] } : {}),
          };
        }),
      },
      {
        type: 'button',
        label: clip(t('buttonRefreshAll', language), 24),
        icon: 'refresh-cw',
        style: 'secondary',
        action: {
          key: WIDGET_ACTIONS.REFRESH_ALL,
          params: { trips: shown.map(({ trip }) => trip.id) },
        },
      },
    ],
  };
}

/**
 * @description The "trip" widget of one trip.
 * @param {object} options - Options.
 * @param {object|null} options.trip - The trip (null: not chosen or removed).
 * @param {object|null} options.state - Its state (state.js).
 * @param {number} options.threshold - Its delay threshold.
 * @param {boolean} [options.chosen] - Whether a trip is chosen in the settings.
 * @param {boolean} options.hasKey - Whether an API key is configured.
 * @param {string} options.language - The language.
 * @param {string} [options.units] - metric or imperial.
 * @param {number} options.now - Now, in ms.
 * @returns {object} The content.
 */
function buildTripWidget({
  trip,
  state,
  threshold,
  chosen = true,
  hasKey,
  language,
  units = 'metric',
  now,
}) {
  if (!hasKey) return messageContent(t('widgetNoKey', language));
  if (!trip) {
    return messageContent(t(chosen ? 'widgetUnknownTrip' : 'widgetChooseTrip', language));
  }
  const reading = state?.reading ?? null;
  const refresh = {
    type: 'button',
    label: clip(t('buttonRefresh', language), 24),
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: WIDGET_ACTIONS.REFRESH, params: { trip: trip.id } },
  };
  const components = [
    { type: 'text', variant: 'heading', text: clip(trip.name, 40) },
    {
      type: 'text',
      variant: 'caption',
      text: clip(`${trip.origin} → ${trip.destination}`, 80),
    },
  ];
  if (!reading) {
    components[1] = {
      type: 'text',
      variant: 'body',
      text: clip(
        t('widgetNoReading', language, {
          days: t(`days_${trip.days}`, language),
          hours: formatHours(trip.hours),
        }),
        300,
      ),
    };
    components.push(refresh);
    return { ttl_seconds: TTL, components };
  }
  const traffic = hasTraffic(trip);
  const delay = toMinutes(reading.delay);
  const distance = distanceOf(reading.distanceMeters, units, language);
  components.push({
    type: 'value',
    value: toMinutes(reading.duration),
    unit: t('unitMin', language),
    label: clip(t('tileDuration', language), 24),
    icon: 'clock',
    ...(traffic ? { color: colorOf(delay, threshold) } : {}),
  });
  if (traffic) {
    components.push({
      type: 'value',
      value: delay,
      unit: t('unitMin', language),
      label: clip(t('tileDelay', language), 24),
      icon: 'alert-triangle',
      color: colorOf(delay, threshold),
    });
  }
  components.push({
    type: 'value',
    value: distance.value,
    unit: distance.unit,
    label: clip(t('tileDistance', language), 24),
    icon: 'map',
  });
  if (traffic) {
    components.push({
      type: 'value',
      value: toMinutes(reading.staticDuration),
      unit: t('unitMin', language),
      label: clip(t('tileNoTraffic', language), 24),
      icon: 'navigation',
    });
  }
  const items = [
    { label: t('statusRoute', language), value: clip(reading.description || '—', 40) },
  ];
  if (trip.mode === 'transit' && reading.description) {
    items.push({
      label: t('statusTimes', language),
      value: clip(
        t('timesValue', language, {
          departure: reading.departure || '?',
          arrival: reading.arrival || '?',
          changes: reading.changes ?? 0,
        }),
        40,
      ),
    });
  } else {
    items.push({
      label: t('statusMode', language),
      value: clip(t(`mode_${trip.mode}`, language), 40),
    });
  }
  items.push({
    label: t('statusUpdated', language),
    value: clip(ago(state.at, now, language), 40),
  });
  if (state.error) {
    items.push({ label: t('statusError', language), value: clip(state.error.message, 40) });
  }
  components.push({ type: 'status', items: items.map((item) => ({ ...item, color: 'neutral' })) });
  components.push(refresh);
  return { ttl_seconds: TTL, components };
}

/**
 * @description The "budget" widget.
 * @param {object} options - Options.
 * @param {object} options.usage - The usage counter.
 * @param {object} options.planned - Requests a month the trips plan, per SKU.
 * @param {number} options.percent - The budget, in % of the free usage.
 * @param {string} options.keyState - missing, unknown, ok, refused or paused.
 * @param {string} options.language - The language.
 * @returns {object} The content.
 */
function buildBudgetWidget({ usage, planned, percent, keyState, language }) {
  const inUse = SKU_LIST.filter((sku) => (planned[sku] ?? 0) > 0 || usage.used(sku) > 0);
  // 8 components a card: 2 texts, the status, so 5 gauges at most — the
  // most used SKUs first when more are in use.
  const share = (sku) => usage.used(sku) / usage.budget(sku) + (planned[sku] ?? 0) / 1e9;
  const skus =
    inUse.length > MAX_GAUGES
      ? [...inUse].sort((a, b) => share(b) - share(a)).slice(0, MAX_GAUGES)
      : inUse.length > 0
        ? inUse
        : [SKUS.TIME_AWARE];
  const plannedText =
    Object.entries(planned)
      .filter(([, count]) => count > 0)
      .map(([sku, count]) =>
        t('budgetPlanned', language, {
          count: formatNumber(count, language),
          sku: t(`skuShort_${sku}`, language),
        }),
      )
      .join(', ') || t('budgetNothingPlanned', language);
  const keyColors = {
    ok: 'success',
    unknown: 'neutral',
    refused: 'danger',
    missing: 'warning',
    paused: 'warning',
  };
  const keyTexts = {
    ok: 'budgetKeyOk',
    unknown: 'budgetKeyUnknown',
    refused: 'budgetKeyRefused',
    missing: 'budgetKeyMissing',
    paused: 'budgetPaused',
  };
  return {
    ttl_seconds: TTL,
    components: [
      {
        type: 'text',
        variant: 'heading',
        text: clip(formatMonth(usage.month(), language), 40),
      },
      {
        type: 'text',
        variant: 'caption',
        text: clip(t('budgetCaption', language, { percent }), 80),
      },
      ...skus.map((sku) => {
        const used = usage.used(sku);
        const budget = usage.budget(sku);
        return {
          type: 'gauge',
          value: Math.min(used, budget),
          min: 0,
          max: budget,
          label: clip(
            t('gaugeLabel', language, {
              sku: t(`skuShort_${sku}`, language),
              budget: formatNumber(budget, language),
            }),
            24,
          ),
          color: used >= budget ? 'danger' : used >= budget * 0.8 ? 'warning' : 'success',
        };
      }),
      {
        type: 'status',
        items: [
          {
            label: t('budgetPlannedLabel', language),
            value: clip(plannedText, 40),
            color: 'neutral',
          },
          {
            label: t('budgetKey', language),
            value: clip(t(keyTexts[keyState] ?? 'budgetKeyUnknown', language), 40),
            color: keyColors[keyState] ?? 'warning',
          },
        ],
      },
    ],
  };
}

export {
  WIDGETS,
  WIDGET_ACTIONS,
  TTL,
  MAX_ITEMS,
  MAX_GAUGES,
  clip,
  messageContent,
  distanceOf,
  colorOf,
  mapsUrl,
  buildTripsWidget,
  buildTripWidget,
  buildBudgetWidget,
};
