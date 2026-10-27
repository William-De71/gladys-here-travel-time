# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- Trips declared from the configuration with plain forms ("Add a trip", "Edit a trip", "Remove a trip", "List the trips"), no JSON: name, from and to (an address geocoded once by HERE, "latitude, longitude", "home" or "@name" for a house of Gladys), travel mode (car, truck, scooter / motorcycle, bicycle, walking, public transport), live traffic on or off for a car, avoid tolls, motorways and ferries, days and hours of reading, own interval and delay threshold.
- One device per trip through the HERE Routing and Public Transit APIs: travel time (with live traffic by car, truck and scooter), time without traffic, traffic delay, distance, and the main roads or the lines and times of a public transport trip.
- Readings on the integration's own clock, only on the days and hours of each trip; a monthly budget per request type (time-aware routing, routing, truck, scooter, public transit, geocoding), 90 % of the free usage of the HERE Base plan by default, with intervals stretched rather than going over; addresses geocoded once and cached; "Test the API key" button.
- Scene triggers: the route of a trip changes (other roads or other lines), the monthly budget is almost or fully used, HERE refuses the API key.
- Scene actions: compute a route between any two places now, read a trip now; both return travel time, delay, distance, route, departure and arrival times and a summary sentence.
- Dashboard widgets: travel times of the trips (with delay badges, HERE WeGo links and a refresh button), one trip, requests of the month.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.
