# Core features

## Available

- Accounts: a waiting list on the landing page, invitations by mail from an admin page or
  the command line, sign-in, sign-out, password reset by mail.
- A library of the user's trips in folders, one level deep: create, open, rename,
  duplicate and delete trips, create, rename and delete folders, move a trip between
  folders, create a trip in the open folder. A search by name across trips and folders,
  listing at most twenty results.
- Trips as a sequence of days; a day as one or more routes and its stops. Days and routes
  are added, renamed and removed in the panel. A day is moved up or down and duplicated
  (with new ids, undated); a route is moved up or down within its day, duplicated, or
  moved to another day with the stops bound to it; a stop is copied to another day as a
  free stop.
- Routes as geometry: points in order with routed legs between them, one profile (road,
  bike, foot) per route. A route is edited on its own: a tap adds a point at its end or,
  on the line, inserts one there; points are dragged and deleted; the leg to any point
  can be straight. Routed along the roads by OSRM, with undo and redo, and a reroute of
  the route. Legs not routed yet are dashed, failed ones red with a retry.
- Stops bound to a route point (a waypoint and a route point at once, dragged together)
  or free beside the route. The stop tool makes a stop of a route point, inserts one on
  the line, or places a free stop elsewhere; a free stop is connected to the route where
  it passes closest, a bound one disconnected. A stop has a kind (hotel, restaurant,
  café, fuel, sight, photo spot, break, other) drawn on the map, a name, address,
  contact, booking reference and notes in a dialog.
- The panel lists the selected day's routes with profile and distance, and its stops in
  riding order with the distance from the day's start; free stops take the place where
  the route passes closest. The plain route points are listed on request; a click pans
  the map to the entry. The days before and after the selected one are drawn dimmed on
  the map, switchable.
- A date per day; a new day after a dated one is dated the day after, and the library
  shows a trip as starting on its first dated day. A stop can have a fixed arrival time
  and a pause. From the first timed stop and the routed legs' durations the panel
  computes the day's planned timeline: arrival and departure at each stop, a fixed time
  kept as it is with the waiting before it or by how much the ride falls short of it,
  and the day's summary of departure, arrival at the end, riding time, pauses and the
  stops the ride is short at. Nothing is corrected. Straight legs and legs not routed
  yet count at 50 km/h. Nothing is compared with the clock; that is a navigation
  system's job.
- Every change saved to the server a moment later, as one document with a version; a
  save over a newer version is refused and the trip offered for reloading.
- Routes and stops can be marked optional (a route in its menu, a stop in its dialog)
  and are shown so.
- GPX export from a dialog: the whole trip or the selected day; one file or one file per
  day in a zip; routes as tracks with their full line, or as routes of their points for
  the device to route between; with or without the optional routes and stops; free stops
  within a chosen distance of a route. Stops become waypoints with their kind as type;
  each route is named after its day and its own name. Named presets of these options are
  kept with the account.

## Planned

- GPX import into a route: routes, tracks, Garmin's calculated route points.
- Photos, receipts and documents attached to the trip, a day, a stop or a route; photos
  placed by their EXIF time and position; comments for notes before and after the trip.
- A read-only trip page for printing and sharing.
- A base map switcher; a light and dark interface switchable by hand (it follows the
  browser now).
