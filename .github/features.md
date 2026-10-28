# Core features

## Available

- Accounts: a waiting list on the landing page, invitations by mail from an admin page or
  the command line, sign-in, sign-out, password reset by mail.
- A library of the user's trips in folders, one level deep: create, open, rename,
  duplicate and delete trips, create, rename and delete folders, move a trip between
  folders, create a trip in the open folder. A search by name across trips and folders,
  listing at most twenty results.
- Trips as a sequence of days; a day as one or more routes and its stops. Days and routes
  are added in the panel and named, set up and removed in their dialogs; the trip has a
  description and a day has notes, shown under the day's row and on the read-only page.
  A day is moved up or down and duplicated
  (with new ids, undated); a route is moved up or down within its day, duplicated, or
  moved to another day with the stops bound to it; a stop is copied to another day as a
  free stop.
- Routes as geometry: points in order with routed legs between them, one profile (road,
  bike, foot) per route. A click on a route's row selects it and shows the tools over
  the map. The hand, the default, moves the map and drags points and stops without
  adding anything; with the point tool a tap adds a point at the route's end or, on the
  line, inserts one there; points are dragged and deleted; the leg to any point can be
  straight. The space bar holds the hand while another tool is picked. Routed along the roads by Valhalla's motorcycle, bicycle or pedestrian
  costing, with a motorway dial per road route (avoid, allow, prefer), undo and redo, and
  a reroute of the route. Legs not routed yet are dashed, failed ones red with a retry.
- Stops bound to a route point (a waypoint and a route point at once, dragged together)
  or free beside the route. The stop tool makes a stop of a route point, inserts one on
  the line, or places a free stop elsewhere; a free stop is connected to the route where
  it passes closest, a bound one disconnected. A stop has a kind (hotel, restaurant,
  café, fuel, sight, photo spot, break, other) drawn on the map, a name, address,
  contact, booking reference and notes in a dialog.
- The panel lists the selected day's routes with profile, distance and the number of
  stops on each. Under the selected route stand its stops and route points in riding
  order with the distance from the day's start; free stops take the place where the
  route passes closest, and say how far beside it they stand. A click pans the map to
  the entry. Free stops of a day without a route are listed on their own. The days before and after
  the selected one are drawn dimmed on the map, switchable. The panel is as wide as its
  edge is dragged, kept per browser; a double click on the edge puts the default back.
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
- GPX import into a day: a file's routes become routes with every point, their legs
  routed, except those the file carries the way a Garmin calculated for, which keep that
  way; its tracks become routes of kind track, simplified to at most 500 points joined by
  straight legs; its waypoints become stops, bound to a route point they stand on, free
  otherwise, with their type as the kind where it is one of ours.
- Routes and stops can be marked optional, each in its dialog, and are shown so.
- GPX export from a dialog: the whole trip or the selected day; one file or one file per
  day in a zip; routes as tracks with their full line, or as routes of their points for
  the device to route between; with or without the optional routes and stops; free stops
  within a chosen distance of a route. Stops become waypoints with their kind as type;
  each route is named after its day and its own name. Named presets of these options are
  kept with the account.

- A journal on the trip, on a day, on a stop and on a route, opened from their rows and
  menus: entries of a note, a file (a photo, a receipt, a document) or both, edited and
  deleted in place; rows say how many entries a part has. The trip's own journal reads
  the whole trip top down: a heading per day, under it the day's entries, then those of
  its routes and its stops in riding order, with smaller photos; an entry that stands
  somewhere has a button that shows it on the map, with its day. A photo's time and position
  are read from its EXIF data: it is shown with the time it was taken, stands on the
  map where it was taken, and a photo added to the trip goes to the day of its date.
  A photo is made into a JPEG of at most 2560 px in the browser before it is uploaded,
  HEIC included, with its EXIF kept, so that a phone sends little and every browser shows
  it. A photo opens large over the page from its preview in the journal or its marker on
  the map, in the planner and on the read-only page alike; other files open or download
  under their name. An entry is also made at a spot on the map, from the map's menu, on
  the selected day: it stands there, as a journal icon that opens the day's journal, or
  as its photo's preview; a photo that knows where it was taken stands there instead.
  An entry stays with the trip when its part is removed.
- A trip is planned or done; the library marks done trips.
- A read-only page of the trip for reading and printing: the map with every day, the
  journal, each day with its routes and its stops in riding order with their times,
  addresses, bookings and notes. The page is the owner's, or shared under a link that
  needs no sign-in and can be withdrawn.

- A place and address search over the map, by Nominatim on Enter: the first place found
  gets a pin and the map flies there, the others are listed to pick from. The pin stays
  until the search is cleared; while a route is edited, its menu adds a point or a stop
  there.
- A base map to choose on the map: OpenFreeMap's Liberty, Bright, Positron and Dark
  styles, or the OpenTopoMap, OpenStreetMap and CyclOSM raster tiles; the route lines
  and markers stay. A locate-me button shows where the browser is. The interface light
  or dark by hand, or as the browser says. Both choices are kept in the browser.
