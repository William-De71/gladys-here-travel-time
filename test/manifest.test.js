import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { TRIGGERS, SCENE_ACTIONS, BUDGET_LEVELS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { REFRESH_MINUTES, DELAY_THRESHOLD, BUDGET_PERCENT, AUTO_LANGUAGE } from '../src/config.js';
import { MODES, SKUS } from '../src/here-api.js';
import { DAY_PRESETS } from '../src/schedule.js';
import { KEEP } from '../src/trips.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const REPO = 'William-De71/gladys-here-travel-time';

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'HERE Travel Time');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\./);
  assert.equal(
    manifest.docker_image,
    `ghcr.io/william-de71/gladys-here-travel-time:${pkg.version}`,
  );
  assert.equal(manifest.cover_image, `https://raw.githubusercontent.com/${REPO}/main/cover.jpg`);
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-here-travel-time');
});

test('declares the cloud transport: HERE only, never a local device', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  const api = source('../src/here-api.js');
  for (const host of ['router', 'transit\\.router', 'geocode\\.search']) {
    assert.match(api, new RegExp(`https://${host}\\.hereapi\\.com/`), host);
  }
  for (const file of [
    'places',
    'app',
    'trips',
    'events',
    'widgets',
    'device',
    'schedule',
    'state',
    'usage',
  ]) {
    assert.doesNotMatch(
      source(`../src/${file}.js`),
      /fetch\(|node:https?|node:net|node:dgram/,
      file,
    );
  }
  // A single channel: no transport to publish per device.
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
});

test('Gladys 5.3.0 for the catalog keywords; no widget form; only the location permission', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.doesNotMatch(source('../src/widgets.js'), /fields:/, 'a button form would need 5.2.0');
  assert.deepEqual(manifest.categories, ['transport']);
  // "home" and "@name": the coordinates of the houses (getHouses).
  assert.equal(manifest.location, true);
  assert.match(source('../src/app.js'), /gladys\.getHouses\(\)/);
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  assert.doesNotMatch(JSON.stringify(manifest), /"source":"houses"/);
  const key = byKey(manifest.config_schema).get('api_key');
  assert.deepEqual([key.type, key.required], ['secret', true]);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  const app = source('../src/app.js');
  assert.deepEqual(
    manifest.scene_triggers.map((t) => t.key),
    Object.values(TRIGGERS),
  );
  assert.deepEqual(
    manifest.scene_actions.map((a) => a.key),
    Object.values(SCENE_ACTIONS),
  );
  assert.deepEqual(
    manifest.widgets.map((w) => w.key),
    Object.values(WIDGETS),
  );
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of ['TRIPS', 'TRIP']) {
    assert.match(app, new RegExp(`onWidgetAction\\(WIDGETS\\.${key}`), key);
  }
  assert.deepEqual(Object.values(WIDGET_ACTIONS), ['refresh', 'refresh_all']);
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((a) => a.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
  // The trigger fields are keys of the event data (the core compares them).
  const triggers = byKey(manifest.scene_triggers);
  assert.deepEqual(
    (triggers.get('route_changed').fields ?? []).map((f) => f.key),
    ['trip'],
  );
  assert.deepEqual(
    triggers.get('budget_alert').fields.map((f) => f.key),
    ['level', 'sku'],
  );
  assert.deepEqual(values(triggers.get('budget_alert').fields[0]), Object.values(BUDGET_LEVELS));
  assert.deepEqual(values(triggers.get('budget_alert').fields[1]), Object.values(SKUS));
});

test('mirrors the bounds and values of the code', () => {
  const config = byKey(manifest.config_schema);
  for (const bound of ['min', 'max', 'default']) {
    assert.equal(config.get('refresh_minutes')[bound], REFRESH_MINUTES[bound]);
    assert.equal(config.get('delay_threshold')[bound], DELAY_THRESHOLD[bound]);
    assert.equal(config.get('budget_percent')[bound], BUDGET_PERCENT[bound]);
  }
  const add = byKey(byKey(manifest.actions).get('add_trip').fields);
  assert.deepEqual(values(add.get('mode')), MODES);
  assert.deepEqual(values(add.get('days')).sort(), [...DAY_PRESETS].sort());
  assert.deepEqual([add.get('interval_minutes').min, add.get('interval_minutes').max], [5, 240]);
  const edit = byKey(byKey(manifest.actions).get('edit_trip').fields);
  assert.deepEqual(values(edit.get('mode')), [KEEP, ...MODES]);
  assert.deepEqual(values(edit.get('avoid_tolls')), [KEEP, 'yes', 'no']);
  assert.equal(edit.get('interval_minutes').min, 0, '0 goes back to the default');
  assert.deepEqual(values(edit.get('traffic')), [KEEP, 'yes', 'no']);
  assert.deepEqual([add.get('traffic').type, add.get('traffic').default], ['boolean', true]);
  const compute = byKey(manifest.scene_actions[0].fields);
  assert.deepEqual(values(compute.get('mode')), MODES);
  assert.deepEqual(
    [compute.get('traffic').type, compute.get('traffic').default],
    ['boolean', true],
  );
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.actions.length <= 10);
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
  }
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('catalog keywords and countries of Gladys 5.3.0', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  const keywords = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.ok(keywords.length >= 1 && keywords.length <= 10, 'one to ten keywords');
  keywords.forEach((keyword) => assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword));
  assert.equal(new Set(keywords).size, keywords.length, 'unique once trimmed and lowercased');
  // Usable everywhere: no `countries`, the catalog shows it in every country.
  assert.equal(manifest.countries, undefined);
});
