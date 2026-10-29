# Decisions

Brief context and rationale for choices that are not obvious from the code. Newest
entries at the end of their section.

## Model

- **A trip is days; a day is routes with stops along them.** A route planner's model, one
  line with waypoints, cannot hold what a multi-day trip is made of: timed breaks, a lunch
  at a fixed time, loops, alternatives, bookings. The spine is a calendar: a trip has
  days, a day has one or more routes (the roads to drive: a ride, a hike after lunch, an
  option decided on the day) and stops (the points to stop). The first version put stops
  in a sequence with one route between each pair, so that a route began and ended at a
  stop; testing showed that what a tap places while shaping a route is a route point, not
  a stop, and that the route is the primary thing a stop hangs on. The route is now
  geometry alone, as in Layer Slayer, and stops attach to it.
- **A stop is bound to a route point or free.** A bound stop names a route point of one of
  its day's routes and has the same position: dragging either moves both, and it is a
  waypoint and a route point at once. A free stop has a position of its own; its place in
  the day's sequence and its distance from the start are those of the nearest point of
  the route, and the export includes it when it lies within a proximity setting of a
  route. A route point is converted into a stop, a free stop is connected to the route
  (a route point is inserted into the nearest leg at its position) and a bound stop is
  disconnected (the route point goes, the stop stays free). On the map a free stop stands
  at its own position, in a second colour, with a mark on the route where it is nearest.
- **A free stop takes a place along the routes only within 500 m of them.** Farther away
  it stands for itself: the riding sequence leaves it out, so it has no distance, no
  time and no place in the timeline; the panel and the read-only page list it apart
  (standingAlone), without a mark on the route and without the menu's connect. A first
  version kept such stops in the sequence at the day's end and had every reader skip
  them, which one reader forgot. A stop kilometres off the route has no
  meaningful place along it, and an imported file can carry hundreds of waypoints about
  a region. The reach also bounds the search: the legs' segments are kept in blocks of
  32 with a bounding box, and a query looks only into the blocks that could hold a
  nearer place, which took placing 212 waypoints beside 130,000 track points from about
  five seconds to a fifth of one.
- **A stop carries everything about the place; there is no shared place.** A first draft
  kept places apart from stops so that one hotel could serve several nights. That made
  dragging a stop on one day move route points on other days, and it fixed one hotel per
  night when day one may still have two options. A stop holds name, kind, position,
  address, contact, booking reference and notes itself; the same hotel on the next day is
  another stop, copied once the library offers that. Orientation across days comes from
  showing the neighbouring days dimmed on the map instead.
- **Nothing is mandatory or optional by model.** A stop has an arrival time and a pause
  where they matter and an `optional` flag that means whatever the user wants it to mean;
  a route has the same flag.
- **A route's points and legs are one JSON value.** The editor works on a route as a unit,
  as Layer Slayer's does: a list of points and a map from leg key (profile and both ends)
  to geometry. Nothing queries single points, so rows per point would add joins and
  ordering for no gain.
- **Legs carry distance and duration, not geometry alone.** The routing answers all three
  at once; a route's distance and a stop's distance from the start show now, and the
  timeline needs the durations without routing everything again.
- **The profile belongs to the route, and so does the motorway dial.** A day with a ride,
  a hike and a ride is three routes with three profiles; the toolbar sets the profile of
  the route being edited. The dial (avoid, allow, prefer motorways) sits beside it: a
  transfer day wants the motorway, a loop day wants the passes, and both are routes of
  one trip, so an app-wide setting would be wrong for one of them. The dial is part of
  the leg key, so turning it routes the legs again. It counts for the motorcycle only;
  bicycle and pedestrian ignore it.
- **Profiles are Valhalla's costings by name: motorcycle, bicycle, pedestrian.** The
  first names, car, bike and foot, came from OSRM and misled in a motorcycle planner:
  "bike" reads as motorbike, and "car" was the motorcycle costing anyway. Valhalla's auto
  costing is the motorcycle's at the default dial, so it adds nothing; its motor scooter
  costing is built for mopeds kept off motorways, which the dial covers. Bicycle and
  pedestrian stay for the hike after lunch and the rental bike on a rest day.
