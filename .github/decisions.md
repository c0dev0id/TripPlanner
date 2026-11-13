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
  right-click or a long press and has no pencil, and dots only on a touch screen: a route's menu edits,
  duplicates, moves it to another day, condenses or converts a track and removes it; a
  stop's edits, copies it to another day and removes it. Each row's journal is an icon on
  it that counts the entries. A menu that would list an entry per day or per folder
  (moving a route or a trip, copying a stop) has one item that opens them as a submenu,
  beside it: on hover with a mouse, on a click, a tap or the keyboard otherwise.
  Submenus are part of the one menu mechanism, so every menu can have them.
- **Folders, trips and days are cards whose menu is the card itself.** A card shows two
  lines, the name over its metadata (a folder's trip count; a trip's days, start and
  state; a day's date and length), and has neither pencil nor, with a mouse, dots: right-click, the
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
  results and the move menu name a folder by its path. Deleting a folder that holds
  anything asks whether that moves up into its parent or is deleted with it, all the way
  down. Moving is the default answer, so Enter never deletes trips; deleting with contents
  exists for clearing out an import. Folders themselves are not
  moved; nothing asked for it, and a folder that cannot move cannot end up inside itself.
- **Trips are merged on the server.** Merging joins trips imported one file each into the
  trip they belong to, so their days are placed as a folder import would have placed
  them: by date, a day of a date the trip has already joining it. The server moves the
  rows themselves rather than saving a merged document under new ids, so that every
  route, stop and day keeps its id, journal entries keep what they are attached to, and
  their files move with them. The trip selected first is the one kept; a selection
  remembers its order for that, a Shift run starting at the trip it was started from.
  Trips and collections do not merge, since a section has no date to place it by.
- **Rows are selected by a pad on touch screens.** A touch screen has no Cmd or Shift, and
  its long press already opens the menu, so a selectable row (a trip of a folder, a route
  of the duplicates report) has a pad drawn as a day's or a route's drag grip: a tap on it
  selects or deselects the row, a tap elsewhere opens it. The row's highlight is the only
  mark of the selection; a checkbox in the pad looked dated. The pad works for a mouse
  too. In the duplicates report a mouse click on the row still selects it, as asked for
  working through the report at a desk, while a tap opens it.
- **The search runs in the browser.** The library loads all trip summaries and folders of
  the user (a few hundred small rows at most for a personal planner) and filters them by
  name; the results are capped at twenty. A server search would add an endpoint for
  data the client already holds.
- **An exported trip is its document, with GPX beside it for others.** GPX cannot carry
  a trip back: a stop's details, dates, the motorway dial, colours and the points of a
  routed route have no place in it. So the export writes the document as the planner
  saves it into `trip.json`, with the journal and the recordings, whose files lie beside
  it, and adds the per-day GPX files of the GPX export for any other program. An import
  reads `trip.json` alone and takes the folder's GPX files for what they are, the same
  trip once more.
- **An exported trip is imported as a new trip, under new ids.** The ids of days, routes
  and stops are the library's as a whole, and the trip exported may still be in it; so
  the import renews every id and carries the journal's and recordings' references over.
  It runs in the browser through the API a user's own actions use, like the folder
  import: creating the trip, saving its document, adding each entry and recording. The
  one addition to the API is the time an entry was written, which an import hands on.
- **The zip is read in the browser by forty lines of our own.** A zip of trips with
  photos reaches hundreds of megabytes, so its files are read one at a time from the
  picked file by the directory at its end, never the whole into memory; inflating is the
  browser's `DecompressionStream`. The libraries that read a zip this way bring their own
  inflate, workers and WebAssembly for what the platform already does; ZIP64 and
  encryption, which they would add, are refused instead. The server writes the zip with
  PHP's zip extension into a temporary file and streams it, photos stored as they are.
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
  no empty trip behind. One archive holds rides as folders of days, rides as single files
  in plain folders, and planning material such as the Trans Euro Trail by country, so the
  import dialog asks how the picked tree is organized, one way for the whole tree, and
  shows what each way makes of it; a tree organized in several ways is imported folder by
  folder.
- **Duplicates are found on demand, on the server, by the routes' lines.** The report
  reads every route of the library, reduces each line to its ends, length, box and
  points spread evenly along it, and compares those. Exact copies share their points
  (a routed route) or their line (a track). The same ride kept twice runs the same way,
  is about as long, and lies along the other line; the date is what tells a ride kept
  twice from the same road ridden again, so routes on different dates are never the same
  ride, while an undated day matches any date. Comparing raw geometry alone listed a
  daily commute as dozens of duplicates. Groups join copies and same rides, so a route
  appears once. Over an archive of 2.8 million points the report takes about 4 s, half of
  it decoding lines in PHP; should libraries grow far beyond that, each route's shape
  can be kept when it is saved instead of worked out for every report.
- **Two folders are special, by a kind on the folder.** Collections are to live in two
  places only, a folder for recordings that belong to no trip and one for planning
  material, and everything else is to hold trips. The two are rows of `folders` with a
  `kind`, not places of their own: everything a folder does (holding folders, taking
  what is moved or pasted, the tree) then works for them unchanged. A trigger makes
  them with the user, so no code that creates a user has to know of the library; the
  repository refuses to rename, move or delete them by leaving them out of what those
  statements find. Their names are kept in English and shown in the page's language.
  Other folders still take collections for now: that goes once the existing ones have
  been moved.
- **A drop is imported without a dialog; the folder says how.** The import dialog asks
  how a tree is organized because a picked folder goes into whatever folder is shown.
  A drop names its folder, and the three kinds of folder each have one sensible
  reading, so nothing is asked. A recording's year is read from its first track point
  rather than from the file's metadata, which carries the time the file was written,
  often by an export long after the ride.
- **Planning material is a trip of another kind, not a store of its own.** A collection
  is a trip whose days are its sections, one per file, without dates: it is stored,
  loaded, saved, drawn and searched as a trip is, and its panel leaves out what belongs
  to riding (dates, times, the journal, the tools, the export). Its kind is fixed when it
  is created. Routes go from a collection into a trip by copy and paste through a
  clipboard that outlives the open trip, so that the same two steps also copy between
  trips and between days; the stop's former *Copy…* to another day became the same Copy.
  Pasted onto a whole trip, routes go where a file import would put them: onto the day of
  the date they were copied from, or a new day of that date, undated ones onto a new day
  each. Pasted onto a folder they make a collection, since a set of copied routes from
  different trips is planning material rather than a ride. The duplicates report selects
  rows with a click, since its rows are worked on in bulk, and opens one from its menu.
  A collection's map shows only the section opened, and no stop dots while none is: the
  Trans Euro Trail has 5,000 waypoints, each a marker of its own.

## Map and appearance

- **Only the selected day's stops are markers; the others are dots on the map.** A
  marker is an element of its own that the map moves on every frame; a trip of 5,000
  waypoints, shown whole, took four seconds longer to show its days with a marker for
  each. The other days' stops are circles in the route lines' source instead, drawn by
  the map like the lines and not to be tapped, as the markers were not either.
- **Base maps from public servers, chosen per browser.** OpenFreeMap's vector styles
  (Liberty as the default, Bright, Positron, Dark) need no key; OpenTopoMap for relief
  and contours, OpenStreetMap's standard tiles and CyclOSM as raster, for the looks
  riders know from other tools; the BKG's TopPlusOpen, the German federal topographic
  map, and Esri's World Imagery for a look at the ground itself. Each server's attribution rides with its source. The
  choice is a preference of the browser, in localStorage, as the theme is: a matter of
  the device, not of the trip, and it costs no table. The list is fixed in code; adding
  a service of one's own is Layer Slayer's business, not this planner's. The widths
  of the library and of the pane beside it, dragged at their edges, are kept the same
  way: they depend on the screen. An edge is the left edge of the next column rather
  than the right one of the column it sizes, because the panels scroll and would take
  it along; it finds what it sizes as the column before its own, so the map's edge
  sizes the pane while there is one and the library otherwise. The library may take
  six tenths of the window and the pane four, so that both edges stay in reach.
- **Overlays are a fixed list, switched on per browser.** Roadworks and motorcycle
  closures lie between the base map and the trip. An overlay's sources and layers are in
  the style only while it is switched on, put there by the same style transform as the
  route overlay, so nothing is fetched for an overlay that is off and there is one way
  into the style. The map sets its style again whenever the base map chosen or the
  overlays switched on change; the controls only change those. A source already in the
  style is carried over as the trip's are: MapLibre keeps a fetched source's data, not
  its address, so the same address written anew counts as changed and is fetched again,
  megabytes of roadworks on every switch of the other overlay. As with the base
  maps, the list is fixed in code; any other layer is Layer Slayer's business. Each has
  a button of its own among the map's controls, its sign, greyed while it is off: two
  switches used while looking at the map are one tap each, where a submenu of the base
  map's menu took three.
- **An overlay's signs stay wider than the road under them.** A vector base map keeps its
  roads to a few pixels at any zoom, and the overlays grow a little with it. A raster base
  map is sharp up to its last tiles and blown up beyond: a road doubles with every zoom,
  to 160 px and more, and a sign of one size ends up a speck on it. So an overlay's layers
  are made for the base map shown: from the zoom it is blown up at, lines and signs take
  their size from the road's, as style expressions.
- **The overlays' signs are road signs.** A closure is a motorcycle in a red ring, with
  Temaki's motorcycle (CC0, the companion set to Maki); roadworks are a warning triangle
  with Maki's traffic cone, a closed road the empty red ring. They are drawn into map
  images as the POI badges are.
- **Roadworks are the states' features, drawn by the planner.** Both services are
  GeoServers that hand out their roadworks as GeoJSON (WFS) to any page: Rhineland-
  Palatinate's sites as points with their stretches and diversions as lines,
  Baden-Württemberg's sites as lines. All of it is some 11 MB, 1.5 MB compressed, read
  when the overlay is switched on. A first version showed the services' own pictures
  (WMS): their signs have one size, which a road blown up on a raster base map outgrows,
  and asking for larger pictures in steps (GeoServer's `dpi` option) ended at eight times
  the size with nothing to tap. As features, lines and signs are sized like the closures',
  a site says what it is on a tap, and works yet to begin are drawn in grey. Grey, not
  fainter: a sign half transparent over its own line reads as a fault. The
  Rhineland-Palatinate service also lists Baden-Württemberg's sites, which are left to
  that state's own service by a filter in the request. What each service calls its
  fields is one table per service, which the layers' expressions and the tap's text are
  both made from. A stretch or a diversion carries nothing but its site's id,
  so only sites answer a tap.
- **The motorcycle closures are fetched and converted on the server.** mintelonline.de
  publishes them as a KMZ file its server does not let a web page read, so Layer Slayer
  has the user download and choose it. The planner has a server: `make closures` fetches
  the file, reads the KML in it and writes its placemarks to `public/closures.geojson`,
  which httpd serves and the map reads; cron repeats it, as the source changes every few
  weeks. It is a command, as `make garmin-icons` is, so that no user's request waits for
  another server or fails with it. The file is not in git: it is
  the collector's work. The command line's fetches go through the curl extension
  (`Download`): PHP's own streams need `allow_url_fopen`, which OpenBSD's PHP switches
  off, and a certificate file of their own. KML styles are dropped; a closure's name says when and in which
  direction it holds, and a tap shows it with the description.
- **Places come from the planner's own store, never from Overpass while planning.** The
  first versions asked the Overpass API from the browser: around a spot, then along a
  route in stretches, then kept per route. Each question cost half a minute and more on a
  public server at capacity, failed often, and a store keyed by route fetched the same
  area for every route through it. The data belongs to the area: so the server fetches
  the places of whole regions into a table, from cron, and the planner reads only that.
  Nothing is slow or fails while planning, places are a layer to switch on like the
  roadworks, and "along the route" is a distance filter over data already there.
- **An area is fetched whole, with one question, by its ISO 3166 code.** `make places
  AREA=DE-RP` asks for every kind of place in a region (ISO 3166-2) or a whole country
  (ISO 3166-1) at once, and kind by kind where the server does not get through with that.
  One cron job per area, spread over months, is the gentlest use a public server can be
  put to: a handful of questions a year per region. `make places` without an area lists
  the codes of the user's travel countries to pick from, with what is kept of each; any
  other code is fetched as well, so the list limits nothing.
- **A fetch replaces what it was answered, kind by kind, and says what it was not.** Where
  the one question fails and the kinds are asked one by one, each kind answered in full
  replaces what was kept of it in a transaction of its own, and a kind not answered stays
  as it was: old places of one kind beside new ones of the others are better than none
  of the new. The time of the last fetch is kept per area and kind, so `make places`
  names the areas where a kind is behind the others or was never fetched, the ones to
  run again before their turn; the fetch itself ends with an error then, which a cron
  job mails.
- **An answer is tab-separated values with a mark at its end.** A region's places are tens
  of megabytes as JSON, which PHP would hold whole; as CSV with only the columns kept
  they are a tenth of that and read row by row. Overpass says nothing in a CSV answer it
  ran out of time for: it sends what it had, or nothing, with status 200. So the query
  ends with an element of its own (`make complete`), and an answer without that last row
  changes nothing.
- **Places are kept and asked for by tile.** A place carries the tile of the web's maps at
  zoom 10 it lies in, some 25 km wide; the planner asks for the tiles in view, or those a
  day's routes pass within reach, and keeps what it read. An index on the tile serves
  that without a spatial extension, which a system's SQLite may lack, and a tile's answer
  can be cached by the browser for a day.
- **The kinds of places are one file, read by both sides.** `frontend/poi/places.json`
  lists each kind's tag and values, its colour, and the tags a place's details are made
  of; the server builds its question and decides a place's kind from it, the planner
  draws from it. Of a place only those tags are kept.
- **Along a route means along the road, within a distance per kind the user sets.** The
  filter follows the routed legs' geometry, not the straight lines between a route's
  points, which leave a winding road by kilometres. The distances are a preference of the
  account, 200 m for every kind to begin with: narrow, so that a route stays readable,
  and changed in a moment, since nothing is fetched for it.
- **The kinds of places are a list in the panel, not a menu on the map.** Several kinds
  are switched at a time, and the app's menu closes with each pick; a list of checkboxes
  that stays open under the panel's icons takes as many ticks as wanted. The map's own
  controls stay for what belongs to the map alone: the base map and the two overlays.
- **A route's colour says which route it is, not what state it is in.** Routes were
  orange, the neighbouring days' grey: among roads drawn in orange and yellow and the red
  of closures and roadworks the line was hard to follow, and with every day shown nothing
  told the days apart. A route now takes a colour from a palette of eight that avoids
  those of roads and overlays, by its day or by its place among the trip's routes, and
  the palette starts over where it ends. The selected day, its neighbours and the edited
  route differ by width and opacity alone, so a route looks the same wherever it is
  drawn.
- **A colour chosen is part of the trip, the default colouring and the width are
  preferences.** The colour picked in a route's menu is stored with the route, as the
  hex value: it is the trip that is coloured, and a later change of the palette leaves
  it as chosen. Which colours the other routes get and how wide lines are is how one
  user likes to see any trip, and the read-only page draws with the defaults.
- **Route lines widen with the zoom.** A line of constant width is lost beside a road
  that the base map draws ever wider; the line grows to 1.8 times its width by zoom 18
  and, over raster tiles blown up, stays at half a road's width, by the sizing the
  overlays use.
- **The map's credits stay MapLibre's, and the tools step aside.** On a small map
  MapLibre shows its credits spread out until the map is first dragged, as
  OpenStreetMap's attribution guidelines ask, and offers no way to start them folded.
  They are several lines on a phone and lay under the route tools; rather than fold
  them through the control's inner workings, the tools stand above them while they are
  spread out.
- **Small and touch screens by stylesheet rules, with two exceptions.** Between 721 and
  1023 px, a tablet held upright, the panel takes at most 42 % of the width; on a touch
  screen every field's text is 16 px, below which Safari zooms into the page on focus
  and stays there, and an icon button is at least 36 px; heights that follow the screen
  use `dvh`, which leaves out what the browser's own bars cover. What the stylesheet
  cannot do is in `state/panel.ts`: a phone folds the library away when a day is
  picked or the duplicates report asked for, and the sheet has a height the user sets
  and folds down while a route is edited. The width a phone ends at,
  720 px, therefore stands in the stylesheet and once in the script.
- **A phone stacks the three panes.** The desktop's panes are the phone's layers: the
  map is the page, the day's pane a sheet under it, the library a layer over
  everything, folded away to the same button with three lines. Nothing is a mode of its
  own and no component exists twice; the same elements are placed otherwise. The
  library folds away by itself when a day is picked, since on a phone picking a day
  means wanting to see it, and the sheet folds down to its heading while a route is
  edited, since editing happens on the map.
- **The day's sheet is a row under the map, not a layer over it.** A sheet over the map
  would cover MapLibre's credits and scale, and the route tools, the routing's state
  and the fitting of a day into view would each have to know how much of the map it
  hides. As a row of the page's grid it makes the map smaller instead: everything on
  the map stays where it is seen, and MapLibre follows the size by itself. The price is
  that the map is redrawn while the sheet is dragged.
- **Rows have a menu button where there is no right-click.** A long press opens a row's
  menu on a touch screen, but nothing says so. On a screen whose pointer cannot hover
  every row with a menu shows a button with three dots that opens the same menu; with
  a mouse the rows stay as they were, a right-click away from their menu.
- **The read-only page draws no overlays.** Its map came with the planner's overlay
  control, and the roadworks and closures this browser had switched on, but without the
  taps that say what a sign means, which the planner's map interactions answer. The
  page shows a trip as it was planned, to be read and printed; what is closed today
  belongs to planning. So the overlays and their control are the planner's alone, by
  one option of the map both pages make.
- **On a phone the menu is a sheet from the bottom edge.** A menu at the finger is
  narrow, runs off the screen and puts its submenu where there is no room. At a phone's
  width the one menu is as wide as the screen and rises from the bottom, and a submenu
  takes the place of the list that opened it, under a row that names it and leads back
  to the list. It is the same list restyled, so every menu, on the map as in the panes,
  gets it.
- **The route tools fit a phone by leaving three out.** Nine buttons fit a phone only
  as bare icons, which a touch screen has no tooltips to explain. The bar keeps
  captions and holds the tools, undo and done; redo, reroute and the route's settings
  are the menu of a button that shows at that width alone.
- **A failed save is said over the map.** The notice stood in the library, which can be
  folded away and on a phone mostly is. Over the map it is seen whatever panes are
  shown; the save state itself stands beside the library's button while the library is
  folded.
- **A day keeps an outline of its routes, made by the server.** Showing a trip's shape
  in the library must not cost its document, which is megabytes for a collection of
  tracks. So each day keeps the lines of its routes thinned to at most 32 points each
  (Douglas–Peucker, the tolerance one hundredth of the line's extent and widened until
  the points fit), with the colour a route has of its own. The server works them out
  when a trip is saved, since it already holds the lines and so every path to a trip
  (the planner, an import, a copy, a merge) gets them without knowing of them. Each line
  is kept with a key of the route it was made from, so that a save thins only the
  routes that changed: with one key for the whole day, moving one track out of a
  section of three hundred thinned them all again, seconds of work on every such save. The outlines of all trips come from one request of their own,
  so that the list of trips stays as light as it was.
- **The library is a tree, and the open trip stays in it.** The explorer showed one
  level at a time and replaced the library by the open trip: to look into another trip
  or folder meant leaving where one was. As a tree, folders and trips unfold in place,
  several at once, and the open trip keeps its place among the others. A trip's days are
  listed without its document from the outlines, so any trip unfolds; only opening one
  loads it. Since the library is now in reach while a trip is open, what the library
  does to the open trip on the server (deleting, merging, pasting onto it) leaves the
  trip first, saved, and renaming it is the edit of the trip itself: the open document
  is never changed behind its back.
- **Language and colours are chosen in the preferences, not in the header.** Both are
  set once and then left alone, and as two unlabelled selects in the panel's header
  they took a line of it on every screen and wrapped it into two on a phone. They stand
  in the preferences dialog with the account's settings, said to be this browser's,
  and take effect when the dialog is saved; the language last, since it loads the page
  again.
- **What is unfolded in the tree is the user's doing.** The open trip was always
  unfolded: opening a trip listed its days and folded those of the one open before, so
  the tree moved under the pointer with every trip opened. A trip now lists its days
  only while it is unfolded, open or not, and opening a trip folds no other. One thing
  still unfolds by itself, to keep something in reach rather than to rearrange the
  tree: the folders around a trip when it opens, since a trip opened from the search or
  from the address would otherwise be out of sight.
- **A row unfolds and folds by a click on it; there are no arrowheads.** A folder, a
  trip and a route each had an arrowhead beside the row that did part of what a click
  on the row did. They answer to one rule instead. The tree has one mark, on the row
  clicked last. A click on a row that is not marked marks it and unfolds it, and for a
  trip that opens it, for a day that shows it; a click on the marked row folds it, or
  unfolds it where it was folded. A click on the trip while its day is shown closes the
  day: the trip is then what is loaded, and the pane does not keep showing a day that
  the tree no longer points at. The trip stays unfolded on that click and folds on the
  next. Only the day that is shown has nothing to fold, so a click on it does nothing
  but take the mark back from a folder that held it. What folds takes what it holds with it, a
  folder its folders and trips, a trip its day, a day the lists of its routes: what was
  closed is closed when it is seen again. What is open above the mark carries the mark's strip
  without its tint, as do the open trip and its day while the mark is elsewhere, so that the way down to
  the mark and what is on the map and in the pane can be told from what is merely
  listed. Earlier versions kept a mark for the folder shown and another for the open
  trip, and tied marking to opening or to folding; each took a step away or showed two
  marks at once. A route's row follows the same rule with editing as its mark: a click
  takes the route up and lists what it holds, and a click on the route being edited
  ends that and folds the list.
- **A day looks the same whether its trip is open or not.** An unopened trip listed its
  days as one bare line each, the open one as cards of two lines under a heading with
  two buttons, though both said the same. The outlines now carry what the second line
  needs (how many routes and stops, and the length, kept with each outline line when
  it is thinned and measured as the planner measures, by the same formula, which a
  test on each side pins to the same figures), so an
  unopened trip's days are the same cards. What needs the document stays with the open
  trip: the grip, the recordings, the journal; a gap stands where the grip would, so
  that the names line up. The heading "Days" went, since every row says what it is, and
  its two buttons went where what they act on is. Showing the neighbouring days is
  about the day on the map, so it is in the day's pane. Adding a day adds to the trip
  whichever day is shown, so it is in the trip's menu: there it needs no day picked
  and no trip open, and an empty trip needs no row of its own to offer its first.
- **A day has a pane of its own.** A day's routes and stops were listed inside the day's
  card, in the same narrow column as the library, the trip and its other days: on a wide
  screen one level showed and the rest of the width went unused. The day picked now
  opens beside the list, so that the days stay in view while one is worked on, and the
  library folds away to a strip when the map is what matters: planning is the same
  screen with other proportions, not another mode. Where three panes do not fit, the
  day's pane stands in for the library until it is closed.
- **The folded library keeps the days as numbers.** With the library folded away, the
  day shown could only be changed by unfolding it again. The strip lists the open
  trip's days as numbered buttons in their route colour. Numbers, not small pictures
  of each day's line: a number is read at once and is right while a route is being
  drawn, where a thumbnail of the line would come from the outline, which is as old as
  the last save, shows two days of a loop alike and an empty day as nothing. A phone
  has no strip; its sheet steps through the days.
- **Routes are folded until asked.** A day of a collection may hold hundreds of routes;
  each unfolds on its own when it is clicked, and none does by itself.
- **One menu for days, routes and stops, built in one place.** The menus had grown per
  type: a route could be copied and moved, a stop copied only, a collection's route had
  two entries where a trip's had eight. `trip/partMenu.ts` now builds the menu of every
  kind from the same verbs, takes what only one kind has as an addition, and greys out
  what does not apply instead of leaving it away, so that a menu looks the same wherever
  it opens.
- **The keys act on what is selected, and there is one selection.** A click here opens
  rather than selects, so Ctrl+X, Ctrl+C and Delete act on what was selected with the
  pad or a modified click, as the menus do; only cut and copy fall back to the route
  being edited, since that is plainly the current one and neither destroys anything.
  Delete has no fallback: a key that removes what was merely clicked is a trap. For the
  keys to have one answer, the selections of the library, the open trip and the
  duplicates report give way to each other, and a day's selected routes, stops and recordings are forgotten when another
  day is shown: a selection that is out of sight must not be acted on. Paste has no
  row under the pointer to name its target, so it takes the nearest one in view: the
  route being edited, then the day picked, and for folders and trips the folder shown.
  The key reading is one function (`ui/fileVerb.ts`); the library, the trip and the
  duplicates report each listen and act only on their own selection or clipboard, and
  the selection itself is one value in `ui/selection.ts`, the rows and the list that
  holds them, so that two lists cannot have rows selected at once.
- **A selection is exported through the same dialog as the trip.** Export GPX… in the
  menu of days or routes opens the trip's export dialog with those parts as its scope,
  rather than downloading at once: the options (tracks or routes, optional parts, the
  reach of free stops, the presets) apply to a part as to the whole. The server's
  export takes lists of day and route ids instead of the one day it took; where routes
  are named, their days are the ones exported, and a stop bound to a route left out is
  kept only if it lies within reach of one that is in, like a free stop.
- **A selection inside a trip is of one kind.** In the library folders and trips are
  selected together, since they share a list and nearly all their verbs. Days, routes
  or stops are selected together, never mixed: the verbs of a mixed selection would be those all kinds share, and what a
  paste of days and stops together into a route means has no good answer.
- **Cut within a trip moves, cut across trips copies and then removes.** Within the open
  trip the parts keep their ids, and with them their journal entries, and the move is
  one undo step. Into another trip the parts are pasted as copies under new ids, the
  open trip is saved, and only then are they taken from the trip they came from: if that
  last step fails they are in both trips, never in neither. The journal of a part that
  left its trip stays behind with the trip. Only the open trip's side can be undone.
- **A folder is cut, not copied.** Copying or duplicating a folder is a copy of every
  trip in it, at any depth: megabytes started by one click. Trips are copied one by
  one, where the size is in view.
- **Undo is not bound to editing a route.** Ctrl+Z took back steps only while a route
  was being edited, although every edit of the trip is recorded; moving and removing in
  the panel is now as much of the work, so it is undone whenever a trip is open.
- **Preferences are an object the planner owns.** What a user sets for the planner as a
  whole is kept with the account as JSON the server stores and returns without reading
  it: a new preference needs no change on the server. What depends on the device (base
  map, overlays, which kinds of places are shown) stays in the browser.
- **A place is Maki's icon on a disc, not one of our stop drawings.** Maki is the
  icon set made for maps and named after OpenStreetMap's features, which Layer Slayer
  draws its layers with: white on a disc of the kind's colour, small enough for hundreds
  and not to be taken for a stop of the trip. The six icons are bundled as SVG text and
  drawn into map images in the browser when a style first needs one, which every change
  of base map does again: through MapLibre's resolver for missing images, which it waits
  for. Its `styleimagemissing` event comes after the request is answered, too late for
  the first drawing. The same picture stands in the preferences.
- **One place decides what a tap on the map is.** `Interactions` filters clicks into taps
  and gives a tap that does no tool's work to the popups of the places and the closures
  first, then to the recording's line: one popup opens, any other closes. A popup listening
  to the map's clicks itself would open on the click that ends a pan or closes a menu.
- **Where the user is lives in the address's fragment.** The folder shown, the open trip,
  its day and the route being edited are written there as they change, and read when the
  page loads; the map keeps its view beside them (`map=`, MapLibre's own option). The
  address is replaced, not added to the history: the back button leaves the planner as
  before, as the user asked. Coming back, the map stays at the view the address names
  where opening a day would show it whole, once, for that trip. The tool, open dialogs
  and what a search found are not kept: a page that loads with the delete tool armed is a
  surprise. Rejected: session storage, which keeps the place for a reload but gives no
  address to bookmark or to open on another device.
- **Place search by Nominatim, on Enter, ported from Layer Slayer.** OpenStreetMap's own
  geocoder needs no key; its policy allows one request per second and no search as you
  type, so the box searches when Enter is pressed and keeps a second between requests.
  The search prefers the view without being limited to it. The place found is a pin, not
  a stop: the rider decides what it becomes from the pin's menu while editing a route.
  The tool hints that once floated over the map are gone: they repeated what a tool's
  tooltip says and covered the map on a phone; what remains over the map is the routing's
  state, while legs are being routed or failed to route, above the toolbar where there is one.
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
- **Texts are English in the code and German in one dictionary, read by both sides.**
  The code says `t('Search trips and folders')`; `frontend/i18n/de.json` maps that English
  text to its German, and the server's `t()` reads the same file, so a message the server
  sends and a label the planner shows are translated in one place. The API's controllers
  and exceptions speak the English keys; `Json::error` translates every message on its
  way out, the page templates translate through `$this->t()`. The English text as
  the key keeps the code readable, needs no English resource file, and makes a missing
  entry harmless: the English shows, and a development build lists it in
  `window.i18nMissing`. Plural forms are one entry of forms separated by `|`, picked by
  `Intl.PluralRules`; `counted()` builds the English forms from a noun. Rejected: message
  ids in a file per language, which hide the text from the reader of the code; an i18n
  library, since the need is one function and one JSON file.
- **The language is the browser's, or chosen, and set once per page load.** The planner
  takes the first of `navigator.languages` it speaks, unless a choice is kept in the
  browser as the theme is. A change of choice reloads the page: tool names, figures and
  surfaces are translated when their modules load, and threading a reactive language
  through all of them would serve a switch made once. The planner sends its language in
  `Accept-Language` on every API request; the public pages get the browser's own header,
  which the planner's choice cannot reach. A download is a navigation, which sends the
  browser's header too, so the export link carries `lang` in its query, and the language
  middleware takes a `lang` parameter before the header.
- **German says du.** The server's pages and mails address the user; the planner itself
  rarely does. The German uses du: a personal tool, and the English copy is informal.
- **Not translated.** The validator's messages about a malformed trip document, which a
  client bug causes, not a user; the command line; the Garmin symbol names in a GPX file,
  which the device matches; and "Trip Planner" itself.

## Saving

- **The trip is saved as one document.** The client holds the whole trip, edits it with
  pure functions and an undo history exactly as Layer Slayer's route store does, and
  saves it as one `PUT` 1.5 s after the last change, which leaves out what is unchanged (see below). Fine-grained requests per stop or
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
- **A save leaves out what the server already has.** The document stays one document
  with one version, but a collection of tracks is megabytes, and sending all of it for
  a renamed route is paid on every edit, on the uplink. The open trip is an immutable
  value whose untouched parts stay the same objects, so the client knows without
  comparing what is unchanged since the last save: a day that is the very object last
  saved goes as `{id, unchanged: true}`, and so does such a route in a day that
  changed. The version check makes this safe: a save is only accepted over the version
  the client last saw, so what it calls unchanged is what the server holds. The server
  fills the routes sent so from its rows, inside the save's transaction, so that the
  day they stand in is validated whole (a bound stop against its route point) and its
  outline finds every route, and then leaves their rows alone but for their day and place; a day
  sent so keeps all its rows. Stops always go whole with a changed day: they are small
  and their order is the day's. Finer than a route was not worth its price: a renamed
  track still sends its line. A document without such marks is as valid as before,
  which is what imports send. Taking the lines out of the document into a table of
  their own would also have made the load smaller, but it changes the schema and every
  path that copies a trip; compressing the upload would have saved 40 % and still sent
  everything.
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
  routing's own way and durations. A first draft cut tracks down to 500 points on import;
  the user decides instead, from the track's menu, whether to condense it (Douglas–Peucker
  at a chosen distance) or to make a route of it, since only the user knows whether the
  recording or a lighter file matters. Waypoints become stops, bound where they stand on
  a point of a GPX route, so that this planner's own export comes back as it went out.
- **A track is its line, not a route of points.** A track keeps every point of its line
  as one polyline6 string; its points have no ids, no legs and no markers, and a stop
  along it is free, placed by where the line passes closest. Tracks were first routes
  with a straight leg to every point, so that they stayed editable like any route: an
  archive with the Trans Euro Trail of 1.5 million track points made a 139 MB document,
  2.2 GB of PHP memory and some 30 s of work per save, at 94 bytes a point for its id,
  position and straight flag. As lines the same trip is 8.5 MB. For the leg code a track
  is one leg along its line, so that the map, the riding order, the distances and the
  tap tests take it as they take a routed route. Editing a track's points, should it come
  back, belongs in an explicit mode that unpacks the line into points with ids for as
  long as it is open and packs it again when it closes; the stored line does not stand in
  its way.
- **Imported text is fitted, not refused.** A file's names and descriptions are written
  by other apps: a waypoint's description in one archive was an address, some 32,000
  empty lines and an email. The import closes up blank runs and cuts a name to 200
  characters and any other text to 20,000, the limits the server holds, so that one
  waypoint does not keep a whole trip from saving. The server counts characters, not
  bytes, as the form fields do. Names from file paths and from GPX text are composed
  (NFC): macOS writes file names decomposed, and a decomposed "ö" looks right but matches
  neither a typed one in the search nor a folder of the same name on a second import.
- **A stop keeps the Garmin symbol; our icons only draw it.** GPX defines `sym` and `type`
  but no names for either; Garmin's symbol names are what devices, BaseCamp and other
  apps read in `sym`, and `type` carries nothing anyone shares (Garmin writes "user").
  So a stop stores the symbol a file gives it, unchanged, and an export writes it back.
  Twelve of our icons each stand for one Garmin symbol, chosen for looking like it: a
  stop with that symbol shows our icon, and choosing our icon gives the stop that symbol.
  One to one, so the mapping needs no direction and a Garmin user sees the same symbol
  the planner shows as ours. An earlier design kept kinds of our own beside the symbol,
  with mappings in two directions; it needed decisions per mapping that the one-to-one
  table does not. Any other symbol shows Garmin's picture, so every symbol a file brings
  can be seen and chosen, but the dialog shows our icons first and Garmin's list only on
  request. The pictures are Garmin's artwork, fetched from GPS Visualizer's copies by
  `make garmin-icons` on the server rather than kept in the public repository; without
  them, a stop with such a symbol is drawn as a pin. The symbol list marks the 40 symbols
  GPS Visualizer has no picture of, and a symbol outside the list has none either, so
  neither the fetch nor the browser asks for a picture that cannot be there: a closure
  file's 106 waypoints of symbol "default" would otherwise be 106 failed requests.
- **A recording is its GPX file, kept beside the trip document.** A recording holds what
  was ridden, with whatever its app measured per point (Ridelink's speed, lean angle and
  acceleration), so the file is kept as uploaded rather than translated into a format
  that would drop what it does not know. It is kept out of the trip document: a day with
  a few rides of 6,000 points each would make every save and every opening of the trip
  that much heavier, the lesson of the 8 MB collection. The browser compresses the file
  with gzip before sending it, which keeps a long ride within httpd's default request
  limit of 1 MB, and the server keeps and serves it compressed; the browser reads a
  day's recordings only once they are shown. A recording belongs to a day and goes with
  it, is copied with its trip, and follows a day that joins another in a merge.
- **A recording's figures are worked out in the browser from its file.** The speed is the
  file's own (metres per second in GPX and in Ridelink's extension), else distance over
  time across two points to either side; the slope is measured over 100 m around a point,
  so that a few metres of height noise do not read as a wall; climb and descent count a
  change once it exceeds 3 m from the last turning point. Moving is where the speed at
  both ends of a stretch averages above 3 km/h, and the average speed is the distance
  moving over the time moving, both over stretches that took time: a file whose
  timestamps repeat would otherwise divide the whole distance by a few seconds. Heights
  or lean angles that are all zero count as missing, as apps write them when they did not
  measure. Lean is shown signed as the file writes it: Ridelink's sign convention is not
  known yet.
- **Surfaces come from matching the track to the roads, only when asked.** The routing
  server's `trace_attributes` gives each matched point its edge's surface. It is asked
  once a line is coloured by surface, with points 50 m apart in pieces of 1,000; the points
  between take the surface before them. Every request to the server takes its turn where
  it is posted (`routing/valhalla.ts`), so the page stays within one request per 1.1 s
  whatever asks, and the routing pump has no pause of its own. The surfaces are kept for the page's
  life and not stored: matching a long ride takes a few requests, and storing them would
  tie the recording to a state of OpenStreetMap.
- **Recordings are compared by place, not by time.** Two rides of the same road start at
  different times and differ in pace, so each point of the opened recording is set at
  the place on the other where it lies within 50 m, and the values there are compared:
  the time since the first place both passed (behind where positive), the speed, and the
  lean to either side, since the sign of a lean says the side of the bend, not how far.
  The place is looked for from 30 m behind to 1 km ahead of the farthest place reached,
  so that the way back on the same road, a loop or the next lap is not taken for the way
  on; anywhere only where the ride left the other and comes back. Against the planned
  route only the distance is measured: the plan's routed times are estimates, and the
  question there is where the ride left the route. That comparison is worked out again
  with every edit of the day's routes.
- **A coloured line is drawn in pieces of one colour.** MapLibre's `line-gradient` takes
  no colours from feature data and needs line metrics on the whole source; a feature per
  piece keeps the one line layer reading its `color` property. A scale spreads over the
  values of the one recording up to their 99th percentile (98th for the signed ones),
  not their extremes, so that a GPS spike does not squash every other colour; slope,
  lean and the differences in speed and lean are centred on zero. The opened recording has
  a map source of its own, drawn over the others, which often ran the same roads, and
  set again alone when its colouring changes.
- **The figures float over the map as cards, and views keep clear of them.** The user
  chose separate cards (a summary top left, charts along the bottom, a popup at the point
  picked) over a panel section, so that the map, the figures and the line read together.
  A view fitted to the map pads by how far the cards reach in, measured as the view is
  fitted, each card from the edge it covers least of the map from, so that a folded card
  or a narrow screen counts as it stands. MapLibre's own camera padding was not used: it
  shifts every camera move, and setting it stops a running flight.
- **Charts by uPlot.** It draws tens of thousands of points on a canvas at about 50 KB and
  has no dependencies; the user chose it. A chart is made again when its data or the
  page's light or dark changes, reading its colours from its box's styles.
- **One track or route per route, one waypoint per stop.** A GPX file holds the stops in
  scope as waypoints, bound ones at their route point and free ones at their own position
  when within the chosen reach of a route, with the stop's Garmin symbol, and
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
  is given: OpenBSD, httpd, php-fpm, PHP 8.5, deployed with `git pull`. The public pages
  (landing, sign-up, sign-in) are server-rendered so that they need no JavaScript; the
  planner itself is a single-page app because a map editor is one.
- **JSON answers are compressed by PHP.** OpenBSD's httpd compresses nothing that comes
  from FastCGI, and a collection of some hundred tracks is megabytes of JSON. A
  middleware gzips JSON answers of a kilobyte and more for clients that take gzip; files
  (pictures, GPX, zip) are compressed already and go out as they are. Track lines are
  dense text, so this takes about 40 % off a large trip, not more. Saves are not
  compressed; they leave out what is unchanged instead.
- **Slim 4, PHP-DI, Plates, PHPMailer.** Each does one job and is small: routing with
  middleware and PSR-7, a container with autowiring, templates with layouts and escaping,
  SMTP without a dependency tree. Laravel and Symfony were rejected for their weight;
  going without a framework was rejected because routing, middleware and PSR-7 would be
  written again, worse.
- **SQLite, one schema file, no migrations before 1.0.** One user base on one box. The
  schema is `db/schema.sql`; while nothing is released, a schema change recreates the
  database (`make recreate`, which also empties the file store, since `CREATE TABLE IF
  NOT EXISTS` adds tables but never columns). Migrations start with the first release.
- **The library's pane has one frame.** The library's actions as icons and the search
  on top, under them the open trip's name with the trip's own actions as icons, then
  the tree; the actions of days, routes and recordings are icons on their own headers.
  They were buttons that pushed the panel wide. The path heading and the card that led
  one level up went with the explorer that showed one level at a time: in a tree the
  place is where the row stands.
- **The duplicates report takes the pane beside the library, not the library's place.**
  It stood where the tree stands, so looking at a route it listed meant leaving the
  report, and the trip had to be left to show it. In the pane between the library and
  the map the tree stays, a route opened from the report is shown on the map beside
  it, and the report is still there for the next one. It shares the pane with the day:
  the report has it while it is switched on, and a day picked anywhere but from the
  report takes it back, since picking a day asks for its routes. The pane's frame (its
  heading with the close button, the edge that sets its width, the handle that makes it
  a sheet on a phone) is one component for both.
