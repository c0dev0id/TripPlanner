# Core features

## Available

- Accounts: a waiting list on the landing page, invitations by mail from an admin page or
  the command line, sign-in, sign-out, password reset by mail.
- A library of the user's trips: create, open, rename, delete.
- Trips as a sequence of days; a day as a sequence of stops at places, with one route
  between consecutive stops. Days and stops are added, renamed and removed in the panel.
- Places kept once per trip, created with each new stop; a stop references its place, so
  renaming or moving the place changes every stop at it.
- Routes drawn on the map: a tap adds a stop at the end of the day or, on a route, splits
  it there; a tap on a route inserts a point that shapes it; stops and points are dragged
  and deleted; the leg to any point or stop can be straight. Routed along the roads by
  OSRM with a road, bike or foot profile per day, with undo and redo, and a reroute of
  the whole day. Legs not routed yet are dashed, failed ones red with a retry.
- The distance of each day in the panel, from the routed legs.
- Every change saved to the server a moment later, as one document with a version; a
  save over a newer version is refused and the trip offered for reloading.
- GPX export by scope: the whole trip in one file, one day, or one file per day in a
  zip. Places of the stops become waypoints, each route a track named after its day and
  its two stops.

## Planned

- Routes as geometry alone, with stops bound to a route point (a waypoint and a route
  point at once, dragged together) or free beside the route, ordered by where the route
  passes closest. A route point converted into a stop, a free stop connected to the
  route, a bound stop disconnected. Several routes per day, each with its own profile and
  optional flag; editing as a mode of one route, with the route points shown only then.
- The panel listing a day's routes and its stops in riding order with their distance
  from the start, the plain route points shown on request, the map panning to a clicked
  entry; the days before and after shown dimmed on the map, switchable.
- Folders for trips in the library and a search across all folders on trip and folder
  names.
- Stops with an arrival time and a pause, and a computed timeline per day: departure,
  arrival at each stop, slack or conflict against fixed arrival times, riding time.
- GPX import into a route: routes, tracks, Garmin's calculated route points.
- Copy, move, duplicate and reorder for days, stops, routes and trips.
- The export dialog with all options and saved presets.
- Photos, receipts and documents attached to the trip, a day, a stop, a route or a place;
  photos placed by their EXIF time and position; comments for notes before and after the
  trip.
- A read-only trip page for printing and sharing.
- A base map switcher; a light and dark interface switchable by hand (it follows the
  browser now).