- **The schedule check is the feature.** The routing returns a duration with every leg. The
  departure plus route durations plus pauses, compared with the fixed arrival times, tells
  before the trip where a day does not work. This is what the times on stops are for.
- **Editing is a mode of one route, entered by selecting it.** Selecting a day shows it:
  its routes in colour, its stops as pins, the days before and after dimmed for
  orientation (switchable). A click on a route's row selects it: its route points
  appear as draggable dots, the tools over the map, and its stops and points under its
  row in the panel, where the other routes stay folded with their stop counts. Stops and
  points belong to a route, so the panel groups them by it; a day-wide list in riding
  order was tried first and hid which route a stop was on. A separate Draw button was
  dropped: selecting and editing are one state, since the toolbar costs nothing while
  the hand is picked. The routing pump serves the selected route's legs first.
- **The hand is the default tool.** A tap on the map adds nothing until the point or the
  stop tool is picked: a click that was meant as a drag used to leave a point behind.
  The hand does not drag points and stops either, so a drag of the map that starts on a
  marker cannot move it; it still opens a stop's details. While a drawing
  tool is picked, holding the space bar gives the hand and releasing it gives the tool
  back, the way image editors do it.

- **Esc steps back one level at a time.** While a route is selected, Esc closes an open
  menu, else returns to the hand, else leaves the route. One key for "get me out of
  this", without ever doing more than the next step back.

## Library

- **The panel shows; dialogs edit.** Each element the panel lists (the trip, a day, a
  route, a stop) has one dialog holding everything the element has to set, and its
  removal, opened from its row's or card's menu, or for the trip by the pencil in the
  panel's header; a folder or a
  trip in the library has only its name to set, in a name dialog. The panel keeps no input
  field but the search: a name field, a date field or a folder select in a row makes the
  row wide and busy, and every setting added later would add another; a dialog grows
  with its element instead. The toolbar follows the same pattern, with one button that
  opens the edited route's dialog in place of radio groups for the profile and the
  motorway dial. This is a balance rather than a rule: the toggles for route points and
  neighbouring days stay in the panel, since they switch what is shown and change
  nothing in the trip.
- **Days and routes are dragged by a grip; the rest is a menu per row.** A day or a route
  is dragged into another place in its list by the grip at the left of its row, or moved
  a place with the arrow keys on it; the menus' move up and move down were dropped.
  Stops have no grip: their order is where they stand along the route. The drag runs
  on pointer events from the grip alone, which works with touch where the browser's
  own drag and drop does not and leaves the rest of the row to its click; about fifty
  lines, no library. A route's or a stop's row, like a card, opens its menu by
  right-click or a long press and has no pencil or dots: a route's menu edits,
  duplicates, moves it to another day, condenses or converts a track and removes it; a
  stop's edits, copies it to another day and removes it. Each row's journal is an icon on
  it that counts the entries. A menu that would list an entry per day or per folder
  (moving a route or a trip, copying a stop) has one item that opens them as a submenu,
  beside it: on hover with a mouse, on a click, a tap or the keyboard otherwise.
  Submenus are part of the one menu mechanism, so every menu can have them.
