# Core features

## Available

- Accounts: a waiting list on the landing page, invitations by mail from an admin page or
  the command line, sign-in, sign-out, password reset by mail.
- A library of the user's trips in folders, which may hold folders: create, open, rename,
  duplicate and delete trips, create, rename and delete folders (for a folder that holds
  anything the confirmation asks whether that moves up into its parent or is deleted with it), move a trip between folders from Move… in its menu, create a trip or a folder
  in the open folder; the arrow goes up one folder at a time. Folders and trips are cards with the name
  over a line of metadata; right-click or a long press on a card opens its menu. A
  search by name across trips and folders, listing at most twenty results.
- Several trips at once: a tap or click on a trip's pad (drawn as a drag grip), or Cmd or
  Ctrl with a click, selects trips of the open folder, Shift with a click a run of them (a
  plain click or tap elsewhere still opens a trip). The menu of the selection moves them
  all to another folder, deletes them all, or merges them into the one selected first. In
  a merge a day joins that trip's day of the same date or goes in among its days by date,
  an undated day at the end; a collection's sections go at its end. The journal moves
  along, and the merged trips are deleted. Trips and collections are not merged with
  each other.
- Trips as a sequence of days; a day as one or more routes and its stops. A day is a
  card with its number and name over its date and length, and its menu (right-click or
  long press) edits, duplicates, pastes into and removes it. Days and routes
  are added in the panel and named, set up and removed in their dialogs or menus; the trip has a
  description and a day has notes, shown under the day's row and on the read-only page.
  A day is dragged into another place by its grip and duplicated (with new ids,
  undated); a route is dragged into another place within its day, duplicated, or
  moved to another day with the stops bound to it, from its row's menu (right-click or
  long press), where Move… opens the other days. Copy in a route's or a stop's menu keeps
  it to be pasted from a day's menu into that day, of the same trip or another: a route
  with the stops bound to it, a stop free where it stands. Copied routes are also pasted
  from a trip's menu in the library, each onto the day of its date or a new day (into a
  collection as a new section each), and from a folder's menu as a new collection with a
  section per route.
- Routes as geometry: points in order with routed legs between them, one profile (road,
  bike, foot) per route. A click on a route's row selects it and shows the tools over
  the map. The hand, the default, moves the map and opens a stop's details, and neither
  adds nor moves anything; a track offers no point tool, and the hand stands in for it while it is picked; with the point tool a tap adds a point at the route's end or,
  on the line, inserts one there; with any tool but the hand points and stops are
  dragged; points are deleted; the leg to any point can be straight. The space bar
  holds the hand while another tool is picked. Routed along the roads by Valhalla's
  motorcycle, bicycle or pedestrian
  costing, with a motorway dial per road route (avoid, allow, prefer), undo and redo, and
  a reroute of the route. Legs not routed yet are dashed, failed ones red with a retry.
- Stops bound to a route point (a waypoint and a route point at once, dragged together)
  or free beside the route. The stop tool makes a stop of a route point, inserts one on
  the line, or places a free stop elsewhere; a free stop within 500 m of the route is
  connected to it where it passes closest, a bound one disconnected. A stop has a kind (start, end, meeting
  point, hotel, restaurant, café, fuel, sight, info, photo spot, break, other) drawn on the
  map, a name, address,
  contact, booking reference and notes in a dialog.
- A trip opens whole: every day's routes on the map with the stops as dots, no day open;
  a click on a day opens it, and another closes it. The panel's arrow goes up one level at a time: from a day to
  the trip, from the trip to the list, in the folder the trip was opened from.
- The panel lists the selected day's routes with profile, distance and the number of
  stops on each. Under the selected route stand its stops and route points in riding
  order with the distance from the day's start; free stops within 500 m take the place
  where the route passes closest, and say how far beside it they stand. A click pans the
  map to the entry. Free stops farther away, or of a day without a route, are listed on
  their own. The days before and after
  the selected one are drawn dimmed on the map, switchable. The panel is as wide as its
  edge is dragged, kept per browser; a double click on the edge puts the default back.