- **Trips and folders are dragged by their pad.** The pad that selects a trip also drags
  it, a press that moves rather than a tap, and selected trips go together; folders got
  the same pad. A folder takes the drop
  anywhere on it or on what it holds, and the pane around the tree is the top: in a
  tree, a drop onto a trip inside a folder means the folder, and the gaps between rows
  must not swallow a drop. The folder a drop would go into lights up; without that, as
  it was for a while after the tree replaced the lists, dragging looks as if it did
  nothing. Dragging the
  whole card was not chosen: on a touch screen a long press opens a card's menu. A
  folder moved into itself or into a folder inside it is refused by the server.
- **A trip that arrives late is not opened.** Opening a trip waits for the server; a
  click elsewhere meanwhile, another trip or a folder, would otherwise have the late
  answer open the trip where the user no longer is. Each open counts, a leave counts
  too, and an answer for an earlier count is dropped.
- **Sign-up by a mailed link, open or by invitation.** A visitor who enters an address on
  the landing page gets a link by mail that opens sign-up for that address, the same link
  an invitation carries: the address is verified by construction, so there is no separate
  verification step, and password resets reach a real inbox. Sign-up started by
  invitation only, for fear of abuse on a hobby server with photo uploads, and `open_signup`
  (on by default) still turns the landing page back into a waiting list, from which an
  admin invites. An address with an account gets the same answer as a new one and no
  mail, so the form tells nobody who has an account.
- **Accounts from the command line hand over a password to replace.** `make user` makes
  an account without an invitation, for someone set up by hand or a server without
  working mail, and prints a generated password of 16 letters and digits that cannot be
  misread. That password has passed through the admin's terminal, so the account is not
  yet the user's own: until a new password is chosen, every page leads to the change
  page and the API answers 403, and the given password is refused as the new one. The
  state is a column on the user, cleared by any change of the password, a reset by mail
  included; a reset token mailed instead would need the mail this command does without.
- **A sign-in lasts 30 days from the last visit, as a longer PHP session.** The session
  cookie had no lifetime, so it went with the browser, and PHP's default of 24 minutes
  removed an idle session on the server. Both now take `session_ttl`, counted from the
  last request: the session's data is kept that long, and the session middleware sends the
  cookie again on every request of a continuing session, since PHP itself sends it only
  with a new session id. The sessions lie in the data directory, not in PHP's shared
  directory, where another application's shorter lifetime would clean them up. Rejected:
  a separate remember-me token with its own table, which pays off with a choice per
  device or a list of sign-ins to withdraw, neither of which is asked for.
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