- **Folders, trips and days are cards whose menu is the card itself.** A card shows two
  lines, the name over its metadata (a folder's trip count; a trip's days, start and
  state; a day's date and length), and has neither pencil nor dots: right-click, the
  menu key or a long press of half a second on the card opens its menu, which therefore
  holds every action the card has (rename, move, duplicate, delete; a day's edit,
  duplicate and remove). The long press is left out on the grip, which drags, and the
  click that ends a held press is swallowed so the card does not open as well. A
  trip's rename from the library goes through `PATCH /trips/{id}` and counts as a
  change to the trip, so an editor holding the old version gets a 409 on its next save
  rather than writing the old name back. The card menus, the row menus and the map's
  context menus and the base map list are one mechanism: one open menu at a time, at a
  viewport position, closed by a press or a scroll elsewhere or by Esc, and by nothing
  else (a first draft had the map close it on its own camera moves, which took a row's
  menu away while the map was still flying to the day). The menu depends on nothing but
  Solid, so the read-only page uses it too. A duplicated day gets no date,
  since the day's date would clash with the original's; a duplicated route keeps its
  points but not the stops, which belong to the day; a route moved to another day takes
  the stops bound to its points along, a stop copied to another day arrives free. A trip
  is copied on the server with new ids for every part, so the copy's parts never name the
  original's.

- **A trip opens whole, and the arrow goes up one level.** Opening a trip shows all its
  days on the map and no day open; the first draft opened the first day, which left no
  level between a day and the trip list. The panel's arrow goes from a day to the trip,
  from the trip to the list; the list keeps its folder while a trip is open, so leaving
  the trip returns to the folder it was opened from rather than to the top.
- **Folders hold folders.** A trip is in one folder or in none, and a folder is at the
  top or inside another. A first version kept folders one level deep, since trips sort by
  year or region; the import of a folder tree from disk made the library mirror deeper
  trees. The library shows one folder at a time, its arrow goes up one level, and search
  results and the move menu name a folder by its path. Deleting a folder moves what it
  holds up into its parent rather than out of every folder. Folders themselves are not
  moved; nothing asked for it, and a folder that cannot move cannot end up inside itself.
- **The search runs in the browser.** The library loads all trip summaries and folders of
  the user (a few hundred small rows at most for a personal planner) and filters them by
  name; the results are capped at twenty. A server search would add an endpoint for
  data the client already holds.
- **A folder tree is imported in the browser.** The library's *Import folder…* opens the
  browser's folder picker (`webkitdirectory`), and the files are read with the same GPX
  import a day uses, then saved through the API: no files on the server, no second GPX
  reader in PHP. The rules follow the paths: a folder that holds GPX files is a trip
  named after it without its date, the folders above it are folders, recreated inside
  the open folder; a date in a file's name (YYYY-MM-DD or YYYY_MM_DD anywhere, YYYYMMDD
  only at the start, where a run of digits elsewhere could be any number) puts it on the day of that date,
  one day per date; other files are a day each, dated on from a date in the trip
  folder's name after the dated days, undated where it has none. Days exist only for
  files, not for the dates between them. Folders are found by name in their parent and
  reused, so an import into an existing tree adds to it; trips are always new. A trip's
  files are read before anything is created, so that a folder of unreadable files leaves
  no empty trip behind.

## Map and appearance

- **Base maps from public servers, chosen per browser.** OpenFreeMap's vector styles
  (Liberty as the default, Bright, Positron, Dark) need no key; OpenTopoMap for relief
  and contours, OpenStreetMap's standard tiles and CyclOSM as raster, for the looks
  riders know from other tools. Each server's attribution rides with its source. The
  choice is a preference of the browser, in localStorage, as the theme is: a matter of
  the device, not of the trip, and it costs no table. The list is fixed in code; adding
  a service of one's own is Layer Slayer's business, not this planner's. The panel's
  width, dragged at its edge, is kept the same way: it depends on the screen.
- **Place search by Nominatim, on Enter, ported from Layer Slayer.** OpenStreetMap's own
  geocoder needs no key; its policy allows one request per second and no search as you
  type, so the box searches when Enter is pressed and keeps a second between requests.
  The search prefers the view without being limited to it. The place found is a pin, not
  a stop: the rider decides what it becomes from the pin's menu while editing a route.
  The hint bar moved from the top of the map to just above the toolbar it describes,
  since the search box took the top left.
- **The route overlay is appended by a style transform.** MapLibre's `setStyle` replaces
  every source and layer. A transform given when the map is made is applied to every
  style it loads afterwards, so the overlay's source and layers are added in one place
  and survive a change of base map, and the source keeps its data, since the transform
  is handed the style being left. Adding them again on every `style.load` would have
  raced the first `setData`.
- **Light or dark by hand is a colour-scheme override.** The stylesheets' colours are
  `light-dark()` pairs that follow the browser; the document's own inline `color-scheme`
  overrides them all at once, with no rule in any stylesheet. The pages set it from the
  preference in one line of inline script before the first paint, so a dark choice never
  flashes light. The pairs themselves live in one stylesheet both bundles load.

## Saving

- **The trip is saved as one document.** The client holds the whole trip, edits it with
  pure functions and an undo history exactly as Layer Slayer's route store does, and
  saves it as one `PUT` 1.5 s after the last change. Fine-grained requests per stop or
  point would have turned undo into a problem of reversing requests. The document carries
  the version it was loaded at; the server refuses a save over a newer version (409) and
  the app offers to reload, which is enough while a trip has one editor.