- A date per day; a new day after a dated one is dated the day after, and the library
  shows a trip as starting on its first dated day. A stop can have a fixed arrival time
  and a pause. From the first timed stop and the routed legs' durations the panel
  computes the day's planned timeline: arrival and departure at each stop, a fixed time
  kept as it is, each route starting afresh at its first stop's time where it has one.
  Before a stop whose fixed time the ride misses stands a row of its own: by how much
  the ride is late (red) or early (green), and when it gets there. The route's row and
  the day's summary of departure, arrival at the end, riding time and pauses count the
  stops the ride is late at. Nothing is corrected. Straight legs and legs not routed
  yet count at 50 km/h. Nothing is compared with the clock; that is a navigation
  system's job.
- Every change saved to the server a moment later, as one document with a version; a
  save over a newer version is refused and the trip offered for reloading.
- GPX import into a day: a file's routes become routes with every point, their legs
  routed, except those the file carries the way a Garmin calculated for, which keep that
  way; its tracks keep their line with every point;
  its waypoints become stops, bound to a point of a GPX route they stand on, free otherwise, with
  their type as the kind where it is one of ours, else the kind a Garmin symbol names
  exactly (Information, Restaurant, Gas Station), else a plain stop, and with the
  address and phone numbers Garmin's waypoint extension gives as their address and
  contact. A track's row counts its points and
  lists only its stops, which are free along its line, and the map shows no marker for
  each of its points. Its menu condenses it (Douglas–Peucker at a distance chosen from a
  few, each with the count of points it leaves) or makes a route of it: fewer points,
  every leg routed, with the time the routing will take.
- Import of a folder tree from disk into the open folder of the library, its folders
  recreated (existing ones reused by name), organized one of three ways, chosen in the
  import dialog with what each makes of the tree. A trip per folder: each folder holding
  GPX files becomes a trip named after it without its date; a date in a file's name
  (YYYY-MM-DD, YYYY_MM_DD, or YYYYMMDD at its start) puts it on that day, several files
  of a date on one day; other files are a day each, dated on from a date in the trip
  folder's name, or undated. A trip per file: each GPX file becomes a trip of one day,
  named and dated by the file, in its folder. Planning material: each folder holding GPX
  files becomes a collection with a section per file. Files that are no GPX are reported
  and left out.
- A duplicates report in the library: the routes kept more than once across all trips
  and collections, grouped as exact copies (the same points or the same line, whatever
  the date) or as the same ride kept twice (the same way within a kilometre at both
  ends, lengths within a tenth, nine in ten of each line's points within 75 m of the
  other, on the same date or an undated day). A click selects a route, Cmd or Ctrl one more,
  Shift a run of them; a route's pad adds it or takes it away; a selected row is highlighted. On a touch screen a
  tap on the pad selects and a tap on the route opens it. The menu (right-click or long
  press) opens a single route at its day, and copies or deletes the selected ones. The report is made afresh each time it is shown and after a delete.
- Collections of planning material, such as a long-distance trail by country: listed in
  the library as planning material, opened like a trip but with sections instead of
  days and no dates, times, journal, tools or export. A section lists its routes and
  waypoints; a click on a route shows it whole on the map, on a waypoint goes there, and
  their menus copy them, to be pasted into a day of a trip, or remove them. A section is
  renamed or removed from its menu.
- Routes and stops can be marked optional, each in its dialog, and are shown so.
- GPX export from a dialog: the whole trip or the selected day; one file or one file per
  day in a zip; routes as tracks with their full line, or as routes of their points for
  the device to route between; with or without the optional routes and stops; free stops
  within a chosen distance of a route. Stops become waypoints with their kind as type;
  each route is named after its day and its own name. Named presets of these options are
  kept with the account.

- A journal on the trip, on a day, on a stop and on a route, opened from the icon on
  their rows, which counts their entries: entries of a note, a file (a photo, a receipt, a document) or both, edited and
  deleted in place; rows say how many entries a part has. The trip's own journal reads
  the whole trip top down: a heading per day, under it the day's entries, then those of
  its routes and its stops in riding order, with smaller photos; an entry that stands
  somewhere has a button that shows it on the map, with its day. The journal is a window
  over the map, dragged aside by its title; the map stays usable beside it. A photo's time and position
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
