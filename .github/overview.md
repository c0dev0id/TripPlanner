# Overview

Most route planners model one route, or one track with a handful of waypoints. A
multi-day motorcycle trip is more than that: the ride to the destination, days that loop
out from one hotel and back, breaks with a duration, lunch at a fixed time, a fixed
arrival in the evening, places to stop at and places that are optional, alternative
routes for bad weather, hotel bookings and receipts, and afterwards photos and notes
about the roads as they turned out to be.

Trip Planner is a web application at <https://planner.codevoid.de> that plans the whole
trip. A trip is a sequence of days. A day has one or more routes, drawn on a map and
routed along roads or imported as tracks, and stops along them: a hotel, a lunch, a
pass, a fuel stop, each with a kind, an arrival time and a pause where they matter.
A stop is bound to a point of a route, so that it is a waypoint and a route point at
once, or stands free beside the route and is ordered by where the route passes closest.
Photos, receipts, documents and comments attach to the trip, a day, a stop or a route.

From the stop times and the routing durations the planner computes each day's timeline
and shows where a fixed arrival cannot be met. A library view organises a user's trips in
folders with a search across them, and lets days, stops and routes be copied, moved,
reordered and duplicated. Export produces GPX in the shapes devices and other
applications need: one file or one per day, tracks or routes, with or without optional
parts, as a single file or a zip.

Users have accounts. Sign-up is by invitation: visitors join a waiting list and an admin
sends invitations. All data lives on the server in a SQLite database and a file store.
The map and route editor are taken from Layer Slayer (<https://github.com/c0dev0id/LayerSlayer>);
routing is done in the browser by the FOSSGIS OSRM servers.

## Phases

Phases 0 to 5 are built; testing phase 1 changed the model (see decisions.md), which
phase 2 brought in. The later work describes intent and changes as it progresses.

| Phase | Content | Done when |
|---|---|---|
| 0 Foundation | PHP application, SQLite schema, accounts with waiting list and invitations, sign-in, password reset, landing page, frontend skeleton with an empty map, CI and deployment, these documents. | A user signs in at planner.codevoid.de and sees an empty trip list. |
| 1 Plan on a map | Trips, days, stops and routes. The route editor from Layer Slayer: points, routed and straight legs, undo and redo, recalculation. Autosave. Export as one GPX per trip or per day with tracks and stop waypoints. | Done; its stop-sequence model is replaced in phase 2. |
| 2 Routes and stops | Routes as geometry with stops bound to route points or free beside the route; several routes per day, each with its profile; editing as a mode of one route; the panel listing routes and stops in riding order with distances, panning the map; neighbouring days dimmed. Folders for trips and a search across them. | Built; a weekend planned on it and the GPX working on the device confirm it. |
| 3 Time | Dates on days. Arrival times and pauses on stops, the computed day timeline from the first timed stop, with waiting and late arrivals. Day summary: distance, riding time, departure and arrival, pauses, late stops. | Built; a day planned with a fixed lunch confirms it. |
| 4 Library and export | GPX import into a day: routes, tracks, Garmin's calculated way, waypoints as stops. Move, duplicate and copy for days, routes, stops and trips. The export dialog with scope, packaging, tracks or routes, optional parts, reach of free stops, and saved presets. | Built; an export that works on the device and an import of a file from it confirm it. |
| 5 After the trip | A journal of notes and files on the trip, a day, a stop or a route. Photos placed on the day and the map by their EXIF time and position. Trip state planned or done. A read-only trip page for printing, shared under a link. | Built; a ridden trip with its photos and notes on the shared page confirms it. |
| Later | Sharing between users. Valhalla routing with its motorcycle costing. Elevation and surface colouring of routes. Further export formats. |  |