- **Parts carry client-generated ids and are upserted.** The server upserts each day, stop
  and route by id and deletes the rows the document no longer holds, rather
  than deleting and reinserting: journal entries reference days, stops and routes
  by id and must survive a save. Since the ids are the client's choice, a save first
  checks that none of them belongs to another trip, in one place, rather than guarding
  each upsert. Trips themselves are created by the server with integer ids; a trip is the
  root the library works with, its content is the document.
- **The open trip is an immutable value in a signal, not a Solid store.** Each edit
  replaces it with the result of a pure edit, which shares every part it leaves alone. A
  store wraps every object in a proxy: each read of a point registered a dependency, and
  a pass over an imported day of 130,000 track points through it took 2.2 s instead of
  0.45 s; each edit was also diffed into the store with `reconcile` and copied whole for
  the undo history. As a value, the undo history keeps the earlier trips themselves, and what is worked out of a day can be kept by the day object: a save sorts only the days an edit touched into riding order. The
  cost is that what shows a part must not hold the object: lists keep their rows by id
  (`ForById`), so that a changed copy updates its row; markers read their stop through
  their props; a dialog holds its element by id while it is open, so that a routed leg
  arriving or a save does not rebuild its form; and memos stand between the trip and
  whatever would otherwise follow every change of it (the selected day, the days the map
  draws, the trip's id for fitting the map).
- **Positions are rounded in the edit actions.** Leg keys are built from coordinates as
  text, in the browser and in PHP, and agree only for coordinates of at most six
  decimals. Rounding where coordinates enter the document, the actions of the open trip,
  keeps that an invariant of the model rather than something every map handler remembers.
- **Leaving the page.** The autosave flushes with a keep-alive request when the page is
  hidden, and `beforeunload` warns while a change is unsaved. A keep-alive request may
  carry at most 64 KB, so a large trip left in the last second before closing the tab
  relies on the warning.

## Time

- **Times live on stops; the day has a date.** A day's timeline starts at the first stop
  in riding order that has a time: that time plus the stop's pause is the departure. A
  first draft gave the day a departure time of its own; a day may hold route options
  with different starts (a longer breakfast on one of them), so the day cannot know it,
  and two places for the same time disagree. A stop's time is a fixed arrival: a
  reservation, an opening hour, a check-in. The plan keeps it: the day goes on from that
  time plus the pause. Where the ride gets there early or late, a row of its own stands
  before the stop, green or red, with by how much and when the ride gets there; the
  route's row and the day count the late stops. A first draft put the waiting and the
  shortfall at the end of the stop's detail line, where a long line cut them off and the
  day's count was the only sign of a problem, far from the stop it was about. Nothing is corrected: whether to leave earlier, shorten a pause,
  move the stop or ignore a pessimistic calculation is the user's call, and a corrected
  arrival would disagree with the time the stop says. Stops before the first timed one
  have no times, and a day without a timed stop has distances only. Each route keeps its
  own clock: a route whose first stop has a time starts there, with the route points
  before that stop timed back from it, so the start of a route is never short of its
  time or waiting for it; the ride before it was another route's, and what lies between
  two routes (a ferry, a transfer, a night) is not ridden. A route whose first stop has
  no time goes on from where the route before ended. All of this is
  planned time: nothing is compared with the clock, and matching the plan against the
  ride as it happens is a navigation system's job, not this tool's.
- **Untimed legs ride at 50 km/h.** The routing gives every routed leg its duration. A straight
  leg (by choice) or one not routed yet has none; its riding time counts at 50 km/h over
  its crow-flies length rather than being unknown, so that a day with one such leg still
  has times. The pace is a guess and may become a setting.
- **The trip starts on its first dated day.** A day has a date; the library shows a trip
  as starting on the earliest of them. A new day after a dated one is dated the day
  after, so a consecutive trip needs one date typed. A trip-level start date was tried
  and dropped: it was a second source for the same fact.

## After the trip

- **One kind of journal entry, not attachments and comments.** The plan had photos,
  receipts and documents as attachments and notes as comments. In use they are one
  thing: a note, a file, or a file with a note under it, in order of adding. One table,
  one dialog, one list; a file's media type says what it is.
- **The journal is a window, not a modal.** The journal is read against the map: its
  entries' places, the day they belong to. As a modal it dimmed and locked the map, so
  showing an entry's place had to close it. It is a dialog shown without modality,
  dragged by its title and kept whole on the page, closed by Esc or its button; the
  dialogs that edit something stay modal.
- **The trip's journal is the overview.** Opened on the trip, the journal lists every entry
  of the trip in the trip's order (the trip's own, then each day with its routes and its
  stops in riding order) rather than only the entries on the trip itself, which are few.
  That is the journal read after the ride; the parts' own journals are where entries are
  made during it. A second dialog for the overview would have doubled the entry list.
