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

- Stops with a role, an arrival time, a pause and an optional flag, and a computed
  timeline per day: departure, arrival at each stop, slack or conflict against fixed
  arrival times, riding time.
- Several routes between the same stops, with the optional flag.
- GPX import into a gap: routes, tracks, Garmin's calculated route points.
- Copy, move, duplicate and reorder for days, stops, routes, places and trips.
- The export dialog with all options and saved presets.
- Photos, receipts and documents attached to the trip, a day, a stop, a route or a place;
  photos placed by their EXIF time and position; comments for notes before and after the
  trip.
- A read-only trip page for printing and sharing.
- A base map switcher; a light and dark interface switchable by hand (it follows the
  browser now).
