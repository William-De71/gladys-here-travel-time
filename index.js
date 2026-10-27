// -----------------------------------------------------------------------------
// Entry point of the HERE Travel Time external integration.
//
// Travel times with live traffic, through the HERE Routing, Public Transit and
// Geocoding & Search APIs and the user's own API key:
//   - devices: one per trip declared in the configuration (travel time,
//     time without traffic, traffic delay, distance, route), offered on the
//     Discovery screen (see src/device.js);
//   - scene triggers: the route changes, the budget is almost used, HERE
//     refuses the key;
//   - scene actions: compute a route now, read a trip now;
//   - dashboard widgets: the trips, one trip, the requests of the month.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the hours of the trips are read in it)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the HERE Travel Time integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