- **An entry outlives its part.** A photo on a stop stays with the trip when the stop
  is removed, with its day, stop or route reference set to null: the journal is the
  record of the trip, and a removed stop is still where the photo was taken. The first
  draft cascaded the deletion; a stop moved in a reorganisation would have taken its
  photos with it.
- **Photos are placed by their EXIF data on the server.** The server reads the time the
  camera wrote (local, without a zone) and the GPS position from the upload before the
  entry is written, since it has the file anyway and the browser would need a parser of
  its own; the entry is one insert, placed as it is stored. A photo added
  to the trip itself goes to the day of its date; one added to a day, a stop or a route
  stays where the user put it. The position places it on the map; nothing is matched
  against the route. Without the exif extension a photo is kept and shown, not placed.
  An entry made at a spot on the map is sent with that spot and stands there, unless
  its photo has a position of its own, which wins: the camera knows where it was, the
  press on the map is where the user roughly meant. The spot is a property of the
  entry, not a kind of entry: the same table, dialog and markers serve it.
- **Photos are made into JPEGs in the browser, not on the server.** A phone photo is 4 to
  8 MB and a HEIC on anything but Safari; the server's GD reads neither HEIC nor anything
  large cheaply, and php-fpm is chrooted on the box, so shelling out to ImageMagick would
  have meant copying it into the chroot. The browser decodes the photo, draws it at most
  2560 px on the longer side onto a canvas and encodes a JPEG at 0.85; libheif compiled
  to WebAssembly decodes a HEIC where the browser cannot, loaded only then. A canvas
  drawing has no EXIF, and the server places photos by it, so the original's EXIF block
  is copied into the new JPEG, from the JPEG's APP1 segment or the HEIF's Exif item, with
  its orientation tag set to upright, since the pixels were turned. Anything that fails
  is uploaded as it is. The server keeps reading EXIF from the file it gets, so it does
  not know the difference.
- **Files are served through PHP, not by httpd.** A file is read by its owner or through
  the trip's share token, so every read passes the application's check; the file store
  lies outside the web root. Previews are small JPEGs made with GD on first request and
  kept beside the file, so a page with many photos loads a few hundred kilobytes.
- **The trip's state is part of the document.** Planned or done is saved with the trip
  like its name, counts as an undo step and shows in the library. A separate endpoint
  for one flag would have been a second way to change a trip.
- **Stops are stored in riding order.** The client computes the order from the routes
  (the sequence); the autosave sends each day's stops in it, and the server stores the
  position. The read-only page and anything on the server can then list stops without
  the routing geometry. Stops the client lists are still ordered by the sequence, so the
  stored order is a copy that is always current.
- **The read-only page is the frontend's second entry.** The timeline, the riding
  sequence, the distances and the labels exist in TypeScript; porting them to PHP for a
  server-rendered page would have been a second implementation to keep in step. The
  page is a small SolidJS bundle without the editor that reads the trip and its journal
  from the API the page names: the owner's trip API at `/trips/{id}`, or the read-only
  API of a shared trip at `/t/{token}`, which needs no sign-in. Sharing is a random
  token on the trip, made and withdrawn by the owner; anyone with the link reads the
  trip, its journal and its photos. The page prints: the map keeps its drawing buffer,
  the controls are hidden.
- **The asset tags walk the manifest's imports.** With two entries, Vite puts the styles
  both import (MapLibre's and the markers') into the chunk they share, listed under that
  chunk in the manifest, not under the entries. The tags of a page are the stylesheets
  of its imported chunks, then its own, in that order, so that an entry's own styles
  come last as in its source.

