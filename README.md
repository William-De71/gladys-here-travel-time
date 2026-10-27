# Gladys HERE Travel Time

**English** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Español](README.es.md)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/William-De71/gladys-here-travel-time?sort=semver)](https://github.com/William-De71/gladys-here-travel-time/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/William-De71/gladys-here-travel-time/release.yml?branch=main&label=CI)](https://github.com/William-De71/gladys-here-travel-time/actions/workflows/release.yml)
[![Gladys](https://img.shields.io/badge/Gladys-%E2%89%A5%205.3.0-2f6fb5)](https://gladysassistant.com)

![HERE Travel Time for Gladys Assistant](cover.jpg)

[Gladys Assistant](https://gladysassistant.com) external integration that follows your usual trips with the travel times of HERE: car, truck, scooter / motorcycle, bicycle, walking and public transport, live traffic, traffic delay, distance, main roads or lines, scenes when the route changes, and dashboard widgets. It uses the official HERE Routing, Public Transit and Geocoding & Search APIs with your own API key, and keeps its requests within the free monthly usage of the HERE Base plan by default.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) · [Español](docs/es.md).

Not affiliated with HERE. **Not tested with a real HERE API key yet**: the requests follow the OpenAPI specifications served by the HERE APIs, checked against their real error answers.

## Features

- Trips typed in **plain forms** of the configuration (no JSON): from and to as an address (geocoded once, then cached), "latitude, longitude", `home` or `@name` for a house of Gladys; car (with or without live traffic), truck, scooter / motorcycle, bicycle, walking or public transport; avoid tolls, motorways and ferries.
- **One device per trip**: travel time (with live traffic by car, truck and scooter), time without traffic, traffic delay, distance, main roads — or, by public transport, the lines and times ("Bus C1 → Métro B · 07:49–08:16").
- Read only **on the days and hours you choose** ("6-10, 16-20", Monday to Friday…), at an interval of 5 to 240 minutes.
- A **monthly budget per request type** (time-aware routing, routing, truck, scooter, public transit, geocoding): 90 % of the free usage of HERE by default; the intervals are stretched rather than going over.
- **3 scene triggers**, **2 scene actions** and **3 dashboard widgets** (below), with a link to the route on HERE WeGo.
- Four languages everywhere: English, French, German, Spanish.

## How it works

![Architecture: Gladys talks to the integration container, which calls the HERE APIs with the user's key (illustration)](docs/assets/architecture.svg)

```mermaid
flowchart LR
  G[(Gladys)] -- "REST /api/integration/v1/* + WebSocket" --> I[gladys-here-travel-time container]
  I -- "devices, states, scene events, widgets" --> G
  U[Configuration buttons] -- "add, edit, remove a trip" --> I
  I -- "setConfig: the trips, in the Gladys database" --> G
  I -- "getHouses: home, @name" --> G
  I -- "HTTPS GET, apiKey" --> R[HERE Routing API v8]
  I -- "HTTPS GET, apiKey" --> T[HERE Public Transit API v8]
  I -- "HTTPS GET, once per address" --> Q[HERE Geocoding & Search v7]
  C[Clock, TZ of Gladys] -- "days, hours, interval, budget" --> I
```

From a new trip to a scene:

```mermaid
sequenceDiagram
  participant U as User
  participant G as Gladys
  participant I as Integration
  participant H as HERE APIs
  U->>G: Add a trip (Work, car, 6-21 Monday to Friday)
  G->>I: action add_trip
  I->>H: geocode the two addresses (once)
  I->>G: setConfig (the trips), discovered devices
  I->>H: routes (car, live traffic)
  H-->>I: 38 min, 24 min at free-flow speed, 11.8 km, via M6, A6
  U->>G: Discover, add "Work"
  G->>I: device created
  I->>G: travel time 38, delay 14, distance 11.8, route M6, A6
  Note over I: every 15 minutes within the hours
  I->>H: routes
  I->>G: changed values only
  G->>G: device trigger "delay above 10 min": the scene sends a message
```

### Transport

`transports: ["cloud"]`: the trips are computed by HERE. **The coordinates of your trips are sent to HERE** with your API key at each reading, and an address once when it is geocoded; nothing else leaves your Gladys. The trips themselves are stored in the Gladys configuration (and follow its backups); `/data` keeps the last readings, the request counter and the geocoded addresses.

## Devices and features

| Device       | Features (category / type)                                                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One per trip | Travel time (`duration` / `integer`, minutes), time without traffic and traffic delay (trips with live traffic), distance (`distance-sensor` / `decimal`, km), route: main roads, or lines and times by public transport (`text`) |

External ids rest on a random identifier given to each trip when it is added and kept for ever, never on its name nor its addresses: renaming a trip or moving its destination keeps its device and its history. Changing between a mode with live traffic (car, truck, scooter) and one without (car without traffic, bicycle, walking, public transport) adds or removes the traffic features ("Update" on the Discover tab).

## Scene triggers, actions and widgets

![The three widgets: travel times of the trips, one trip and the requests of the month (generated illustration, not a screenshot)](docs/assets/widgets.en.png)

**Widgets**: Travel times (the trips with time, distance, roads or lines, a badge — the delay in green, orange from 3 minutes, red from the delay threshold; the first departure or the real-time delay by public transport — a HERE WeGo link and a "Refresh all" button), Trip (one trip: up to four tiles, route, times, last reading, "Refresh"), HERE requests (one gauge per request type, the plan of the month, the state of the key). A refresh button spends one request per trip, none for a trip read less than a minute ago.

**Triggers** (one event per transition, never as the result of an action):

- The route of a trip changes: at a scheduled reading, the fastest route goes by other roads (a closed road, an accident) or other lines. Filter: the trip. Variables: name, route, previous route, travel time, delay, distance, summary.
- The monthly budget is almost used: a request type reaches 80 %, then 100 %, once each per month. Filters: level, request type.
- HERE refuses the API key: once, until a request works again. Variables: reason, summary (with what to fix).

The delay, the travel time and the distance are device features: "the delay goes above 10 minutes" is a device trigger of Gladys.

**Actions**: compute a route between any two places now (travel time, time without traffic, delay, distance, route, departure and arrival times, summary sentence); read a trip now, outside its hours too (same outputs, the device is updated).

Examples:

- When the delay of "Work" goes above 10 minutes on a weekday morning → send the summary and set the alarm 15 minutes earlier.
- When the route of "Work" changes → notify "Traffic diverted: {{triggerEvent.data.summary}}".
- At 7:15 → read the public transport trip "Office" now → send its summary: lines, first departure, changes, real-time delay.

## Requirements

- Gladys Assistant **5.3.0** or later (widgets and scenes of integrations, catalog keywords of Gladys 5.3): older instances cannot install the integration.
- A **HERE API key**: a free account on [platform.here.com](https://platform.here.com) (Base plan, a payment method is asked at sign-up), an app registered in the Access Manager, an API key created in its Credentials tab. Step by step in [docs/en.md](docs/en.md#prerequisites).
- The timezone of Gladys set correctly (Settings > System): the hours of the trips are read in it.
- For `home` / `@name`: the location of the houses in Settings > Houses (the integration asks for the `location` permission).

### Cost

HERE counts one transaction per request; the Base plan gives a free monthly usage per request type ([pricing](https://www.here.com/get-started/pricing) read on 2026-10-26):

| Request type       | Trips                                 | Free a month | Then, per 1,000 |
| ------------------ | ------------------------------------- | ------------ | --------------- |
| Time-aware routing | car with live traffic                 | 5,000        | 2.92 USD        |
| Routing            | car without traffic, bicycle, walking | 30,000       | 0.88 USD        |
| Truck              | truck                                 | 5,000        | 2.92 USD        |
| Scooter            | scooter / motorcycle                  | 5,000        | 2.92 USD        |
| Public transit     | public transport                      | 5,000        | 2.92 USD        |
| Geocoding          | each new address, once                | 30,000       | 0.88 USD        |

A car trip read every 15 minutes from 6 to 21, Monday to Friday, plans about 1,300 requests a month: three of them fit in the default budget (90 % of 5,000), about 18 without live traffic. Beyond, the intervals of the trips of that type are stretched. A car request without live traffic sends `departureTime=any`, as HERE requires for the Routing rate. The free usage is per HERE account: other apps count too.

## Installation

- **From the store**: Integrations → HERE Travel Time → Install.
- **From the repository URL**: Integrations → external integration → `https://github.com/William-De71/gladys-here-travel-time`.
- **Developer mode**: run `npm start` with the variables given by Gladys (see Development).

## Configuration

| Field or button                   | Default   | Meaning                                                                                              |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| HERE API key                      | —         | Required, a secret                                                                                   |
| Default interval                  | 15 min    | 5 to 240; for the trips without their own                                                            |
| Default delay threshold           | 10 min    | Red badge in the widgets from this delay                                                             |
| Monthly budget                    | 90 %      | Share of the free usage of each request type; above 100, HERE bills                                  |
| Language of the texts             | automatic | Feature names, route texts, scene summaries, button messages, language asked from HERE               |
| Add / Edit / Remove a trip        | —         | One form per trip: name, from, to, mode, live traffic, avoid, days, hours, interval, threshold       |
| List the trips / Test the API key | —         | Schedule, plan and last reading of each trip; a short walk in Paris from coordinates (1 routing req) |

## Usage

1. Paste your API key, then press **Test the API key** (Integrations → HERE Travel Time → Configuration).
2. **Add a trip** for each usual trip and check the places in the answer; its first reading comes within a minute when it is in its hours.
3. **Discover**, then add the trips you want as devices.
4. Add the widgets to a dashboard, and build scenes with the device features, the triggers and the actions.

## Development

```bash
npm install
npm test                       # node --test, never touches the network
npm run lint                   # ESLint
npm run format:check           # Prettier
npx github:GladysAssistant/integration-store . --skip-image-check
scripts/build-cover.sh         # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh   # docs/assets/widgets.<lang>.png
```

Locally, the SDK reads `GLADYS_HOST_API_URL`, `GLADYS_INTEGRATION_TOKEN` and `GLADYS_INTEGRATION_SELECTOR` (given by Gladys in developer mode), and the integration reads `TZ`. `DEBUG=gladys-integration-sdk` shows the SDK logs.

The tests cover the HERE client (queries per mode, planning mode, avoid options, sections and ferries, route labels and their fallback, public transport lines and times, errors 401 / 403 / 429 / 400, notices, billing count, the key never in a message), the places (coordinates, houses, geocoding cache), the schedule (hours, days, midnight, monthly plan, stretching), the forms and the registry, the devices (the fields the Discovery screen requires), the widgets (`validateWidgetContent`), the scene events and outputs, the clock (interval, restart, refused key, 429, budget), the manifest, the four languages, the release script, and the whole integration against the fake Gladys of the SDK and a fake fetch. `test/structure.test.js` freezes every key users store.

## Release process

![Release pipeline (illustration)](docs/assets/release-pipeline.svg)

Every merge on `main` runs the CI, then computes the version from the [Conventional Commits](https://www.conventionalcommits.org/) since the last tag: `feat` → minor, `fix` / `perf` → patch, `!` or `BREAKING CHANGE` → major (a minor below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build` alone publish nothing. The changelog section is generated, the tag pushed, the multi-architecture image built, then `main` receives the release commit, the GitHub Release is created and a last job checks the public image, the store validator and the topic.

- The pull request title becomes the squash commit, then the changelog line: write it in English, for the user (`pr-title.yml` checks it). Never edit `CHANGELOG.md` by hand.
- 1.0.0 is a decision: Actions → Release → Run workflow with `release-as: 1.0.0`. `dry-run` shows the version and the notes without publishing.
- **Protected branch**: the release pushes its commit to `main` with `GITHUB_TOKEN`. The `protect-main` ruleset (no deletion, no force-push) lets it through; a stricter rule (pull request required, status checks) would need GitHub Actions in its bypass list, or a GitHub App.
- After the first release, make the `ghcr.io` package public (Package settings → Change visibility), or Gladys cannot pull it.

## Troubleshooting

See [docs/en.md](docs/en.md#troubleshooting). Report issues with the versions of Gladys and of the integration, the result of "List the trips" (hide your addresses if you wish) and the logs of the integration. Never paste your API key.

## Contributing

Issues and pull requests are welcome. Run `npm run format:check && npm run lint && npm test` before opening a pull request, and keep every external id and stored key unchanged (see [CLAUDE.md](CLAUDE.md)).

## Security

See [SECURITY.md](SECURITY.md): report vulnerabilities privately. The API key is a `secret` field: never logged, never written to `/data`, sent only to the `hereapi.com` APIs over HTTPS (in the `apiKey` query parameter, the only key-based authentication of these APIs: the URLs are never logged and every error message is scrubbed of the key).

## Screenshots to come

The images above are illustrations, not screenshots. Real screenshots will go in `docs/assets/screenshots/` (PNG, 1280 × 800): `configuration.png` (the "Add a trip" form), `discovery.png`, `device.png`, `scene.png`.

## License

[Apache License 2.0](LICENSE) — see also [NOTICE](NOTICE). HERE is a trademark of HERE Global B.V. Thanks to the Gladys documentation and SDK, and to the Home Assistant HERE Travel Time integration for its ergonomics.
