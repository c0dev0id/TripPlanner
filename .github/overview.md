# Overview

Most route planners model one route, or one track with a handful of waypoints. A
multi-day motorcycle trip is more than that: the ride to the destination, days that loop
out from one hotel and back, breaks with a duration, lunch at a fixed time, a fixed
arrival in the evening, places to stop at and places that are optional, alternative
routes for bad weather, hotel bookings and receipts, and afterwards photos and notes
about the roads as they turned out to be.

Trip Planner is a web application at <https://planner.codevoid.de> that plans the whole
trip. A trip is a sequence of days. A day is a sequence of stops, each at a place, with
an arrival time and a pause where they matter, and between consecutive stops one or more
routes: drawn on a map and routed along roads, or imported as a track. Hotels and other
places are kept once per trip and referenced by the stops that use them. Photos,
receipts, documents and comments attach to the trip, a day, a stop, a route or a place.

From the stop times and the routing durations the planner computes each day's timeline
and shows where a fixed arrival cannot be met. A library view lists a user's trips and
lets days, stops, routes and places be copied, moved, reordered and duplicated. Export
produces GPX in the shapes devices and other applications need: one file or one per day,
tracks or routes, with or without optional parts, as a single file or a zip.

Users have accounts. Sign-up is by invitation: visitors join a waiting list and an admin
sends invitations. All data lives on the server in a SQLite database and a file store.
The map and route editor are taken from Layer Slayer (<https://github.com/c0dev0id/LayerSlayer>);
routing is done in the browser by the FOSSGIS OSRM servers.

## Phases

Phase 0 is in progress. Later phases describe intent and change as the work progresses.

| Phase | Content | Done when |
|---|---|---|
| 0 Foundation | PHP application, SQLite schema, accounts with waiting list and invitations, sign-in, password reset, landing page, frontend skeleton with an empty map, CI and deployment, these documents. | A user signs in at planner.codevoid.de and sees an empty trip list. |
| 1 Plan on a map | Trips, days, places, stops, one route per gap. The route editor from Layer Slayer: points, routed and straight legs, undo and redo, recalculation. Day switcher, autosave. Export as one GPX per trip or per day with tracks and stop waypoints. | A weekend is planned on it and the GPX works on the device. |
| 2 Time | Stop roles, arrival times, pauses. The computed day timeline with slack and conflicts. Day summary: distance, riding time, departure and arrivals. |  |
| 3 Library and export | Several routes per gap with the optional flag. GPX import into a gap: routes, tracks, Garmin route points. Copy, move, duplicate and reorder for days, stops, routes, places and trips. The export dialog with all options and saved presets. |  |
| 4 After the trip | Attachments and comments on everything. Photos placed on the day and the map by their EXIF time and position. Trip state planned or done. A read-only trip page for printing and sharing. |  |
| Later | Sharing between users. Valhalla routing with its motorcycle costing. Elevation and surface colouring of routes. Further export formats. |  |