## Export

- **An imported file becomes ordinary routes and stops.** A GPX route keeps its points and
  is routed between them; where the file carries the way a Garmin or BaseCamp calculated
  (`gpxx:rpt`), that way is the leg's geometry, measured along it and timed at the
  assumed pace, since it is what the rider saw and planned; *Reroute* trades it for the
  routing's own way and durations. A track is a route of kind `track` with straight legs
  between all its points, so that it keeps its shape and stays editable like any route;
  the kind is shown instead of a profile. A first draft cut tracks down to 500 points on
  import; the user decides instead, from the track's menu, whether to condense it
  (Douglas–Peucker at a chosen distance) or to make a route of it, since only the user
  knows whether the recording or a lighter file matters. A track's points are not shown
  one by one, neither as markers nor as rows: there are thousands. A track of 10,000
  points makes every save of the trip near 1 MB; the dialog shows what condensing it
  leaves. Consecutive legs of a route in the same state are one line on the map, which
  took an edit with such a track from about 300 ms of blocked page to none. Waypoints become stops,
  bound where they stand on a route point, so that this planner's own export comes back
  as it went out. The alternative, a separate immutable track object, would have needed
  its own drawing, editing and export paths for little gain.
- **Imported text is fitted, not refused.** A file's names and descriptions are written
  by other apps: a waypoint's description in one archive was an address, some 32,000
  empty lines and an email. The import closes up blank runs and cuts a name to 200
  characters and any other text to 20,000, the limits the server holds, so that one
  waypoint does not keep a whole trip from saving. The server counts characters, not
  bytes, as the form fields do.
- **One track or route per route, one waypoint per stop.** A GPX file holds the stops in
  scope as waypoints, bound ones at their route point and free ones at their own position
  when within the chosen reach of a route, with the stop's kind as the waypoint type, and
  each route named after its day and its own name: as a track with its full line, or as
  a GPX route of its points for a device that routes itself (a Garmin takes `rte` and
  calculates the way; a track is driven as drawn). A leg not routed yet is written as the
  straight line between its ends. Optional routes and stops are written or left out as
  the export says; a stop bound to a route left out counts as a free stop.
- **Export options live in the query; presets on the server.** The download is a URL
  with its options, so a device's import can be bookmarked and the server needs no
  state per download. A preset is a named set of options kept with the account, since
  the same device is used from every browser; a preset's JSON and a download's query
  are read by the one parser, so an option exists in one place.
- **An imported way has no riding time of its own.** A leg read from a file carries its
  geometry and length but `durationS` null; the pace assumption for such legs lives in
  one place, the leg's riding time, instead of being frozen into saved documents.
- **API paths carry no file extension.** The per-day zip is `gpx?per=day`, not `gpx.zip`:
  PHP's built-in server answers a path with an extension as a static file and never
  reaches the front controller, and nothing is gained by the extension.

## Testing

- **The HTTP layer is checked by a scripted browser run, not in CI.** PHPUnit covers the
  repositories, the validator and the export; Vitest the pure modules and the open trip's state. The
  pages and the editor are exercised with Playwright against `php -S` by hand: sign-up,
  a route with the point, stop and delete tools, free stops connected and disconnected,
  the stop dialog, neighbouring days, folders and the search, the GPX import and the
  export dialog, the journal with a photo placed by its EXIF data, the trip's state,
  sharing and the read-only page as a guest, and then
  from the mailed link, a trip with stops added by tapping, routing, the line tools, undo
  and redo, the save, a reload and the downloads. Routing in that run answers from a mock
  where Valhalla cannot be reached. Keeping it in CI would mean a browser and a PHP server in
  the workflow for a few minutes per push; not worth it yet.

## Server and stack

- **PHP on the user's OpenBSD box, a SolidJS app in the browser.** The deployment target
  is given: OpenBSD, httpd, php-fpm, PHP 8.4, deployed with `git pull`. The public pages
  (landing, sign-up, sign-in) are server-rendered so that they need no JavaScript; the
  planner itself is a single-page app because a map editor is one.
