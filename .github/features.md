# Core features

## Available

- Accounts: a waiting list on the landing page, invitations by mail from an admin page or
  the command line, sign-in, sign-out, password reset by mail.
- A library of the user's trips in folders, one level deep: create, open, rename and
  delete trips and folders, move a trip between folders, create a trip in the open
  folder. A search by name across trips and folders, listing at most twenty results.
- Trips as a sequence of days; a day as one or more routes and its stops. Days and routes
  are added, renamed and removed in the panel.
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
- Every change saved to the server a moment later, as one document with a version; a
  save over a newer version is refused and the trip offered for reloading.
- GPX export by scope: the whole trip in one file, one day, or one file per day in a
  zip. Stops become waypoints with their kind as type, free ones when within two
  kilometres of a route of their day; each route a track named after its day and its
  own name.

## Planned

- Stops with an arrival time and a pause, and a computed timeline per day: departure,
  arrival at each stop, slack or conflict against fixed arrival times, riding time.
- GPX import into a route: routes, tracks, Garmin's calculated route points.
- Copy, move, duplicate and reorder for days, stops, routes and trips.
- The export dialog with all options (scope, packaging, tracks or routes, optional parts,
  proximity) and saved presets.
- Photos, receipts and documents attached to the trip, a day, a stop or a route; photos
  placed by their EXIF time and position; comments for notes before and after the trip.
- A read-only trip page for printing and sharing.
- A base map switcher; a light and dark interface switchable by hand (it follows the
  browser now).