- **Slim 4, PHP-DI, Plates, PHPMailer.** Each does one job and is small: routing with
  middleware and PSR-7, a container with autowiring, templates with layouts and escaping,
  SMTP without a dependency tree. Laravel and Symfony were rejected for their weight;
  going without a framework was rejected because routing, middleware and PSR-7 would be
  written again, worse.
- **SQLite, one schema file, no migrations before 1.0.** One user base on one box. The
  schema is `db/schema.sql`; while nothing is released, a schema change recreates the
  database (`make recreate`, which also empties the file store, since `CREATE TABLE IF
  NOT EXISTS` adds tables but never columns). Migrations start with the first release.
- **Sign-up by invitation.** Open sign-up on a hobby server with photo uploads invites
  abuse. Visitors leave their e-mail on a waiting list; an admin sends an invitation link
  by mail; the link opens sign-up for that address. The address is verified by
  construction, so there is no separate verification step. Open sign-up can be switched
  on later.
- **Export runs on the server, import in the browser.** The data is in SQLite; GPX writing
  and a zip of per-day files are a read of the database, and a download is a URL that can
  be bookmarked. Import needs the editor's context (which day, which gap) and the routing
  of imported legs, so it stays in the browser, ported from Layer Slayer.
- **Routing in the browser by FOSSGIS Valhalla, and by nothing else.** The same pattern as
  Layer Slayer: one request per 1.1 s per browser, attribution shown, no server in
  between. The first four phases routed on FOSSGIS's OSRM; the switch was made for one
  thing OSRM's car profile cannot do, the motorway dial of Valhalla's motorcycle costing.
  Checked before switching: the same FOSSGIS terms name both servers (one request per
  second, attribution, a single server each with no availability promise); both answer
  the browser's CORS preflight; latency was the same, 0.4 to 0.8 s a leg; with the dial
  at its default the motorcycle costing gave the auto costing's road on every test leg,
  and on three of four the road OSRM gave; Valhalla's times off the motorway are more
  conservative (about 50 km/h against OSRM's 70 to 80). An engine switch with OSRM as a
  fallback was considered and dropped: two engines' durations in one day's timeline
  disagree in both directions, and once the dial exists the switch buys nothing. The leg
  key names the costing (profile and dial), not the engine; changing the engine means
  routing everything again.
- **Only the route tool and a base map switcher come from Layer Slayer.** Stacking WMS,
  WFS, ArcGIS and PMTiles layers is Layer Slayer's purpose, not a trip planner's. The route
  model, edits, legs, routing pump, undo history, markers and GPX code are ported with
  their tests; the layer store, the service readers and the composed style are not.
- **The server builds; CI only checks.** The server has Node.js and Composer and deploys
  with `git pull` followed by `make build`, which installs the PHP dependencies without
  development packages and builds the frontend into `public/build`. A first draft had
  GitHub Actions push a built tree to a `deploy` branch; the user preferred one branch and
  a build on the box. GitHub Actions runs the checks (`make check`) on every push and
  deploys nothing. `vendor/`, `node_modules/` and `public/build/` are never committed. The
  build goes to `public/build`, not `public/app`: the planner page is the route `/app`, and
  a directory of the same name under the web root is served as files before the front
  controller sees the request. Static paths and page routes never share a name. The
  Makefile is written for OpenBSD's make as well as GNU make: no conditionals, no shell
  functions.
- **Data outside the checkout.** The SQLite file, uploaded files and the local
  configuration are not under the deployed tree, so that a pull or a reset cannot touch
  them. Their paths come from `config/local.php`, which is not in git, and are given
  relative to the checkout: php-fpm runs chrooted to `/var/www` while `bin/planner` runs
  outside, and a relative path resolves to the same directory on both sides.
- **Vite stays on the 7.x line.** The server builds the frontend, and Vite 8 bundles with
  Rolldown, whose native binding is published for Linux, macOS, Windows and FreeBSD but
  not OpenBSD. Vite 7 bundles with esbuild, which ships an OpenBSD build. The pin lifts
  when Rolldown does.
- **Mail over SMTP to 127.0.0.1:25.** php-fpm is chrooted on OpenBSD, where `mail()` finds
  no sendmail. PHPMailer speaks SMTP to the local smtpd by IP, which needs no resolver in
  the chroot either.
