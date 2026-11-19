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
- **A run starts at the row clicked last, whatever that click did.** The anchor of a
  Shift-click used to be the row of the last Cmd or Shift click and stayed where a run
  began, as in a file manager. But a plain click opens here instead of selecting, so
  the row just opened was not the anchor, and a run started at a row clicked long
  before. Every click now leaves its row as the anchor: a plain one lets go of the
  selection and keeps the row as an anchor without selecting it, so that Delete and
  the menu still do not act on what was merely opened; a Shift-click selects from the
  anchor to its row, drops everything else and moves the anchor there. A Cmd or Ctrl
  click that starts a selection takes in the row a plain click opened just before, as
  a file manager does: a click on one ride and a Cmd-click on the next selected the
  next alone, while the opened row looked selected, and the menu then refused to
  merge what the user saw as two.
- **Rows are selected by a pad on touch screens.** A touch screen has no Cmd or Shift, and
  its long press already opens the menu, so a selectable row (a trip of a folder, a route
  of the duplicates report) has a pad drawn as a day's or a route's drag grip: a tap on it
  selects or deselects the row, a tap elsewhere on a trip opens it. The row's highlight
  is the only mark of the selection; a checkbox in the pad looked dated. The pad works
  for a mouse too. In the duplicates report a click or a tap on the row selects it
  alone, which is what draws it on the map. Every selectable row has one: the rows of
  the open trip that have no grip (stops, recordings, media, and everything in a
  collection) had a Select entry in their menu instead, which made selecting several
  on a touch screen one long press per row. A tap on the pad selects, the long press
  stays the menu's, and the entry is gone. A selected row looks the same in every list
  (`.selected`, a tint); the accent strip says what is open or taken up, not what is
  selected. What a row needs to take part, its click, its pad and its highlight, is
  one value (`RowSelect` in `ui/selection.ts`), and the rows a menu acts on are
  decided there too (`menuRows`).
- **The library's component holds the tree and no more.** After the tabs it had grown
  into one function of some 840 lines that also held what is pure (what a key names,
  what a folder takes, the search), the cards it renders, and the Stash's verbs, which
  share nothing with the menu of folders and trips but the rename dialog and Move….
  Those are files of their own now (`items.ts`, `search.ts`, `cards.tsx`,
  `stashMenu.ts`), the pure ones tested. The search results stay a part of the
  component: they are the tree's cards with the tree's menus, and handing those over
  would have cost ten properties. What a tree is (its kind of folder, what it holds,
  its texts) is one record in `model/library.ts` instead of a record per file, and the
  folder helpers are in `model/` because the state uses them. The kinds of places'
  marks and switches are with the map, whose legend they are, so that neither the map
  nor the trip imports from the library.
- **The search runs in the browser.** The library loads all trip summaries and folders of
  the user (a few hundred small rows at most for a personal planner) and filters them by
  name; the results are capped at twenty. A server search would add an endpoint for
  data the client already holds.
- **The search limits the tab shown.** Searching all tabs at once mixed collections,
  trips and lists of places in one list and had nothing to say about the rides; a tab
  switch ended it. Each tab then got the filter, but one word for all of them, which
  stayed when the tab changed: a word typed for the Stash narrowed the Trips without
  being asked to. Each tab now keeps its own word (`queries` by tab), and its field
  stands inside the tab, under the bar of tabs, where it says whose it is; the bar no
  longer moves when the settings, which have no search, are shown. In a tree the results stay a flat list with where each is, rather than the
  tree with rows left out: a tree filtered in place needs its matches' ancestors
  unfolded and a rule for what a matching folder shows of its content, and the list
  says the same with the path. The special folders are the tabs and are never found.
  What it lists is selected in the tree's own selection, so the menu and the keys of
  folders and trips are the tree's; a changed query empties it, since a row selected
  and then filtered away would be acted on unseen. A found route is deleted through
  the function the duplicates report deletes with (`deleteRoutes`): as an edit of the
  open trip, on the server for the others. Routes are not deleted together with
  folders or trips: one question would have to say two different things, and a route
  inside a trip deleted with it is gone either way; the menu says so instead. The
  routes of the open trip are searched in the trip as it is edited, not in its
  outline, which only follows a save.
  The rides are few enough per search to be filtered in place, all years unfolded and
  the fold buttons off, since a folded year would hide what was found; showing a ride
  from a day ends the search, which could otherwise leave it out.
- **Routes and tracks are found by name through the outlines.** Their names are in the
  trips' documents, which the library does not hold. The outlines, which it does hold
  for every trip, now carry for each day its routes that have a name (id, name, kind);
  unnamed ones cannot be found and are left out, which keeps the answer small. A
  search of its own on the server was the alternative and would have made this one
  kind of result arrive later than the others.
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
  in plain folders, and planning material such as the Trans Euro Trail by country; how a
  tree is read without asking is the entry on imports further down.
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
- **Two folders are special, by a kind on the folder.** Collections are to live in
  two places only, a folder for planning material and one for lists of places, and
  everything else is to hold trips. A third, for recordings that belonged to no trip,
  went when a ride came to be kept for itself (see below). They are rows of `folders` with a
  `kind`, not places of their own: everything a folder does (holding folders, taking
  what is moved or pasted, the tree) then works for them unchanged. A trigger makes
  them with the user, so no code that creates a user has to know of the library; the
  repository refuses to rename, move or delete them by leaving them out of what those
  statements find. Their names are kept in English and shown in the page's language.
- **The special folders are the tops of tabs, not rows of a tree.** The three kinds of
  thing the library holds are used apart: planning material is dumped and sorted,
  trips are planned, places are kept, and rides are looked through by date. As rows of
  one tree they pushed each other out of view, and copying from a collection into a
  trip meant scrolling past everything between them; the rides hid behind an icon and
  took the pane a day needs. So the library has a tab for each, and the rides the
  fourth: a tab is what "All trips", "Collections" and "Places" were as rows, and
  those rows are gone. Nothing changes below the library: the special folders remain
  rows of `folders`, each the top of its tab's tree, and the server's rule of what goes
  where is as it was. What a row at the top did, a line under the tabs does: it says
  what the view holds, takes the mark of the top, folds the tree away and holds the
  menu of the top, as a button also with a mouse, since a line that names nothing does
  not invite a right-click. A tab only shows: each tree keeps its mark and its
  selection, held by a list of its own so that the keys never act on rows that are not
  shown, and a folder marked in one tree leaves the mark on the open trip in another.
  The open trip's name with its actions stands over its own tab alone: over another it
  named and closed something that was not in view, a list of places over the trips.
  The trees stay in the page while another is shown, so nothing is rebuilt; the panel
  scrolls as a whole, so each tab's scroll is kept and given back, and the tabs stay at
  the top of it, since a tab that scrolled away would have to be scrolled back to. The
  button that folds the library away stands in that bar for the same reason: in the
  heading above it scrolled out of reach. That heading, a title, the account and the
  sign-out, then went altogether: with it over the tabs the button stood 130 px lower
  unfolded than at the head of the strip, and slipped from under the pointer at every
  fold. The bar is the head of the library's pane now, as every pane has one, the
  strip's head as high as it (`--pane-head-height`) with the pad at the same offset, the account and the
  sign-out are under the settings, where the user's other things are, and the browser's
  tab says what the page is. The duplicates report's switch, which had a row of its
  own under the heading, stands beside the trips' search: it is a report of trips'
  routes. Each tab's search is under the bar (see "The search limits the tab
  shown"). The address names the tab by the folder shown and, for the
  rides, by `view=recordings`.
- **A folder's place says what it holds.** Lists of places live among the Places,
  files in the Stash, trips in the other folders, and nothing else anywhere. A library
  where any folder could hold anything left it to the user to keep them apart. The
  rule is checked on the server where a trip is created or moved, where a file is
  kept or moved and where a folder is moved with what it holds (`Folders::kindAround`,
  `Folders::HELD`); the library only keeps the user from asking for what would be
  refused. A collection, once also the Stash's planning material, is now a list of
  places and nothing else; the special folder of the Stash keeps its kind
  `collections` in the database, since a changed check would need the tables made
  anew.
- **Move… offers what is near.** Its submenu listed every folder of the tree by its
  path, which with a few hundred folders filled the screen with paths cut off alike.
  It now lists, read as paths from the folder the thing is in, the top as "/", the
  folder around it as "..", the folders beside it as "../name" and the folders in it.
  The folders beside are there because moving a thing to the folder next to its own is
  the common move; the folders two levels down are not, because they made the list
  long again. A move further off takes two steps or a drag; in return the list is
  short and every entry can be told apart.
- **The Stash is files; the Trips are curated.** The Stash is where data is dumped
  without thought and kept safe until it is worked on: what is imported there must not
  lose anything. The Trips are where routes, tracks, recordings and times are tied
  together and shown accurately. A collection modelled as a trip with sections read a
  file into routes and stops and dropped the file, and with it a track's times,
  heights and sensor data, so nothing in the Stash could become a ride. A file of the
  Stash is therefore kept whole (`stash_files.gpx`), as a ride's is, and the Stash is a
  view into it: a folder holds files, a file its routes, tracks and waypoints. What
  the lists, the search and the map need without the file is read from it once and
  kept beside it (`stash_items`, `GpxIndex`), and can be read again at any time.
  - The Stash works on whole elements and takes them as they are: a route, a track or
    a waypoint is renamed, since a name sorts, or deleted, and nothing finer. Geometry
    and symbols are changed in a trip.
  - Cleaning up rewrites the stored file. An explicit action is a change the user
    asked for, not a loss, so no original is kept behind it; `digest` stays that of
    the file as imported, so the same file imported again is known as kept, cleaned up
    or not.
  - A file is exported by the request the app reads it with. Its answer always names
    itself a download under the file's name, which a read by the app ignores, so
    there is one way to the file and no second route for saving it.
  - Nothing goes into the Stash from the app; things only come out of it, into a
    trip, among the rides or into a list of places. Into a trip and a list they go by
    the clipboard, which every day and kind already pastes from. A list also takes
    waypoints whole, from its menu among the Places, and files them as an import of
    the file would: a new list has no kind to paste into, and a file's waypoints name
    their kinds, which a paste into one kind drops. A track becomes a
    ride on the server, from the stored file: alone, cut out of its file with the DOM
    (`GpxEdit`), or, where it is all the file holds of routes and tracks, as the file's
    own bytes, since a ride is known by its file's digest and the same recording is
    often both dropped on the rides and dumped in the Stash.
  - What the Stash held before, collections of planning material, is not carried
    over: what they had dropped cannot be brought back, so the files are imported
    again. With them went making a trip from a collection, pasting routes into the
    Stash as a new collection, and importing a folder as planning material.
  - A file's waypoints are counted, copied together and go with their file; they
    are not listed, renamed or deleted one by one yet. A file of places can hold
    thousands, and the Places are where single places are worked on.
  - A file's media belong to the file as a whole, as its waypoints do: a pile of
    files has photos and a roadbook beside a route, not on a point of it, and what
    they are for is decided in a trip. So they are one row of the file, go with it
    wherever it is pasted, and become a day's additional media there; they can be
    looked at in the Stash, added and deleted all together, and nothing finer.
  - The media are kept in the database beside their file (`stash_media`), not on
    disk as a trip's are. A file of the Stash is kept there too, so one deletion
    takes file, index and media, whether the file, its folder or the user goes, and
    nothing on disk has to follow the rows. The Stash is where things wait, and a
    route has a handful of photos; a journal, which grows by hundreds, stays on disk.
    A preview is made once, when an image is kept.
  - Media leave the Stash through the browser: they are read from the Stash and
    kept with the day or the other file as files picked there would be. That is two
    transfers where the server could copy, and no second way to keep a file with a
    day, of which the import already has one that names, checks and reports.
    A file of the Stash pasted as a trip or a day brings its media as its own
    (`ImportSource.media`), not as files laid beside it under a made-up name for the
    import to find: two files of one name, or a media file named as a route file,
    would otherwise be told wrong.
  - What a paste takes of copied parts is said by the place it is pasted into
    (`PartsTaker`): a trip's row takes routes and tracks, a list of places waypoints, a
    file of the Stash and a day everything. The item counts what will be pasted
    there, and is not offered where that is nothing.
  - Which files are a file's media is told from where they lie, since nothing in a
    GPX file names them: a folder beside the file named as the file is, also with
    " (media)" after the name, as one app exports them, or files beside it whose
    names begin with its name. The list that app writes into the folder
    (`media.json`) says nothing the folder does not and is left out. The same rule
    serves the import into trips, where such media go with the day their file makes
    and no longer with the trip's first.
  - The list of files is the one signal that a file changed. The file the map shows
    is read again when the list says something else of its routes and tracks, and
    leaves the map when the list no longer has it; nothing has to be told that a
    file was rewritten or deleted.
  - A row's chips say what is there, not which extension wrote it: elevation is
    elevation whether it stands in `ele` or in an app's extension. The index
    (`GpxIndex`) therefore knows values by the names files give them on a point, and
    reads the first ten points of a track whole for them; the rest are passed over as
    before, so a large recording is indexed as fast as it was. A value that only
    later points carry is not seen. Garmin's two extensions of a route are named as
    what they are, since what they hold (the calculated way, the route's settings)
    is not a value on a point and is still to be made use of. DMD and Rumo are named
    likewise, by whose data it is, since what they write (a route calculated ahead,
    speed limits, surfaces, a routing profile) is theirs to read. An extension is
    known by its namespace, never by its prefix or its element alone: files rewritten
    by a tool carry `ns2:` where Garmin wrote `gpxx:`, and Rumo has a `RouteExtension`
    of its own. What was found is kept with the row (`stash_items.features`), as its
    line is.
  - Sorting a pile into tours is proposed, never done: no clue in a pile of files is
    reliable alone. Tried on some five hundred files of a club's routes, a shared word
    tied unrelated rides of one region, the end of one route meeting the start of
    another tied every ride that came home to the next that left, and "written by the
    same program" was true of three in four. Two files are therefore tied where two
    clues agree: their names share a word that may name a tour, and one goes on where
    the other ends, or they are a way there and a way back, or they were written
    within the hour by the same program; or, names apart, they were written together
    and one goes on from the other. Names that begin with the same two such words are
    tied alone. Arriving where files of other folders leave from as well, or several
    files of the folder with other names, goes on to nothing: that is a home or a
    meeting point. A hotel that every day of a tour leaves from is none, since those
    files share the tour's name. The words that name no tour (day, part, outbound,
    the weekdays, the small words between, in German and English) are a list in
    `library/grouping.ts`.
  - A group becomes a folder and nothing more. Whether its files are the days of a
    tour, the legs of one day or versions of one route often cannot be told from
    them, and the Stash has no days; that is decided where a folder is made a trip.
    The order in a group is by name, not the order ridden: the Stash lists by name.
  - A folder becomes a trip by being copied and pasted among the trips, as a file
    does, and its days are a guess by rules that can be said in a sentence each
    (`library/stashTrips.ts`), since the trip is corrected in a minute and a rule
    nobody can follow is not. A date settles a day: the one in a file's name, else
    when Garmin's trip planning has its route leave, which the index reads as when
    the route starts (`stash_items.started_at`), as a track's first point is. The
    time on a route's points is no date: it is when the point was made. Without a
    date, a number in the name settles it ("Tag 2"), and without that the legs of a
    ride are told from the days of a tour by length: legs go on from each other and
    stay within 400 km together, which held for all but a handful of some seventy
    undated groups of a club's files, where legs ran 50 to 190 km and days 220 to 390.
    The order ridden is the line the files form, each going on where the last ended,
    since a site's upload numbers sort a ride's last leg first; a hotel that several
    days leave from breaks the line, and then names decide, which number such days.
    A ride there and back is a closed line and starts at home: where most of the
    Stash's files leave from.
  - What wrote a file and when (`stash_files.creator`, `exported_at`) is read from the
    file's head with the rest of the index. The time on a route's points is not used:
    a planning program writes there when a point was made, months before the ride.
    The two columns stand before the file itself, as every column does, so that a
    listing does not read through the files; a table that gains a column is
    therefore made anew by its one-shot script, not altered.
  - KML and KMZ are turned into GPX in the browser before they are kept. The user's
    devices write GPX, and what such files hold beyond what GPX can say is little.
- **A ride is kept once, for itself, and is on days by a link.** The library is a tree
  of plans, and a recording had no place in it but the one day it was put on: assigning
  it moved it out of the folder for recordings, it could follow one plan only, and a
  removed day took it along, though a ride is a record of what happened and a plan an
  intention. The user's answer to what relates the two was that it is many to many and
  made by hand: one ride may have followed two plans, and one plan may take five files.
  So a ride belongs to its user (`recordings.user_id`), its file is kept once
  (unique by user and digest), and `recording_days` names the days it is on. Putting a
  ride on a day, moving, cutting and pasting it change rows of that table and never
  the file; removing a day, a trip or a collection removes links and leaves the ride.
  Only the list of rides deletes one. The folder for recordings, which was a time index
  built by hand for rides nobody had claimed, is gone: the rides are listed by
  when it began, takes new files, and says for each the days it is on. A ride is
  opened for its figures there as on a day: the recording opened, where it is none of
  the day shown, is the ride of that id from the list, so the cards, the colouring and
  the charts are the ones a day's recording has, and nothing of them knows the
  difference but the comparison with a plan, which a ride on no day has none of. What
  is on the map is typed as a ride that may have a day, not as a recording with an
  empty one, so that what needs the day says so. Its track is kept only while it is
  opened there, since the list is long; the tracks of the open trip's recordings stay.
  The rides are
  shown in two lists, all of them in their tab and those on its days with the open
  trip, and either can change them; whatever does says so once it is done, once for
  all it did (`ridesChanged`), and both lists read again. A list that changed them
  itself shows the change ahead of the server's answer.
- **A day of riding is the unit, not the file.** The user's tracker starts a new file
  when the bike moves again after a break, so one outing is two or three recordings.
  They are grouped by the date they began on, where the browser is, and shown as one
  card; the files stay as they are. The lookup judges them the same way, by the
  user's clock on the day looked up: the files of one date together, so that pieces
  that each cover a part of the plan are found as the day they are, and are put on
  the day together.
- **Days are suggested for rides, never given.** A ride and a plan are linked by hand,
  but with hundreds of rides on no day the hand needs a list to work from. The
  suggestions are what a day's lookup finds, run for every day of every trip, for the
  rides that are on no day: one rule, so that what is suggested is what looking up
  the day would have listed. They are worked out when asked for and not kept; what is
  kept is a decline (`recording_declines`), since a suggestion that comes back after
  it was turned down makes the list useless, and putting the ride on the day after
  all forgets it. Rides that are on a day already are left out: they are assigned,
  and a trip that was copied would otherwise have every ride suggested again. The
  lookup is an object for this: the rides are sorted into days of riding and their
  lines read once for all days, where reading them anew for each day took a hundred
  times as long, and a day of riding without a ride that may be suggested is left
  out before its lines are read. Whether a line comes near a point is asked of the
  line cut into runs of 32 segments with their bounds (`LineReach`): a point walks
  only the runs it can be near and stops at the first segment within reach, where
  it walked the whole line before, which had to be thinned to be bearable. On 348
  rides and 500 days in one region, with no match, that brought the run from eleven
  seconds to one here; the server is several times slower and a library larger, so
  an answer still looks through the days for three seconds at most and the planner
  asks on from where it stopped, saying how far it is; no library is then too large
  for a request. The order the suggestions are gone through in is the planner's:
  an answer is a part, so the server does not sort.
- **A recording's card says what its file is like.** The same ride recorded by two apps
  gives two files that differ in what they are worth: one has a point every second,
  another every three; one has lean and acceleration, another speed alone. The card
  says it in a ride's own terms rather than as a grade: who wrote the file, how many
  points, the median time and the mean way between them, and the values by the names
  the file gives them, since those names are what the user knows from the app.
- **A file of the Stash is copied whole, and pasting it imports it.** Its menu had
  three ways out, Copy routes and tracks, Copy waypoints and Save tracks as rides, which
  asked the user to decide what the file was before knowing where it would go. One Copy
  puts the file on the clipboard, and the place it is pasted decides, by the rules an
  import of that file there already follows: a trip in a folder of trips, a day in a
  trip, routes and stops in a day, places in a list. Nothing new is read: the paste
  hands the file's GPX to the import of the place. A track still becomes a ride from
  its own row's menu.
- **Parts of Stash files are copied between files on the server, as XML.** Putting a
  file together from others, a route from one, the waypoints from another, would lose
  what the planner does not read if it went through the planner's own model: device
  extensions, symbols, a track's sensor values. The server copies the elements whole
  from the stored source into the stored target (`GpxEdit::with`), in the order the
  format gives them, and reads the index again. The source keeps its part: a copy,
  since a part cut would rewrite the file it is taken from as well. A file's waypoints are one row and go all
  together: picking single waypoints would make the Stash an editor, which it is not.
  The clipboard holds what was taken by file, kind and place, and each place it is
  pasted reads it its own way: a file of the Stash through the server, a day or a
  list of places through the import's reader.
- **The tabs are capitals under icons.** As the page's main way around they were four
  plain words in a row, lighter than the rows under them. They are now bold capitals
  with letter-spacing, the one shown over a line in full ink, each under a drawn icon.
  Icon over name and not beside it: four names with icons beside them need about 330
  px, and the panel's default leaves 290 beside the fold button and the gear. The
  letters grow with the panel by a container query, to a size, so that a wider panel
  does not leave them small.
- **In the Stash the mark is on what the map shows.** The strip and the tint followed
  the folder clicked last, as they follow the marked folder among the trips, but a
  file or a route of it shown on the map did not take the mark as an opened trip
  does: the strip stayed at a folder elsewhere while a row deep in another branch
  was tinted. A file or a part of it shown now holds the mark (`markInFile`) until a
  folder is clicked, with the strip down its folders and its file, and its folder is
  the one shown, which takes what is pasted. The row of a file's waypoints shows them
  alone at a click, as a route's row shows the route: it toggled its selection
  before, which left it tinted beside the row shown and read as two things selected.
- **A menu holds what can be done; greyed out means not now.** Menus were shared by
  kinds of things and showed every entry to each, greyed out where it did not apply:
  Duplicate on every folder, Export on the Stash's, Rename for several. An entry that
  can never be used where it stands teaches nothing and makes the greyed ones
  meaningless. Each menu now holds only what can be done with what it is opened on,
  by its kind and by how many are selected, and greys out an entry only where
  something outside the selection is in the way and may change: the clipboard is
  empty, the folder holds no trip, the rides do not follow one another, a trip is
  still being read. A line that says what is selected, or why two kinds are not
  acted on together, is a note and not an entry.
- **Texts are written as software says things.** Labels and messages are the
  conventional short forms ("Assign to this day", "Trip not found.", "No GPX files
  found.") and not descriptive sentences, in English and in German alike, so that a
  menu reads as menus elsewhere do. A menu entry never carries the name of what it
  acts on: a paste says the kind and the number ("Paste 1 route"), since a file's name
  can be as wide as the screen. A place's "kind" is a category in the texts; the code
  keeps `kind`.
- **The open trip is acted on only while it is shown.** A trip stays open, with its day
  selected, while another tab is shown, so that coming back finds it as it was. What
  acts on it from the map or the keyboard (undo and redo, paste, the map's spot menu, an
  own place added as a stop, a route taken up by a tap, the places along the day) asks
  whether it is shown (`tripShown`, `shownDay`), not only whether it is open: otherwise a
  key pressed in the Stash or among the rides changed a trip out of sight, and the
  change was saved.
- **The map's view can be locked, in one place.** Every move the planner makes of
  itself goes through two effects of the map, the one that shows a day taken up and
  the one that goes where it is sent, so the lock is a signal both read; nothing that
  asks for a view has to know of it. What the user asks the map for directly, a place
  searched or the own position, is not held back. The lock is not kept from one
  loading of the page to the next: a map that does not follow, for a reason set days
  ago, reads as broken.
- **Hiding all places is a switch over the kinds, not a state of them.** Setting every
  kind to none and back would lose how each was set, so one signal makes every standard
  kind count as wanting none, which also stops tiles from being read meanwhile, and
  empties the own places drawn (`ownPlacesOnMap`); the kinds' states stay as set. As
  the lock, it is not kept beyond the page: places missing days later would read as
  lost. It and the lock are one control, a toggle button given its state, labels and
  icons (`map/ToggleControl.tsx`).
- **A ride held against a day is red and narrow.** To judge whether a ride is a day's,
  both have to be seen. Rides shown from their list were drawn as wide as routes, over
  them, in the palette the routes take their colours from, so a ride that followed
  the plan hid it, in its own colour. Held against a day, by a suggestion or by the
  day's lookup, rides are drawn in one red that the palette does not have and at two
  fifths of a route's width without a casing: the route is a rim on both sides where
  they agree, and each stands alone where they part. The palette's first colour, a
  magenta, is too near that red, and it is the colour of every first day; routes in
  it are drawn in the palette's blue while rides are held against them. Both are one
  layer of the compared lines with a filter, since a width that follows the zoom
  cannot also follow a feature.
- **Rides are merged on the server, as text, and the pieces stay known.** A tracker
  starts a new file after a break, and though the list of rides and the lookup group a
  day's files, a ride's figures and its comparison with the plan take one file. Merging
  writes a file no tracker wrote, which the rule that a recording is its file as
  recorded does not allow for; it is bent as little as can be: the first file stays as
  it is and the track segments of the others are put after its own, each point with
  everything it measured, so a break is still a segment's end. The files are megabytes
  and are on the server, so they are joined there, as text: reading them into a tree
  would take many times their size, and sending them to the browser and back would be
  megabytes travelling for nothing. Namespace prefixes the later files declare on
  their root are added to the first one's; a prefix two files declare differently is
  refused. What the first file says of itself above its points (Ridelink's summary of
  distance and speeds) is left as written and is then that of the first piece only.
  The merged ride takes the pieces' days, and the pieces are deleted, since kept
  beside it they would be counted and drawn twice. Their digests are kept in
  `recording_parts`, so that a tracker's folder dropped again does not bring them
  back; deleting the merged ride forgets them. Only rides that follow one another are
  merged, by when they began, and none without times, which have no place in that
  order.
- **A merge is questioned where it joins what lies apart, and never refused for it.** The
  planner draws a recording as one line through all its segments, so two files whose
  ends lie apart are joined by a straight line, and a pause of half a day means two
  outings rather than one with a break. Above six hours or 150 m the question that
  asks for the merge says the pause and the way; the choice stays the user's. A ride's
  end is read from its files when the question is asked and not kept beside it:
  nothing else needs it. Two files of one of the user's afternoons lie 204 m apart,
  the way the bike rolled before the tracker started again, so the way is said often.
- **A ride is named after the places it began and ended in, by Nominatim, in the browser.**
  One app names its files after their start and end, another names them all alike.
  Nominatim's reverse lookup at the level of towns (`zoom=10`) gives the names the
  first app writes, for the same rides. It is asked from the browser, as the place
  search is, through one gate for both, since its policy of one request a second is
  per user; a position is asked for once, to some hundred metres, while the page
  stands, because most rides begin where others began. The positions are the ends of
  the line kept beside the file, which thinning leaves where they are.
- **The overlay of all rides draws the lines that are kept already.** A recording's line
  is kept beside its file, thinned to ten metres, for the lookup and the duplicates.
  Measured on 164 of the user's rides, 10,800 km, those lines are 51,000 points and a
  quarter of a megabyte; five hundred rides stay under one. So the overlay is one
  request for all of them and one line layer: no grid of counts, nothing computed
  ahead and nothing to update by hand, which were the plan before the numbers were in.
  How often a road was ridden is what overlapping translucent lines add up to. It is
  an overlay like the roadworks, read by the map itself and anew whenever it is
  switched on, and drawn in a colour apart from the base maps' roads and the routes'
  palette.
- **A day's media are journal entries of another kind.** A day already took a PDF, as a
  journal entry with a file; what was missing was a list of its own in the day's pane,
  links, and collections, which have no journal. A table of its own would have needed
  everything the journal's has again: the file store, the type read from the content,
  previews, the copy of a trip, the merge, the archive and its import, the removal of
  a trip's files. A column says which of the two an entry is, and a second one holds a
  link's address; the journal lists its kind and the day's pane the other, so that the
  diary stays a diary. The price is one migration.
- **Media belong to a day, in a collection too.** A collection's files could have hung
  on the collection itself, which would have been a second place for them in the
  model, the interface and the import. They are kept with a section named for them
  instead, an ordinary section with no route; a file that belongs to one route can be
  moved to that route's section. Making a trip, such a section makes no day and its
  media go with the first: files carry no date to place them by.
- **A day takes its media along.** A journal entry outlives its part and stays in the
  journal, as the diary should. Media without their day would be files nobody can find,
  so the entries a save leaves without a day are removed with their files, right after
  the save that removed the day.
- **Media are not shared.** The journal is on a shared trip's page with its files once
  it is published. Booking confirmations and tickets carry names and addresses, so what
  a shared link can list and fetch is the journal's kind alone, checked where the
  entries are read.
- **A PDF is shown by the browser.** The lightbox frames the file and leaves the pages
  to the browser's own viewer: no library to bundle, where the build already takes
  half a minute on the server. A browser that says it shows no PDF inline gets the
  file in a new tab, which is what the link does anyway. Files are served under their
  type as read from their content, inline for images and PDFs and as a download for
  everything else, and with `nosniff`, so that an upload cannot pass for a page.
- **Files are moved and copied on the server.** A scan or a manual is megabytes that
  would travel down and up for nothing.
  The clipboard holds the ids, and the server moves the row and its file to any day of
  the user's, or copies both.
- **A route kept as waypoints is mended where it is seen, not guessed at when it is
  read.** Some planners write a route as a string of waypoints, named by number or by
  the address of each. The import cannot know that 214 waypoints are a route and 105
  are a directory of restaurants, so it keeps both as waypoints, and a collection
  takes any file whole. There Convert makes a route of them. "By order" relies on
  the order: the import keeps a file's waypoints as listed, a day without a route does
  not sort its stops, and the server stores them by position; a test holds the sorting
  to that. "By number" takes the stops numbered in a series and so leaves the one
  waypoint among them that is a place. Which of the two a file wants is the user's
  choice, each entry saying how many stops it takes: a rule that picked one, numbered
  where most stops are, was wrong for the second file it met. The stops become a
  routed route rather than a track: every one of them is a point the planner set, none
  is a sample of a line. They are no stops afterwards; a route point has no name, and
  eighty stops on eighty points is what the file's author never meant.
- **Conversions are one submenu.** A track into a route, stops into a route, and
  whatever a broken file needs next are found under Convert, each kind of conversion
  an entry and its variants a submenu of that, instead of entries of their own among
  what a part's menu always has.
- **A list of places is a collection in a folder of its own, its kinds are sections,
  a place is a free stop.** Places need what stops have already: a position, a symbol,
  the fields, the dialog, a marker, copy and paste, undo, the save. A table and
  an editor of their own would have repeated all of it. They are kept apart from trips
  and planning material by the folder, not by a field on the stop: in a trip the order
  of the stops says something and their kind does not, in a list of places it is the
  other way round, and a section per kind in a trip's panel would have been wrong.
  The stop's dialog leaves out what only a ride has and leaves those values as they are.
- **A place added to a day is a copy.** The trip is one document, saved, exported and
  shared whole; a stop that pointed at a place in another document would change, or
  vanish, with a list edited later, and a shared trip would depend on something its
  reader cannot see. The copy takes the name, symbol, position, address, contact,
  website and notes and is a stop of the trip from then on.
- **The user's places are read in one request, not by tile.** A user keeps hundreds of
  places, not the hundreds of thousands the store of OpenStreetMap holds; one list
  answers the map, the list of kinds and the tap alike. It is read again when the
  library lists a list of places as new, gone or changed, and not for what else it
  lists afresh; for that a trip left for another is listed again as it was saved. The
  query starts from the user's folder for places, which needs the index on a trip's
  folder: without it SQLite read every stop of every user.
- **Own places are dots in the colour of their kind.** The kinds are the user's words,
  so no icon can stand for them, and the stop's own symbol is unset in most imported
  files. Names are not drawn: the raster base maps bring no glyphs, and a hundred
  labels cover the roads the map is read for. The name is in the tap.
- **Links to the host most waypoints share are not a place's website.** A directory
  that offers its places as a file puts a link to its own page on every waypoint,
  beside the place's own; the stop has one website. Where a file's waypoints link to
  several hosts, the links to the most frequent one are dropped and the last link left
  is kept; a file whose waypoints all link to one host keeps those links.
- **A KML file is read into what a GPX file holds.** Everything that takes a file takes
  what the GPX reader gives: a name, waypoints, routes and tracks. The KML reader gives
  the same, so that days, sections, places and the refusal of a file of waypoints
  alone work for it unchanged, and the format is told by the file's name in one place.
  It is written here, like the GPX reader, on the browser's XML parser: the part of KML
  that holds routes is small, and a library would have brought GeoJSON to be turned
  into the same thing. A line is a track and never a route, since KML has no points to
  route between; Convert makes one where it is wanted. A KMZ is opened with the zip
  reader the exported trips are read with, which moved beside the readers for that.
  Recordings stay GPX: a recording is kept as its file, and the server reads that
  file for its line and its start.
- **A file of waypoints alone is no trip.** Dropped on a folder of trips it made a trip
  of one day with a hundred stops and no route, which nothing in the planner is made
  for. It is refused there with the pointer to the Places folder.
- **What is new or imported is asked for where it goes.** The toolbar's icons for a new
  trip, a new folder and the two imports acted on "the folder shown", which the user
  had to set first and could not see in the icon. New and Add are now in the menu of
  the folder or trip they go into, the top of a tab's tree included, and the toolbar keeps only
  its switches. New lists what the row can hold, so a collection, which holds
  nothing that is made empty, has none.
- **An import is never asked how it is organized; the folder and the tree say.** The
  dialog offered a trip per folder or a trip per file for the whole tree. One rule
  now reads every folder by itself: a folder of GPX files alone is a trip with a day
  per file, and a folder that also holds folders of them is a folder of trips, its own
  files a trip each. A folder of one trip and a folder of many are told apart that
  way, which the two modes could only do for the tree as a whole. A browser's file
  dialog picks files or a folder, never both, hence two entries under Add. The
  kinds of folder each have one sensible reading of what is put into them.
- **Planning material is a trip of another kind, not a store of its own.** A collection
  is a trip whose days are its sections, one per file, without dates: it is stored,
  loaded, saved, drawn and searched as a trip is, and its panel leaves out what belongs
  to riding (dates, times, the journal, the tools, the export). Its kind is fixed when it
  is created. Routes go from a collection into a trip by copy and paste through a
  clipboard that outlives the open trip, so that the same two steps also copy between
  trips and between days; the stop's former *Copy…* to another day became the same Copy.
  Pasted onto a whole trip, routes go where a file import would put them: onto the day of
  the date they were copied from, or a new day of that date, undated ones onto a new day
  each. Pasted onto a folder that holds collections they make a collection, since a set of copied routes from
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
  of the panes, dragged at their edges, are kept the same way: they depend on the
  screen. Each pane holds its own edge, outside of what scrolls in it, and is told
  which pane it sizes; a pane is at least 280 px wide and at most what leaves the map
  its minimum.
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
  job mails. `make update-places` asks for exactly those that were never fetched,
  area by area: fetching the whole area again for one kind would replace five kinds
  that are there to get a sixth, and a kind the planner learns of later is missing in
  every area at once. A kind fetched with no place found has its note and is not
  asked for again; an area without any fetch is not one the user chose. The public
  server turns questions away by spells (a 502 for three areas, then answers for
  four), so a question turned away is put again after the pause, three times in all,
  and the run goes on to the next area whatever came of it: ending the run after a
  few areas without an answer, which was tried, would have kept it from the areas
  that were answered.
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
- **The kinds of places are rows of the Places tab, not a menu on the map.** Several
  kinds are switched at a time, and the app's menu closes with each pick. The store's
  kinds stand under "Standard" on top of the tab, above the user's own lists, whose
  kinds are their sections: one place for all places, and no second list behind an
  icon. The map's own controls stay for what belongs to the map alone: the base map and
  the overlays.
- **A kind of place has one switch of three states.** All in view, along the day's
  routes, or none, per kind: a hotel is wanted anywhere near the day's end, fuel only
  along the way, and a single switch for "along" across all kinds could not say that.
  "Along" without a day shown shows nothing rather than all in view, so that a state
  means one thing. "Along" follows what is looked at: the recording opened or the route
  taken up, else the day's routes, since the places along a plan are of no use beside a
  ride that went another way. The states are the browser's, as the map's other layers are; how far
  "along" reaches and the badge a kind is drawn with are the account's, set from the
  kind's gear, the badge one of a fixed set drawn alike, so that every place
  on the map looks like a place and none like a stop.
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
  overlays use. Recordings and the routes drawn to compare them had a fixed 3.5 pixels,
  a hairline on a road blown up to forty, at the very zoom a ride is held against its
  plan; they take the width routes have, set once for all lines of the trip. A recording
  under a route of its width is covered where both run alike, as it was under the
  wider route before; a recording opened is drawn without the plan.
- **The map's credits stay MapLibre's, and the tools step aside.** On a small map
  MapLibre shows its credits spread out until the map is first dragged, as
  OpenStreetMap's attribution guidelines ask, and offers no way to start them folded.
  They are several lines on a phone and lay under the route tools; rather than fold
  them through the control's inner workings, the tools stand above them while they are
  spread out.
  The guidelines also let credits fold by themselves after five seconds, as long as
  they are found again by whoever looks for them, so five seconds after the map has
  loaded they are folded by a click on the control's own button (`baseMap.ts`), which
  is what a user does and leaves the control in a state it knows; the button stays
  and unfolds them.
- **Nothing opens or folds by itself.** Panes opened and folded as side effects: a day
  picked opened its pane, the pane folded the library, a click on a trip loaded another
  document, and a switch ("Fold automatically") said whether the library gave way.
  Each rule was reasonable alone; together the screen changed in ways the click did
  not name, and which trip was open could not be seen. Navigation is explicit now. A
  click on a row selects it and shows it on the map. The pad at the end of a row opens
  the next pane and closes it again, and its arrow says which. Every pane folds to a
  strip by the pad in its head, which stands at the same place on the strip, and is
  unfolded there; the folds are kept per browser, in any combination. A pad that
  opens a pane unfolds it, since it was asked for. The switch, the button with three
  lines and the sheet that folded down while a route was edited went with the rules
  they served.
- **A pane that stands follows the row clicked.** With the pad alone moving a pane,
  looking through trips or days meant a click and a pad for every row, and the pane
  beside the list showed another row's contents than the one marked. While the pane of
  the next level is open, a click on a row acts as its pad: another trip is opened in
  the place of the open one, another day's or category's contents take the pane. A
  trip opened this way while a day's contents are shown shows those of its first day,
  so that the panes stay as they are while trips are gone through; a trip of one day
  has its contents as its pane and none beside it. A pane that is closed still opens
  by the pad alone, and none is unfolded by a click. Selecting a day from the map
  leaves the contents where they are.
- **A trip is open for as long as its pane stands.** "Open" had no place on the screen:
  a click on a row opened a trip, and its pane was a second thing that could be open
  or not. The pad on a trip's row now opens the trip, and its pane is there for as
  long as it is open, folded or not; closing the pane (its own pad, the pad on the
  row, Close in the row's menu) closes the trip, saved. No flag says whether the pane
  is open: it follows from the open trip (`paneShown` in `state/library.ts`). A list
  of places is the exception: it opens by a click on its row, as a folder unfolds,
  and has a pane only for the category whose pad was pressed; closing that pane
  leaves the list open. The duplicates report stands in the pane's place while it is
  switched on; the trip stays open behind it, and its pad brings the pane back.
- **A trip of one day has the day's contents as its pane.** Most trips are of one day,
  and a list of one row before its contents is a click that says nothing. The day
  whose contents are shown (`detailDay` in `state/trip.ts`) is the only day of such a
  trip, and the contents take the trip's pane, its place, width and fold, under the
  trip's name and with the button that adds a day; the pad that closes it closes the
  trip. A second day brings the list of the days and an undo takes it away again:
  the pane follows the document, and nothing remembers which form it had.
- **A click on a trip looks at it.** Looking through trips opened each: the open one
  was saved and replaced, its undo ended, and the pane changed under the pointer. A
  click on a trip's row now reads the trip and draws it on the map without opening it
  (`looked` in `state/trip.ts`; read in `App.tsx` beside `open`, counted with it, so
  that the later of the two wins). The open trip stays open with its panes, and a
  click in them, a day picked or a click on its row gives the map back to it. The
  look is drawn from a map source of its own (`LOOK_SOURCE`) by the same pure
  `routeFeatures`, under the open trip's layers: nothing of it is hovered, taken up
  or edited, and no reader of the open trip's lines had to learn of a second trip.
  What acts on the open trip on the map asks `tripShown()`, which is false during a
  look as it is on another tab: the keys, the markers, the route tools. A trip that
  is closed while it is on the map stays there as a look, at the view the map has, so
  that closing changes the panes and nothing else. The look is read again when the
  library lists its trip as changed, and ends when it is listed no more. It costs a
  request for the first click on a trip's row, as opening did; the trip looked at
  already is shown from what was read, and a trip just closed is not read again for
  the listing of its own saves.
- **The mark is in the open trip, on the trip looked at, or on a folder.** The tree has
  one mark. A look takes it. A click in the open trip's pane ends the look and gives
  the map back, but not the mark, which a day takes when it is picked. A folder clicked takes
  the mark and leaves on the map what is there.
- **The pane of a day's contents has a day of its own.** The selected day is the one on
  the map, where it is edited; the day whose contents are shown (`detailDayId`) is
  the one whose pad was pressed. They are the same when the pad is pressed and may
  part: another day is shown on the map while the contents of the first stay. A
  click in the contents makes their day the selected one before the row clicked hears
  of it (the pane's `onUse`, in the capture phase), so that a route taken up there is
  of the day on the map. What the contents' menus and buttons do takes its day as an
  argument or finds it from the stop or route (`addRoute`, `addParts`,
  `convertPoint`, `updateStop`, `removeStop`), where it acted on the selected day
  before; what is done on the map keeps to the selected day.
- **A trip whose save fails is not left.** Leaving saved first and went on whatever came
  of it, so a trip closed or replaced while the server could not be reached lost its
  last edits; a pad that closes makes leaving frequent. `open` and `leave` in
  `App.tsx` stop where the save failed: the trip stays open with the problem shown,
  and what asked for the leave (a delete, a merge, a paste onto the trip, an import)
  does not go on. A save the server refuses as stale does not stop them: there the
  way on is to load the trip again, which is a leave.
- **Trips are listed by name.** They were listed last changed first, which put the
  trip worked on at the top. But anything that changes a trip moves it: a route moved
  from one trip to another sent both to the top of a long folder, out of sight of
  where the pointer was. Folders and files of the Stash were by name already; the
  trips now are too, on the server, with the same collation. The time a trip was
  changed is still sent, for what needs to know that it was. The row of the open
  trip shows the name the trip has now, and the trips are listed afresh once a save
  renamed one: the list had only learned of it when it was next read.
- **A trip's days are in its pane, not in the tree.** The tree listed the days of every
  unfolded trip, the open trip's from its document and the others' from their
  outlines. The two kinds of row looked alike and were not: one had a grip that
  sorted, a journal and a menu, the other a click that loaded its trip. Which trip
  was open was a state the tree did not show, and it changed with every click, taking
  the rows' controls from one trip to another. Most trips are of one day, and each
  showed a level of days for it; hiding that level for them made a third kind of row.
  Keeping every unfolded trip loaded would have made the rows equal, at the price of
  several open documents, each with its own undo, autosave, journal, recordings and
  selection, where one is edited at a time. The tree now stops at the trip, and the
  days stand under each other in the trip's pane beside the library (see "A trip is
  open for as long as its pane stands"). Its
  row still pastes into its day what a trip does not take; what a trip takes (days,
  routes, files) it takes as a trip, open or not, so that the same paste does not
  mean two things. A list of places keeps its categories in the tree: its one
  category says what its places are, and a category is picked there far more often
  than a day of a trip was.
- **The panes are columns of a flex row, and the map keeps a minimum.** The page was a
  grid whose columns followed from what was open, with a rule for each combination of
  library, pane and strip. Three panes that fold on their own are too many
  combinations. Each pane now has its width as its basis and gives way down to
  280 px, a folded one is as wide as its strip, and the map takes the rest and never
  less than 320 px, so that no combination of panes pushes it off the screen.
- **The edge of a pane has a handle.** The edge was a strip of 6 px that showed only
  under the mouse, which a finger neither sees nor hits. It now bears a handle at its
  middle, and where the pointer is coarse the strip is 22 px wide, most of it over the
  map, so that it does not take the taps meant for the buttons at the end of a row.
- **Below 1200 px one pane is shown, the deepest that is open.** Three panes at 1024 px
  left the map 324 px. Below 1200 px one pane stands beside the map: a day's contents
  where they are open, else the trip's pane, else the library (`shownLevel` in
  `state/panel.ts`). A pad that opens a pane so shows it in the place of the one it
  stands in, which slides in from the right, and back from the left. The pad that
  closes a pane reads Back there and does what it does on a wide screen: back from a
  trip's pane closes the trip. A way back that kept the trip open would be a trip
  open without its pane, the state the rule above removed; the price is that the
  library and its tabs are reached by closing the trip, where its undo ends. The
  panes are the same elements at every width, and the width stands in the stylesheet
  and once in the script, as the same media query.
- **Touch screens by stylesheet rules.** On a touch
  screen every field's text is 16 px, below which Safari zooms into the page on focus
  and stays there, and an icon button is at least 36 px; a grip or a pad is drawn as
  narrow as before, since the row's name needs the room, and is hit in an area that
  reaches a finger's width around it; heights that follow the screen
  use `dvh`, which leaves out what the browser's own bars cover.
- **On a phone held upright the pane is a sheet under the map.** Up to 720 px wide and
  upright, the one pane shown is a sheet: the library, a trip's pane and a day's
  contents alike, pulled by its top edge to about half of the screen or nearly all
  of it, and folded to its head by its pad, an arrow down there. Held sideways a
  phone is a narrow desktop, the pane beside the map and folded to the side: a sheet
  would take the height the map has. Nothing is a mode of its own and no component
  exists twice; the same elements are placed otherwise.
- **The day's sheet is a row under the map, not a layer over it.** A sheet over the map
  would cover MapLibre's credits and scale, and the route tools, the routing's state
  and the fitting of a day into view would each have to know how much of the map it
  hides. As a row of the page it makes the map smaller instead: everything on
  the map stays where it is seen, and MapLibre follows the size by itself. The price is
  that the map is redrawn while the sheet is dragged.
- **The free space of a pane has the menu of what the pane shows.** Most of a pane is
  empty below its rows, and a right-click there did nothing or brought the browser's
  menu, while what one wants there (a new folder, files added, a paste) was in the
  menu of a line at the top. In the library the space answers with the menu of the
  tree's top, which is that. In a trip's pane and in a day's contents it first
  answered with the trip's and the day's whole menu, as on their rows; but Duplicate,
  Move or Remove on empty space among a list of days say nothing of what they act
  on. The space of a pane is about what the pane lists, so its menu holds what adds
  to that list and what is pasted into it, as the buttons on the headings do, and
  the trip's journal; what acts on the trip or the day itself stays on its row.
  Paste in a trip's pane puts days after the last day as an edit of the open trip:
  the paste of the trip's row in the library goes by the server and closes the trip
  first, which would take the pane away under the pointer. It is for the
  mouse alone (`spaceMenu` in `ui/cardMenu.ts`): a long press would have to switch
  off the selection of text in the whole pane, as a row's does for the row, which
  would take the notes of a day with it, and on a touch screen every row and the
  line at the top have their menu button. A right-click on a row without a menu, a
  text field, a link or selected text is left to the browser.
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
  shown. The mark on the open trip's row that said the trip was saved, changed or
  being saved was dropped: saving is automatic, and a mark that nearly always shows a
  tick says nothing. What needs saying is that it failed, which the notice does, and
  the browser asks before a page with unsaved changes is left.
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
  several at once, and the open trip keeps its place among the others. A list's
  categories are listed without its document from the outlines, so any list unfolds;
  only opening one loads it (a trip's days have since moved to its pane, see there). Since the library is now in reach while a trip is open, what the library
  does to the open trip on the server (deleting, merging, pasting onto it) leaves the
  trip first, saved, and renaming it is the edit of the trip itself: the open document
  is never changed behind its back.
- **Language and colours are chosen in the settings, not in the header.** Both are
  set once and then left alone, and as two unlabelled selects in the panel's header
  they took a line of it on every screen and wrapped it into two on a phone. They stand
  in the settings with the account's own, said to be this browser's.
- **The tabs are views of their own, and the map follows the tab shown.** Switching
  tabs used to leave the map and the pane as they were, so that a Stash file stayed
  drawn over the rides and a trip's day pane over the Stash, and nothing said which tab
  they belonged to. Now the map and the pane show what the tab shown holds (the
  settings show what the tab before held, so that a setting's effect is seen), and
  pinned things stay, since pinning is the user's way of saying "keep this". Only one
  trip document is open at a time: keeping a trip and a list open side by side would
  double the open trip's state, its undo, its autosave and everything that reads it.
  Trips and Places therefore remember what they had open when the user left them by
  their tab (`state/tabs.ts`) and open it again, saved, when the user comes back by
  their tab; undo does not survive that. Only the tab buttons do this: a tab shown
  because a ride or a duplicate opens a trip there opens that trip and nothing else. What is
  pinned stays on the map either way (see the pins).
- **The settings are a tab.** A dialog over the map hid what a setting changes, and was
  a second way into the planner beside the library's tabs. The gear is a fifth tab, and
  its pane lists the settings by section, each kept as it changes, so that the map
  beside it shows the effect at once. A new language loads the page again at once,
  which is why it is a select of its own and not part of a form. The password is changed
  there with the one in use (`PUT /password`): a session left open does not give the
  account away.
- **What is unfolded in the tree is the user's doing.** The open trip was always
  unfolded: opening a trip listed its days and folded those of the one open before, so
  the tree moved under the pointer with every trip opened. A list now lists its
  categories only while it is unfolded, open or not, and opening one folds no other;
  a trip's days are not in the tree at all. One thing
  still unfolds by itself, to keep something in reach rather than to rearrange the
  tree: the folders around a trip when it opens, since a trip opened from the search or
  from the address would otherwise be out of sight.
- **A row unfolds and folds by a click on it; there are no arrowheads.** A folder, a
  trip and a route each had an arrowhead beside the row that did part of what a click
  on the row did. They answer to one rule instead (which holds for folders and lists
  of places since a trip's days moved to its pane; a trip's row shows it on the map,
  and a day in the pane is shown and let go by a click). The tree has one mark, on
  the row clicked last. A click on a row that is not marked marks it and unfolds it,
  and for a list that opens it, for a category that shows it; a click on the marked
  row folds it, or unfolds it where it was folded. A click on the list while its
  category is shown closes the category: the list is then what is on the map. The
  list stays unfolded on that click and folds on the next. Only the category that is
  shown has nothing to fold, so a click on it does nothing but take the mark back
  from a folder that held it. What folds takes what it holds with it, a folder its
  folders and lists, a list its category, a day the lists of its routes: what was
  closed is closed when it is seen again. What is open above the mark carries the mark's strip
  without its tint, as do the open trip and its day while the mark is elsewhere, so that the way down to
  the mark and what is on the map and in the pane can be told from what is merely
  listed. Earlier versions kept a mark for the folder shown and another for the open
  trip, and tied marking to opening or to folding; each took a step away or showed two
  marks at once. A route's row follows the same rule with editing as its mark: a click
  takes the route up and lists what it holds, and a click on the route being edited
  folds the list and unfolds it again.
- **A click on a row never takes off the map what the row put there.** A second click
  on a day showed the whole trip again, on a route ended its editing, on a recording
  closed it, on a file of the Stash took it off the map: a row was a switch, and a
  click meant to look again, or to fold, undid the first. A second click now folds
  where the row has something to fold (a file, a route's points) and does nothing
  else. The way back is the row above: the day's row shows the day whole, letting go
  of the route or recording taken up, the trip's row the whole trip, the file's row
  the file whole. A recording also keeps its close button over the map, the one way
  to close a ride in Recordings, which has no row above it. The buttons of a folded
  pane's strip follow their rows, so that a click means the same folded or not; the
  way back is the row or button above there too, in the pane before.
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
- **A day's contents have a pane of their own.** A day's routes and stops were listed
  inside the day's card, in the same narrow column as the library, the trip and its
  other days: on a wide screen one level showed and the rest of the width went
  unused. They now stand in a pane beside the list of the days, opened by the pad on
  the day's row, so that the days stay in view while one is worked on. Planning is
  the same screen with other proportions, not another mode: each pane folds to a
  strip when the map is what matters.
- **A trip's pane folded keeps the days as numbers.** With the pane of the days folded,
  the day shown could only be changed by unfolding it again. The strip lists the open
  trip's days as numbered buttons in their route colour. Numbers, not small pictures
  of each day's line: a number is read at once and is right while a route is being
  drawn, where a thumbnail of the line would come from the outline, which is as old as
  the last save, shows two days of a loop alike and an empty day as nothing. A phone
  held upright has no strip: its sheet folds to a bar.
  What a number stands for is said by a card of the strip's own, not by the button's
  `title`: the browser shows a title only after the mouse has rested, in one line, and
  the strip is passed over to find a day. The card is there with the mouse and gone
  with it, and is for the mouse alone; the button keeps its name for a screen reader.
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
  The key reading is one function (`ui/fileVerb.ts`); the library, the trip, the
  rides and the duplicates report each listen and act only on their own selection or
  clipboard (the rides copy and delete, as their menu does), and
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
- **A trip that is opened says how far that has come, in three steps.** A collection
  of several megabytes took seconds in which nothing showed. The row first waits for
  the server, then counts the bytes that arrive, then says that it is opening until
  the map has drawn the routes. The count is of unpacked bytes, since that is what the
  browser hands out as it reads; the packed length the server sends says nothing of
  them, so the server adds the unpacked one in a header of its own. The last step
  waits for the routes' source rather than for the map to be idle, which would also
  wait for the base map's tiles on a slow line. The library answers again as soon as
  the document is here; only the row keeps its ring until the map is done.
- **The highlight under the pointer is a veil, not a colour.** As an opaque grey it
  replaced whatever a row showed: the tint of the special folders, the mark, a
  selection. As a translucent layer of the text's colour it darkens what is there in
  the light scheme and lightens it in the dark one, whatever that is, and no row needs
  a highlight of its own. A grip and a pad take none at all: they are handles of the
  row, not buttons.
- **A duplicate's location is opened beside the report.** Opening it gave the pane to
  the day, so each look at where a route lies cost the report, and going through ten
  alike meant showing it again ten times. The trip now opens at the day with the
  report still in the pane: the map shows the day, which says where the route is,
  and the trip's own pane is one press of its pad away.
  Who has the pane is one rule (`reveal` in `state/panel.ts`): a pad that opens a trip, a day's
  contents or a category's places takes it and unfolds it, at the press; a day that
  is merely shown on the map does not. The report's selection is not kept while it is away: with the
  location opened beside the report there is little to come back to, and the one
  selection there is belongs to what is in view.
- **A route and a track are never duplicates of each other.** The report compared
  lines whatever they were of, so a planned route and a track of the same way made a
  group, and a comment in the code called that a ride kept twice. It was never asked
  for and is wrong: one is a plan and the other a line, a trip often keeps both on
  purpose, and holding a track against a route is what the recordings' lookup and
  comparison are for. Only routes are compared with routes and tracks with tracks.
- **A day reports against itself.** For a while a group that lay in one day was left
  out: a trip keeps the planned route and the track of it on the same day, and each
  such day was listed as a ride kept twice, hundreds of groups that buried the ones
  worth looking at. Rules were added to tell a plan with its recordings from a real
  duplicate, by how many planned routes and exact copies the day held, and then every
  day's own group was dropped. All of that treated the symptom. Since a route and a
  track are never held against each other (the entry above), what is alike within a
  day is the same route twice or the same track twice, which is a duplicate, and the
  rules are gone.
- **What is taken up is drawn alone, but for what is pinned.** The map drew every route
  of the day shown and, by a switch on the day, all of its recordings or none, which
  left no way to look at one route of several or at three rides of ten. With the whole
  trip or a day shown and nothing taken up, the planned routes are all drawn, since the
  plan as a whole is what those two views are for; recordings are not, since a day
  collects many. Taking up a route or opening a recording draws that one alone: the
  work is on it, and the others are in its way. What is to stay beside it is pinned,
  route or recording, and a pinned thing is on the map of its day whatever else is
  taken up. A route being edited and a recording opened are both taken up and both
  drawn, which is how a plan is held against a ride. A first version gave every route
  and recording an eye that said whether it is on the map, routes open and recordings
  closed, with an eye over each of the two groups. It kept every route on the map while
  one was taken up, so the wish to see one thing alone was not met, and hiding the
  others meant closing their eyes one by one and opening them again afterwards. The
  eye was right about one thing and that is kept in the name: a mark that is off while
  its route is drawn must not read as "hidden", so it is a pin and not an eye. The
  neighbouring days draw their pinned routes only, by the same reading: they are
  context for what is taken up, chosen like the rest of it. Recordings are drawn for
  the day shown only, but for the pinned: each is a file of megabytes. The pins are
  kept in the page and no longer: they say what is looked at now, not what the trip
  is. A recording added to a day or put on it by the lookup is not pinned: a pin is the
  user's own choice, and the comparison reads it (see below).
- **The first edit that loses a route's original way is asked about.** A way a planner
  calculated is what the route's author meant, and it goes without a sign when a leg
  is routed again: the line moves a little, or a round of 145 km becomes one of 22.
  Refusing such edits would make the route a track; keeping the way silently beside
  every edited route would fill days with tracks nobody asked for. So the edit is
  held and the user asked once for each route (`state/trip.ts`, `edit`): keep the
  original as a track beside the route, which a conversion makes anyway, change
  without it, or leave it. The check is on the edit's result, fewer legs along a
  file's way than before, so every way of editing is covered and an edit that loses
  nothing (a point added at the end, a name) is not asked about. Undo and redo are
  not edits and are not asked about. The answer is kept for the page, not with the
  trip: asked again after a reload is the lesser evil than a column for it.
- **DMD's calculated way is a route's way where Garmin gave none.** DMD's planner
  writes into a route the way it calculated for it as a whole
  (`dmd:PreRendered`, `dmd:CalculatedRoute`; documented at
  docs.dmdnavigation.com/dev/gpx-extension), with turn instructions, surfaces, timings
  and warnings, of which the way alone is read. What is written carries a hash of the
  route's points and the profile, and is used only while that hash is the one of the
  points the route has now: a point moved, added or removed elsewhere makes it stale,
  and the legs are then left to the routing, as for a later version of the format
  (`gpx/dmd.ts`, and `Stash/GpxIndex` for the index). The documentation says the
  coordinates are cut off after six decimals for the hash; the planner's files hash
  them rounded to six, which is what is done: all 978 routes of a club's files verify
  that way, 223 the other. Checking the hash is why reading a GPX file is
  asynchronous: the browser's digest is. A leg belongs to its two ends, so the way is
  cut at the route's points (`gpx/ways.ts`): each point lies where the way first
  comes by it after the point before, within 50 m, since a planner snaps a point to
  the road and a round passes a place twice; in those files no point lay farther than
  30 m from its route's way. Garmin's way comes first where a file has both, which
  846 of those 930 files do: they are BaseCamp routes that DMD's planner calculated
  again, and its way can be far from the author's (one round of 145 km between two
  points is 22 km in DMD's). A leg does not keep which planner its way is from, so a
  trip's row says "Original path" for either. The index of the Stash follows the same
  order for a route's line and length.
- **A via point of Garmin's trip planning is a stop on its route point.** BaseCamp and
  the devices mark each point of a route as a via point, which is announced and counts
  as a destination, or as a shaping point, which only bends the route
  (`trp:ViaPoint`, `trp:ShapingPoint`). The planner has the same two things: a stop
  bound to a route point, and a route point alone. Until now a stop was bound only
  where the file also held a waypoint at the point's position, which such files often
  do and not always. The mark is now read itself. A waypoint at the position still
  wins, since it carries more (address, contact, links), and the via point there makes
  no second stop. The times a via point may carry are not read into the stop: they are
  the dates of the planning session far more often than a plan. The index of the Stash
  names the extension by a chip of its own ("Garmin trip"); it is not part of GPXX,
  which the two other Garmin chips are named after.
- **A route is made a track, not given points along its way.** A route imported with
  the way a planner had calculated keeps that way as its legs, and loses it with the
  first edit of a point, since a leg belongs to its two ends: a round of 262 km
  between two points side by side routed anew is a few hundred metres. Giving such a
  route more points directly would have been a second thinning beside the one a track
  has. Instead a track is made of a route, of its line as it runs, and a route of a
  track by the dialog it had already, which thins it to the points that keep its
  shape. The first step is refused while legs wait for their routing or failed it:
  the track would keep the gaps as straight lines.
- **A conversion makes a new route or track and keeps the one it was made of.** Both
  conversions replaced the route under its id at first. But a conversion is taken to
  try something: a track's shape as a route at one tolerance and another, or a
  planner's way kept as a track before the route is changed. Replacing meant an undo
  to get back and nothing to compare with. The result now stands right after its
  source, in the colour its place gives it, and removing either is the user's step.
  Making a route of free stops still takes the stops: they become its points.
- **A pin outlives the trip it was set in.** The pins were the open trip's and went
  when another was opened, so a route of one trip could not be held against a route of
  another, and a pinned route of a day that was neither shown nor next to it was not
  drawn either. A pin now says "keep this on the map" without a condition. It names
  its trip and keeps a copy of its line, taken when the trip is left
  (`state/pins.ts`, `state/pinnedLines.ts`): the map draws the copy while the trip is
  not open, and the route itself while it is, so the pin has nothing to do then.
  Keeping whole trips loaded for their pins was considered and dropped: it would need
  every loaded document kept in step with what the library does to it on the server,
  for the sake of one line. The copy is as old as the last time its trip was open;
  what the library changes in a trip that is not open does not reach it until then.
  Pins of a deleted trip go with it.
- **What is pinned is listed over the map, and let go of there.** A pin was let go of
  where it was set, on its row, which needs its trip open and its day found: with pins
  of several trips, finding the row again cost more than the pin was worth. A card over
  the map lists every pin by name, trip and day and lets go of each. The names of a
  trip that is not open are a copy, taken with the line when the trip is left, for the
  reason the line is one. The card stands beside the map's controls and moves under the
  search's row where the map is too narrow for both, by a container query on the map's
  frame: the map's width depends on the panes beside it, not on the window. A line on
  the map is still not acted on: lines of several pins lie over each other, the rows of
  a list do not.
- **A recording is compared with what is pinned beside it.** A choice of "the planned
  route" in a list compared with all of the day's routes at once, which said nothing
  where a day has several routes or a route and a track. What is on the map says what
  the user looks at: the recording opened is the one compared, and the one route, track
  or recording pinned beside it the one it is compared with. With more than one pinned
  the comparison stops, since a third line leaves open which two are meant and three
  at once would be too much to read. Comparing is what pinning one thing beside an
  opened recording is for, so the focus turns to the distance from it at once, but only
  where no focus is chosen: one chosen stays for the page, so that going through rides
  in one mode does not throw the mode away at each.
- **A recording's figures are buttons over the map, and cards only on demand.** One card
  held everything at once, the summary, the file's facts, the comparison and the focus,
  and repeated much of it in the chart and the point's popup. Now round buttons stand
  where the place search stands, which is not needed while a ride is studied: the facts,
  hidden at first, and one per focus, whose card holds only the figures that belong to
  it. The point's popup follows the mouse along the line, so that reading the line needs
  no click, and a click pins it, as a click in the chart does, which also moves the map
  to the point.
- **A difference is drawn only where there is one.** Where the other line was not on
  the same way, or had no value, a difference was drawn in the grey of a missing value,
  as loud as the rest, and the speed scale started at 10 km/h either way, so that small
  differences all came out grey. The line is now dimmed where there is nothing to set
  against it, and the speed difference's scale is as wide as its values: whole km/h
  below 10, fives above. A point off the other line for good, whose distance is
  infinite, is dimmed as one without a value. The other recording is dimmed in turn
  where the opened one did not run along it (`Delta.covered`, the stretches of the
  other between the first and last place of each run of the opened one's points on
  it), so that the two lines left bright are the ones compared.
- **A section is looked up on the rides' thinned lines, in the direction it was marked.**
  The question is which rides took this stretch of road, to see when it went well; a
  ride the other way is another road for that purpose (other curves, other gradient),
  so it is left out. Every ride's line as listed (the thinned line the list draws, not
  its track) is checked against the section, resampled every 50 m: a ride is on it
  where it passes within 50 m of the start and then of each sample in order, without
  more than 300 m beyond each, which keeps an out-and-back or a loop that passes
  twice from matching backwards. A line none of whose segments comes into a box around
  the section's start is ruled out before it is measured; the lines are decoded for the
  lookup alone and not kept in the shared cache, which holds the trip's geometries. No
  track is read for the list; only the opened and the compared ride are cut to the
  section (`shownTrack`, which everything that draws, picks or measures a recording
  goes through), and all their figures
  are worked out on that part, since a ride's whole average or top speed says nothing
  about one road. Ranking the list was left out: the comparison of two chosen rides
  answers the question, and the order by date stays readable. The ride compared with
  is the one pinned beside the opened one, as on a day.
- **Rides are on the map by their pins, as recordings are on a day.** Selecting rides
  drew them, in thinned lines, and the comparison of a section took the one other
  ride selected, so that selecting a few to merge or delete redrew the map and changed
  what was compared. Selection now only gathers rides for the menu; a pin puts a ride
  on the map as a recording, with its track read, in a colour of its own, and the
  opened ride is compared with the one pinned, as on a day. The rides' pins are kept
  apart from the open trip's (`pinnedRides`), for the page: a ride belongs to no trip,
  and opening one would otherwise throw them away. The rides suggested for a day are
  held against it on their own (`compareWithDay`), no longer through the selection.
- **A recording has one focus.** The colour of its line and the chart along the bottom
  were chosen apart, with tabs for every chart the file allowed, so that the line could
  show one thing and the chart another. One select, Focus, now picks both: the line is
  coloured by what is focused on and the chart shows it, and with no focus the line has
  the recording's colour and the chart stays away, so that a recording opened for its
  figures covers less of the map.
- **One thing is taken up at a time.** A recording opened stayed open while a route was
  taken up, and two things in focus left unclear which one the cards and the map spoke
  of. Taking up a route closes the recording, opening a recording lets go of the route;
  what is to stay in sight besides is pinned.
- **A route on the map is taken up by a click on it.** With the whole trip or a day
  shown, finding the row of a line seen on the map meant opening days and reading
  names. The line under the pointer is named and drawn wider, by a feature state on the
  source, whose features carry their route's id for it, and a click does what a click
  on its row does. While a route is edited a tap belongs to the tool, so neither
  happens then. Only a mouse points: a tap sends a mouse's move and never its leaving,
  which left the name of the route tapped standing on the map, so the pointer's kind is
  asked and a finger's tap takes the route up without naming it. A collection's routes are not edited; the one clicked is taken up all
  the same. There is one route taken up, and the route being edited is that one while
  the open trip is a trip: every reader of the edited route means that the tools are
  up, and a second place for a collection's route had to be kept in step with the
  first wherever a route is let go.
- **A day that is shown has its place in the tree in view.** A day shown from the
  duplicates report, a search or the address opened in its pane while its trip and
  folders stayed folded, so the pane showed a day the tree gave no place to. The tree
  now unfolds the trip and the folders around it whenever a day comes to be shown, by
  whatever way. A day that closes leaves the tree alone: it may have closed because
  its folder was folded.
- **The duplicates report is made once and kept; what is selected in it is drawn.** On
  a large library the report takes long enough that making it afresh each time it was
  shown, and after every delete, made it unusable for cleaning up: so it is kept in
  the page's state, a delete takes the routes out of it, and a button makes it afresh.
  It is not kept across a reload, where it would outlive what it describes. A click
  used to select with a mouse and open with a finger; it now selects either way and
  the map draws the selection, which is what tells two routes apart. Their lines are
  fetched by id as they are selected rather than sent with the report, which would
  carry every line of hundreds of groups for the few that are looked at, and only the
  lines being compared are kept, a track being megabytes. At most eight are drawn, one
  per colour of the palette. The heading says when the report was made, since what
  changes in the library afterwards does not reach it. A route deleted from the open
  trip is taken out of it as an edit of that trip, saved with it and undone like any
  other, rather than changed on the server behind its back; routes of other trips are
  deleted on the server.
- **A paste empties the clipboard.** A copy used to stay on it to be pasted again, which
  left the library's offer to paste standing after the paste was done, with nothing but
  another copy or cut to take it away. What is on the clipboard is now pasted once,
  copied or cut, in the library and in a trip alike: one rule for the one clipboard.
  A paste the folder refuses is no paste and leaves it as it was.
- **Cut within a trip moves, cut across trips copies and then removes.** Within the open
  trip the parts keep their ids, and with them their journal entries, and the move is
  one undo step. Into another trip the parts are pasted as copies under new ids, the
  open trip is saved, and only then are they taken from the trip they came from: if that
  last step fails they are in both trips, never in neither. The journal of a part that
  left its trip stays behind with the trip. Only the open trip's side can be undone.
- **A drop is a cut and a paste in one move.** Pads had grown onto every row and
  dragged only trips, folders and Stash files, into folders. What a drag may do
  elsewhere needed no new rules: a row is dropped where a cut of it is pasted, within
  the tab, so the drops follow `model/paste.ts` as the menus do. The paste of the
  clipboard runs on any clip handed to it, and what a drag carries is such a clip made
  for the drag (`heldParts`): the clipboard itself is left alone, as a file
  manager's is. A place lights up only where the drop changes something, which also
  means that a cut is no longer pasted onto the day it is on already.
- **A place says what a drop on it does.** The row dragged used to find a marked folder
  under the pointer and move itself there. With days, routes and rows of the library
  as places, the row dragged would have to know how each of them takes it, across
  modules. A place is now an element with a taker for a kind of thing (`ui/carry.ts`,
  `dropTarget`): what a drag holds says its kind, a place for that kind answers with
  the drop or with a refusal, and the nearest such place around the pointer decides.
  The kind keeps the takers typed: a folder is never asked about a clip. A folder's
  row answers for dragged trips, folders and files, the row of a trip or a list and a
  day or a route answer with the paste they offer in their menu. `data-drop-folder`
  stays for files dropped from the computer alone.
- **A grip sorts within its list and carries out of it.** A day and a route were
  dragged to sort them, and now also to another trip or day. Both are one drag: while
  the pointer is over a place outside the row's list that takes it, the list stands
  still and the place is marked; anywhere else the row is sorted as before, also past
  the ends of its list. Places inside the row's own list are passed over, so a
  category dragged among the categories of its list is sorted, not merged into the one
  under it: merging by a slip of the hand was not wanted, and cut and paste, which
  merge, had left categories without a way to be sorted. What is carried is asked for
  only once the pointer moves, since asking lets go of a selection the row is not in,
  and a tap on a pad must add to it.
- **Every pad is drawn as a grip, whether it drags or not.** For a day the pads that
  only select (the routes, tracks, waypoints and media of Stash files, the rides, the
  rows of the search and the duplicates report) were a ring, so that six dots meant a
  row that is dragged. Two marks in one list read as two kinds of row, and a list
  whose marks change from row to row is restless to look at. The six dots are back on
  every pad: that some of them drag nothing is the smaller fault. For the same reason the
  days of a trip that is not open show the dots as well: they had none, so opening
  another trip moved the dots from one trip's days to the other's.
- **A folder is cut, not copied.** Copying or duplicating a folder is a copy of every
  trip in it, at any depth: megabytes started by one click. Trips are copied one by
  one, where the size is in view.
- **What is pasted where is one table.** The paste of a day and a route, of a trip's
  row and a folder, the line above the list and the keys had each grown their own
  answer to what is taken where, and disagreed: the line offered a trip among the
  places, a category offered a route it then dropped, a cut folder was offered to
  itself. `model/paste.ts` now says for each kind of place which kinds of clipboard it
  takes, and what use it has for the routes, tracks, waypoints and media of Stash
  files; a file or a part that holds none of it is not offered there. Every paste entry,
  the lines and the keys ask it, and its test spells the matrix out cell by cell.
  Trips, lists and folders moved among folders are not in it: they follow their trees
  (`library/items.ts`), which needs the folders and not a kind.
- **A list of places takes places alone.** A category is a day underneath, so it took
  whatever a day takes: routes, whole days, media, recordings, all stored and shown,
  left from when collections were planning material. A list and its categories now take
  stops, places, categories and the waypoints of Stash files, and nothing else is
  offered there.
- **A copied category is its places.** As a day it was pasted as a second category of
  the same name in a list that had one, and as an undated day in a trip. Its places now
  go where places go: into the list's category of that name, into the category or onto
  the day it is pasted on, and not onto a trip's row, which has no day for them. Cut
  and pasted onto another category of its list it is merged into that one, as one step
  to undo. For the same reason a place is copied with the name of its category, which
  a paste onto another list's row had lost.
- **A pasted day brings its media and its recordings.** They are not in the trip's
  document, so a day pasted into another trip came without them, and a day cut that way
  lost them: its media were deleted with the day it left behind (see "A day takes its
  media along"). The days a paste makes are saved first and then given the media of the
  days they were copied from, moved for a cut and copied otherwise, and their rides;
  only then is a cut day removed. A day means the same thing copied, cut and moved.
  The journal still stays with the trip.
- **What was cut from the open trip leaves it as an edit.** Pasted onto another trip's
  row, parts cut from the open trip were removed on the server behind its back, which
  left it showing them and saving against an old version. They are now removed as any
  edit of the open trip is, saved with it and undone like it.
- **Nothing is pasted onto what it was cut from.** A cut pasted onto its own trip's row
  or its own category would be copied to where it is and then removed: for places,
  which a list holds only once, that removed them. The entry is not offered there.
- **A folder stays in its tree.** An empty folder could be cut among the trips and
  pasted into the Places or the Stash, since only what a folder holds was checked. It
  then was a folder of that tree, which says the trees are one, and they are not. The
  server compares the tree of the folder with that of its new parent, which also covers
  what the folder holds, and the library's own check does the same.
- **Files of the Stash are cut, to be moved within it.** A folder there had Cut and the
  files in it had only Move… and dragging, so the cut key did nothing on a file. A cut
  file is pasted into a folder of the Stash and nowhere else: out of the Stash things
  are copied, never moved.
- **A folder of the Stash pasted onto a trip adds days, and a file's day has one date.**
  A folder made a trip among the trips and nothing on a trip that was there. Its files,
  and those of the folders in it, now become days of that trip by the rule that makes a
  trip of a folder (`daysOf`). Files pasted onto a trip follow the same rule, where
  they had been planned by their paths as files picked from the computer are: the same
  file gave a dated day among the trips and an undated one in a trip. A day an import
  adds to a trip goes before the first day of a later date instead of at the end.
- **The recordings take tracks copied in the Stash.** It was the one tab that took no
  paste, while a track's row offered Add to recordings. The line above the rides and
  the paste key now do what that entry does, for copied tracks and for copied files by
  the tracks they hold. A track of a trip still does not become a recording.
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
  and not to be taken for a stop of the trip. The icons are bundled as SVG text and
  drawn into map images in the browser when a style first needs one, which every change
  of base map does again: through MapLibre's resolver for missing images, which it waits
  for. Its `styleimagemissing` event comes after the request is answered, too late for
  the first drawing. The same picture stands in the preferences.
- **Badges beyond the store's kinds are a fixed list, not the user's drawings.** The
  categories of a list of one's own are the user's words, and six badges named after
  OpenStreetMap's amenities do not cover what riders collect: ruins, meetups, bunkers,
  trailheads, friends, roads to ride or to avoid. Eight more badges are offered in the
  kind's settings, each an icon of Maki or of Temaki, the set that adds to Maki in the
  same grid, on a colour of its own. They are badges only: nothing is fetched for them
  and they are not kinds of the store (`places.json` stays what the server fetches by).
  A kind keeps the badge's id in the preferences; an id the planner does not know is
  drawn as no choice. Rejected: a free choice of icon and colour per category, which
  needs a picker over hundreds of icons for a handful of uses.
- **One place decides what a tap on the map is.** `Interactions` filters clicks into taps
  and gives a tap that does no tool's work to the popups of the places and the closures
  first, then to the recording's line: one popup opens, any other closes. A popup listening
  to the map's clicks itself would open on the click that ends a pan or closes a menu.
- **Where the user is lives in the address's fragment.** The folder shown, the open trip,
  its day, the route being edited, the day whose contents have their pane (`detail`)
  and the trip looked at (`look`, `lookday`) are written there as they change, and read when the
  page loads. Which panes are folded is not there but kept per browser: it goes with
  the screen, not with the place; the map keeps its view beside them (`map=`, MapLibre's own option). The
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
- **The distance to the nearest line starts at the device, once, and is dragged from there.**
  It answers whether what the map shows is within reach, for which the distance as
  the crow flies is enough. The device's position is read once when the line is
  switched on, not followed: the question is asked while looking through routes, not
  while riding, and a mark that may be dragged asks the same of any other place, a
  hotel or a ferry port, without a second tool. Switching it off and on is the way
  back to the device, so nothing is kept. It does not use the locate-me control,
  whose dot is the map's and cannot be dragged. A device that does not say where it
  is gets the mark in the middle of the map rather than an error, since dragging is
  half of what the line is for.
- **What the map measures against is what it draws.** The lines come from five sources
  fed by components that each make their features for themselves. Deriving the lines
  a second time from the state would have to repeat every rule of what is shown
  (the day selected, the look, pins, the tab the map follows); reading them back from
  MapLibre is a round trip through its worker for every change. So every line source
  is drawn through `drawFeatures` (`map/drawnLines.ts`), which hands the features to
  the map and keeps their lines by source: what is measured is what is on the map by
  construction, and a new line source counts once it is drawn that way. The nearest
  place is found in a flat map true at the mark's latitude, to the degree
  (`geo/reach.ts`): the lines are prepared once for it and asked again for every
  place the mark is dragged over, where preparing them for each took tens of
  milliseconds on a large trip. The map is off by a few percent in choosing between
  places hundreds of kilometres away; the distance shown is the great circle's to
  the place chosen.
- **The distance is a marker, not a label of the style.** A symbol layer would place
  the text along the line by itself, but the raster base maps come without glyphs,
  and no other text of the planner is drawn by the style. The label is a marker put
  on the middle of the line's part in view, placed anew as the map moves.
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
  The code says `t('Search rides')`; `frontend/i18n/de.json` maps that English
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
- **The journal is written in three places, each as large as what is done there.** One
  window listed a part's entries and took new ones; read as a document, the journal
  needs more room than a window and less ceremony than a document editor for a line
  written at a fuel stop. A new entry is a slim window over the map, opened on a route,
  a track or a stop from its row or at a spot from the map's menu: a text, files, Add.
  It is shown without modality, dragged by its title and kept whole on the page, since
  it is written against the map. A day's journal takes the place of the day's contents
  in their pane, switched by the notebook in the pane's head and opened by the one on
  the day's row: every entry of the chapter as a row, put in order by its grip, written
  in place, linked and placed from its menu. The whole trip's journal lies over the
  page with every chapter under the other, where a row is also dragged from one
  chapter into another. The three share one component for a chapter
  (`trip/JournalEditor.tsx`); the window is the only one that adds without showing.
- **The preview is the page.** Beside the whole trip's journal stands the trip's page as
  a visitor gets it, in a frame: the same template and bundle as the shared page, fed
  with the trip's public form from an API of the owner's and with the journal whether
  it is published or not, since the journal is looked at before it is. A second
  rendering of the journal inside the planner would have been a second thing to keep
  like the page, and the first to differ from it. The planner tells the read-only
  pages of the browser which trip changed, on a BroadcastChannel. The word is sent
  where the write is made, in `api.ts`, for every write to a trip, its journal and
  what its page shows, so that a new kind of write cannot forget it; a page that hears
  its own trip named reads the trip and the journal again, once for what is written in
  quick succession. The same word reaches a page in
  a window of its own, which is the preview where there is no room for it beside the
  journal. What the page shows to whom (the link, the journal, the GPX file, the cover)
  is set above the two; the dialog that shared a trip is gone.
- **The open trip's own actions are in the head of its pane.** They were in the menu of
  the trip's row in the library and in the menu of the pane's free space. Below 1200 px
  one pane is shown, the trip's own, so the row is not there; and a screen that is
  touched has no right-click for the free space. On a tablet the trip's journal, its
  export and its dialog could not be reached at all. The pane's head has the notebook
  for the journal, on every screen, since that is where one looks for it after the
  notebook of a day; and where there is no right-click, the button for a menu with the
  rest.
- **The journal is made for fingers where it is touched.** A row carried to another
  chapter lets the pointer through to what lies under it, as the rows of the days do,
  or the chapter under the finger is never found. The switches and buttons are forty
  pixels high where the screen says it has no hover. On a narrow screen the settings of
  the page scroll away with the journal under a head that stays, since they would take
  a fifth of a phone. The window of a new entry stands at the top of a touched screen:
  centred, its buttons lie under the keyboard.
- **An entry's text is saved while it is written.** A row's text is a field, not a text
  with an edit button: it is saved a moment after the last key and when it is left, and
  what the server holds is taken into the field only while it is not being written in.
  The change is made here before the server answers, so that the field never jumps
  back; what the server refuses is read again. An explicit save per row was a click for
  every caption of forty photos.
- **Files go into the journal one after the other, in the background.** A photo is made
  into a JPEG in the browser before it is sent, which takes a second or two each, and
  twenty photos picked at once blocked the window they were picked in. They are queued
  (`state/uploads.ts`), each an entry of its own, made in the order given; the page
  says how many are on their way and keeps what failed to be tried again, and asks
  before it is left while some wait. A text and one file are one entry, the text the
  photo's caption; a text and several files are the text and then the files, which
  read as a gallery.
- **The trip is saved before the journal is written to.** An entry names a day, a route
  or a stop by its id, and the server answers 404 for one it has not been sent yet: a
  stop added and written about within the second and a half before the autosave. Every
  write that names a part waits for a save under way and sends what is unsaved first.
  The other way round, a save that takes a part off the trip makes the server link the
  entries on it anew, so the journal is read again after one.
- **A marker is the handle of an entry's place.** An entry stands where its marker is
  dragged to; one without a place is put in the middle of the map from its menu and
  dragged from there. A mode in which the next click on the map sets the place was the
  alternative, and one more state the map's tools would have had to know about.
- **An entry outlives its part.** A photo on a stop stays in the journal when the stop
  is removed: the journal is the record of the trip, and a removed stop is still where
  the photo was taken. The first draft cascaded the deletion; a stop moved in a
  reorganisation would have taken its photos with it. An entry whose route or stop goes
  is linked to their day, so that it stays in its chapter; before the journal had
  chapters it fell back to the trip, which would now move it to the introduction. One
  whose day goes has no chapter left and stays with the trip.
- **The journal is ordered within its chapters.** The journal reads as the trip's own
  entries and then a chapter for each day, in the days' order, with the entries on the
  day, its routes and its stops. The chapter follows from what an entry is linked to and
  is not stored, so a route moved to another day takes its entries along. `position`
  orders the entries within a chapter and is read with the id as a tie-break. A new
  entry gets a position after every entry of the trip, which is after every entry of
  whichever chapter it lands in, and one query. A reorder numbers the ids it is given
  from zero and leaves the other chapters alone; positions are only compared within a
  chapter, so their being unique across the trip is not needed. An entry dragged into
  another chapter is linked to that day, or to the trip, and loses its route or stop,
  since those belong to the chapter it left. A merge adds each trip's entries after
  those the trip has by then.
- **Where a photo was taken and where it stands are two things.** `taken_lng` and
  `taken_lat` are the camera's position and never change; `lng` and `lat` are where the
  entry is on the map. They start equal. The user may put a photo elsewhere (one without
  a position, or one taken at home that belongs to a place on the route) or take it off
  the map, which is `lng` and `lat` null. Reading the stored file again to put a photo
  back was the alternative and needed no columns, but then the client could not tell
  whether a photo has a place of its own, and would have to offer "where it was taken"
  for photos where it can never work.
- **Photos are placed by their EXIF data on the server.** The server reads the time the
  camera wrote (local, without a zone) and the GPS position from the upload before the
  entry is written, since it has the file anyway and the browser would need a parser of
  its own; the entry is one insert, placed as it is stored. A photo added
  to the trip itself goes to the day of its date where the client asks for that
  (`byDate`), which the journal does and the import of an archive does not: there the
  entry was on the trip when it was exported, perhaps put there by hand. One added to a
  day, a stop or a route stays where the user put it. The position places it on the map; nothing is matched
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
  lies outside the web root.
- **An image is kept at three sizes, and a visitor gets those alone.** A photo is shown
  in a list, in the column of a page and large over the page, so beside its file lie
  JPEGs of 400, 1280 and 2048 px on the longer side, never larger than the image, made
  with GD. They are made when the file is uploaded, from one decoding of it, so that
  the first reader of a page of photos does not wait for forty of them; one that is
  missing, as for photos uploaded before, is made on first request with every other
  size the photo lacks, from the one decoding, and written beside and renamed, since
  two requests may ask for it at once. An image of more than twenty
  million pixels is not decoded, GD holding four bytes for each, and is offered as a
  file instead.
  A photo's file carries what the camera wrote into it: the position, the device, an
  embedded thumbnail, and it went to anyone with the share link. The shared API now
  gives out the made pictures and no image's file. A picture made by GD has no
  metadata at all, whatever the format of the file and whatever a camera invents next.
  Rejected: removing the EXIF, XMP and IPTC segments from the JPEG as it is served,
  which keeps the upload's exact pixels but is a list of what to remove, per format,
  that has to be complete; and the upload is itself a re-encoding made in the browser,
  so there are no original pixels to keep. The planner shows the same pictures, so
  that what the owner sees is what a visitor gets; the file itself leaves with the
  export of the trip.
- **A file's address changes with the file.** The browser may keep a file a day, and
  SQLite gives the id of an entry that was deleted last to the next one, so a new
  photo could show as the one deleted before it. The address carries the file's size
  and the time of the entry as a query the server ignores.
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
  trip. The page prints: the map keeps its drawing buffer, the controls are hidden.
- **The page is a plan until it has a journal, then a story.** Which of the two it is
  follows from whether there are entries to read: a visitor gets none until the
  journal is published, so the same rule serves the shared page, the owner's own and
  the preview. The plan is the head, the map and the days as cards. The story is the
  journal as a document in a column of a readable measure, with the map beside it,
  which stays while the text is read; without room for both, the map is a band above
  the text: below 900 pixels of width, and below 1200 in a window taller than wide,
  where a third of the width is a strip too narrow to show a day and the height has
  room to spare. The band is three hundred pixels or three tenths of the height,
  whichever is more. The design was settled on a mock first (prose and headings in Newsreader,
  labels and figures in the system's sans, the planner's accent, the visitor's light or
  dark scheme). The typeface is bundled, not fetched from a font service: a visitor's
  browser talks to nobody but this server and the map's, and YouTube's where the
  journal has a video.
- **The map follows the reading, not the scrolling.** The elements that can be read (the
  head, a chapter, an entry that stands somewhere) name themselves; an
  IntersectionObserver with a band across the upper half of the window says which are
  in it, and the lowest of them is the one read, so a photo inside a chapter wins over
  its chapter while it is there. The map moves once the reading has stayed a fifth of
  a second, stopping a move under way, to an area reckoned once per day; with reduced
  motion it jumps. A scroll handler that maps the scroll position to the map was the
  alternative: it runs on every frame and has to know the layout. The end of the page
  is where the band alone fails: a last day with little or nothing written never
  comes up to the upper half, since the page scrolls no further, and was never read.
  So over the last of the scrolling the line that is read at goes down from the band
  to the foot of the window, and there the scrolling is listened to and the elements
  are asked where they are; a page little longer than the window does so over all of
  its scrolling. What is gone to by the card or a marker stays the one read until the
  reader moves the page, or the line at the foot would take a jump to the day before
  the last straight to the last. Only the stops and
  entries of the day read have markers, so a trip of four hundred photos puts a dozen
  on the map at a time. A place is shown above the map's card by an offset, not by a
  padding: MapLibre keeps a padding given to a move and adds it to the next one.
- **The story's map flies, and names its stops beside them.** Going from day to day was
  a pan seen from above with every stop's name glued to its pin, names on names where
  stops are close. A day is now flown to and seen at a tilt, turned off north by up
  to thirty degrees where that fills the map better (sixty where the map is a band
  much wider than high), and an entry's place closer and steeper; the whole trip, a
  printed page and a reader who asked for less motion get the map from above, the
  latter two at once. The flight takes longer the farther it goes, within bounds.
  What is shown is fitted as the map is turned (`geo/frame.ts`): MapLibre fits the
  box of longitudes and latitudes and turns that, which leaves a day that runs aslant
  small in the middle. The names are not MapLibre's markers but an overlay set once
  the map rests (`view/callouts.ts`, pure and tested): each a little off its stop on
  the first of eight sides where it lies on no other name, on no pin and not under
  the button to the whole trip, with a line to the pin; a stop without such a side
  keeps its pin and gets no name, and a small map names few. While the map moves
  there are no names, so they need no reckoning per frame, and they come in one after
  the other when it is there. The planner's map keeps the names at the pins: there
  they are read while the map is dragged.
- **Where the page scrolls over the map, one finger scrolls the page.** A map takes a
  drag for itself. On a phone the story's map is a band at the top of the window, and
  a thumb that lands on it moved the map and the page stood still; the plan's map lies
  in the page's flow on every screen, and the wheel over it zoomed the map. MapLibre's
  cooperative gestures are switched on for both: one finger and the wheel scroll the
  page, two fingers or the wheel with Ctrl move the map, and the map says so. Beside
  the text the map is a pane of its own and keeps the drag. What fits the map leaves
  room for the card at its foot as tall as the card is, and an eighth of the map at
  the edges, so that a band of three hundred pixels does not shrink a trip to a dot.
- **A file in the database is bound as a blob.** The Stash's GPX files are gzip and
  were written through `execute()` with the other values, which binds a string as
  text. SQLite keeps the bytes either way and the planner read them back whole, so
  nothing showed; but text ends at its first zero byte for whatever treats it as
  text (`length()`, a dump of the database), and a restore from such a dump would
  have held three bytes of every file. They are bound as `PDO::PARAM_LOB` now, as
  the rides, the media and the cards were, and a test asks the column for its type.
- **A fetch of places notes the kinds it asked for and keeps no others.** An answer
  for one kind holds places that are of another kind first, a hotel that is a
  restaurant; counted and kept, they overwrote that other kind's note with a count
  of one or two. Such places are left to their own kind's fetch.
- **The folders at the top of a tree are in the order they are put in; all others by
  name.** A handful of top folders are the user's own table of contents, which the
  alphabet orders badly ("Unsere Touren" under "NEW"); below them the names are
  dates and places, which it orders well, and an order kept by hand for hundreds of
  rows would be work without use. The order is a list of folder ids in the account's
  preferences, not a column of `folders`: it is how one user arranges a view, it
  needs no change to a table, and an id of a folder deleted since counts for nothing
  while a folder made since comes after those named, by name. One list serves the
  three trees, whose folders it cannot confuse. A top folder has the grip that sorts
  in the place of the pad: it selects by a tap and is dragged into a folder as
  before, and to another place among its neighbours as well.
- **Tags are made first and then put on trips.** A tag typed freely on a trip gives
  three spellings of the same thing and no place for its colour. Tags are rows of
  their own (`tags`, once per user by name whatever the case) and `trip_tags` says
  which trips have them, so renaming or recolouring one changes it everywhere and
  deleting one takes it off its trips by the foreign key. The list of trips carries
  the ids, and the browser reads the tags once: chips, menu and the limiting are
  then all done there. Limiting to several tags means having all of them, since a
  second tag is pressed to narrow. Limited to tags, the trips are listed flat as a
  search lists them, because a tree of mostly empty folders hides what was asked
  for. The limiting is done before the search, not in it: the trips with the tags
  are what the search is given, so the search knows nothing of it but the names of
  the tags on a trip; all of them are listed, where a search lists its first twenty,
  and a folder that is shown ends the limiting as it ends a search. A tag put on a
  trip lists the trips afresh without their outlines, which a tag does not change.
  A copy of a trip starts without tags.
- **The card of a shared link is drawn in the owner's browser.** A link posted
  somewhere is shown with a picture, which the place it is posted at fetches without
  running the page. A tilted map of the routes cannot be drawn by PHP, and a browser
  on the server is not something an OpenBSD box with a chrooted php-fpm should run.
  So the owner's browser draws it, on a map of its own that is never seen (Positron
  without its symbol layers, the routes in the page's accent, a dot where a day
  begins and ends), puts the name and the places under it on a canvas, and uploads
  a JPEG, which the server checks for its kind and size and keeps in `trip_cards`.
  The bearing is the one of every fifth degree at which the lines' extent comes
  nearest to the picture's shape, counted with the tilt; since a fit reckons without
  the tilt, the map is then moved until the projected lines fill their box. The
  places are asked of Nominatim for each day's first and last point, one within
  three kilometres of one asked before taking its name. The card carries a mark of
  the name and the lines it shows; the page settings make it anew where the mark is
  another, so a trip changed without opening them keeps its card until then, which
  was accepted over rendering on every save. A card is made once its mark has stayed
  for two seconds, since a name is typed letter by letter, and one that could not be
  made is not tried again until it would show something else. The card's address
  names the mark, so it is cached for good and a changed card is fetched anew. The attribution of the map is written
  into the picture.
- **A video is a text that is a YouTube address.** The journal keeps no video files:
  they are large, and a rider's videos are on YouTube already. An entry whose first
  line is such an address and nothing else is read as a video, the lines after it as
  its caption; this is decided where the entries are read as blocks, so the server,
  the schema and the editor know nothing of it, and the address stays a link wherever
  else the text is shown. The owner chose that the players load and start by
  themselves over a placeholder that asks first: the one video that is at least six
  tenths in the window plays, the uppermost of several, and stops when it is left.
  A video that starts by itself has no sound, which browsers require. The players come
  from youtube-nocookie.com and take their commands as messages, without YouTube's
  script in the page; they are sent the page's origin as the referrer, which YouTube
  requires, and not its address, which holds the share's token. A printed page has
  the link.
- **Photos that follow each other are a gallery.** The journal has no gallery to make:
  an entry is one photo, and what stands between two photos is a text. One photo is
  set as wide as the text at its own shape, an upright one at half that width, which as wide as the text fills the window, two side by side, more in rows of three
  cropped to one shape; their sizes are known from the entry, so the page does not
  jump while they load, and the browser picks one of the three kept sizes by the width
  it is shown at. The lightbox steps through the gallery it was opened in, and a click on the photo
  closes it, as the click on it opened it. It has no link to the file: that is for a
  document, which the lightbox only frames. The frame opens once the small version
  of the photo has loaded, which says what shape it has: opened before, it was the
  small version's size and grew when the large one came. It fades in and out by the
  dialog's own transitions (`@starting-style`, `allow-discrete`), which is why what
  it holds is kept after it is closed; a browser without them shows it at once. What belongs to a photo stands on it, each
  on the dimmed ground the pin of a gallery's photo has: the caption at the top left
  in the page's own type, the way out at the top right, the steps at the sides. A
  photo without a caption has none there; in the planner, where a file is known by
  its name, the name stands in its place. A document keeps a bar under it, since
  what stood on it would cover the viewer's own controls. A caption
  stands under its photo and the way to the map is a pin on the photo: collected under
  the gallery, captions could not be told to their photos, and the one button there
  showed the first photo's place alone. What is read is still the gallery as a whole,
  by its first photo with a place: a mark for each photo would send the map on a
  flight for every row scrolled past.
- **The trip's page shows the land.** Its map starts on satellite imagery, with the
  ground raised and a sky over it (`RELIEF` in `map/baseMaps.ts`, set into every style
  the page loads by `newBaseMap`'s `relief`): a story of a ride is about the country
  it went through, which a road map tilted flat does not show. The planner's map
  stays flat, where places are put by hand and a raised ground moves what is clicked.
  The elevation comes from the AWS Terrain Tiles: open data, no key, fetched by the
  browser as the map tiles are. The page keeps its choice of base map under a
  preference of its own (`ownBaseMapChoice`), so that neither the page's start on
  satellite nor a visitor's choice there changes the planner's map in the same browser.
  A place is seen steeper than before, at 72 degrees, which is where the horizon
  comes into the picture.
- **The trip's map fetches ahead through the browser's cache.** With satellite
  pictures and raised ground a flight ended over ground not yet drawn. MapLibre has
  no way to load a view it is not showing, so the page asks for the tiles itself
  (`view/preload.ts`): the browser keeps them, and the map's own request for the same
  address is then answered from there. This holds for sources whose tiles have plain
  addresses and are kept by the browser, which the pictures and the heights are; a
  vector style is left alone. Only what comes next in reading order is fetched, two
  places and the next day, a few requests at a time and at low priority: every place
  of a long trip at once is thousands of requests per reader, and the bulk fetching
  the tile servers' terms forbid. A second, hidden map that visits the places would
  ask for exactly the right tiles, at the price of a second WebGL context decoding
  every tile twice on the phone the flights are to be smooth on. Which tiles a tilted
  view draws is therefore reckoned (`tilesInView` in `geo/tiles.ts`): the level the
  place is seen at over the view, a few of four coarser levels around it, and for a
  steep view two finer levels toward the ground at the view's foot and past it.
  The levels and where the finer ones lie were measured against what MapLibre 6
  asks for at the page's pitches (about four tiles in five were fetched ahead), not
  derived from its code: after a change of the pitches or of MapLibre's level of
  detail they are to be measured again.
- **All photos on the map are read once, and only looked at.** With the switch on, the
  planner asks for every photo of the user's journals that has a place
  (`GET /api/photos`) and reads them again when another trip is opened, since the one
  left may have been written to; the open trip's are taken from its own journal, which
  is current. They open large and are not dragged: a photo is put somewhere in its
  day, where what it belongs to is in view. They are markers like the day's, which
  holds for the hundreds of photos a library has; thousands would want a layer drawn
  by the map with clusters.
- **Interface texts follow the conventions of software, not of prose.** The texts of
  the journal, the publication and the later features had been written as sentences
  that describe ("Share the page under a link", "Put where it was taken", "No cover: a
  photo is made the cover from its menu"). They are now short labels that name the
  action and rely on their place for the rest, and explanations in panes are gone or
  moved into tooltips; the rules are in CLAUDE.md under Language. The publication's
  three settings became buttons that name what a click does, since a checkbox needs a
  label that describes a state and those were the long ones. A list of places has
  "categories" throughout, which some texts still called sections; the way a file
  calculated for a route is its "path".
- **A day pasted into a folder becomes a trip.** A folder of the trips takes days
  (`model/paste.ts`): each is made a trip of that one day under the day's name, with
  what a day brings to another trip, its media and the rides it is on. The journal
  stays where it was written, as it does when days are pasted onto a trip. It is
  offered in the folder's menu and not by the key: with a trip open, Ctrl+V of a day
  means the day after the one picked, and the library's keys would take it first.
- **A file's name is not shown to a visitor.** A photo's marker and its lightbox are
  called by the entry's text, or "Photo": the name a camera or a screenshot gave a
  file says nothing to a reader and may say what the owner did not mean to publish.
- **A click that goes nowhere still answers.** Going to an entry whose place the map
  already shows changed nothing to see. Each going is counted (`gone` in
  `view/follow.ts`), and the ring's marker is made anew with one stronger ring for it.
- **A video has the page's controls, not YouTube's.** The player's own bar brings a
  row of buttons, the channel and more videos over the picture whenever the pointer
  is on it. It is switched off (`controls=0`), and the page draws play, the position,
  the sound and the whole screen under the picture from what the player says of
  itself in its messages; the sound has to be there, since a video that starts by
  itself starts without. Volume, captions and quality are given up for it; the link
  to YouTube has them. What stays is what YouTube lets nobody remove: the title
  before a video plays and while it is paused, and its channel's other videos then.
  Nothing of the page lies over the picture, which YouTube's terms forbid. The whole
  screen is the player and the page's bar together, so the bar is there too; an
  iPhone, which gives no element the whole screen, has no such button.
- **Markdown is rendered by micromark, with nothing that runs.** An entry's text is set
  into the page as HTML, so what makes it has to be trusted with a stranger's input,
  the preview being the owner's but the page everyone's. micromark escapes HTML unless
  told otherwise and follows no link that would run something; images are switched off,
  since the journal's pictures are its entries and a picture from elsewhere would tell
  that elsewhere who reads the page; an indented line is a line, not code. A text
  written before the journal took Markdown keeps its line ends.
- **The page prints what is folded and the trip whole.** Before the browser prints, the
  folded plans of the days are opened and the map goes to the whole trip at once and is
  drawn again, since what is printed of the map is what was drawn last.
- **A shared trip is its plan; the journal is published apart.** The share link showed
  the journal the moment it existed, so a trip shared before the ride to plan it with
  others published every photo taken on it. The page has two uses, the plan before
  the ride and the story after it, and the owner says when the second begins:
  `journal_published` on the trip, off for a trip shared from now on, set for the trips
  that were shared when it was introduced, so that nothing public disappeared.
  Publishing is all or nothing; an entry that should not be read is not written into
  the journal. The GPX file is offered unless switched off (`gpx_public`), since a plan
  shared to be ridden is of little use without it. The cover is a photo of the journal
  that the page shows at its top and a link's preview uses; it is readable while the
  journal is not, as the one exception, because a plan is shared with a picture too.
- **What a visitor gets is made in one place.** The shared API answered with the
  owner's document, so a stop's contact (a host's name and number) and its booking
  reference went to anyone with the link. `Share/PublicTrip` makes the public form of
  the document and of an entry, and the shared GPX file is written from that form, so
  that a field added to a stop is private until it is let through there: of a stop and
  of an entry it passes on the fields it lists and nothing else. An entry
  goes out without where its photo was taken, which the owner may have moved it away
  from on purpose. The owner's own page keeps everything: it is the roadbook.
- **A GPX file of the page holds one line.** A file with several routes or tracks is
  what the planner's own export writes for a day or a trip, and what most navigation
  devices and apps make a mess of: they take a file to be one line and one ride, and
  show the first, or all of them joined. So the page offers each route and track as a
  file of its own, named after its day, and after the route too where the day has
  others; there is no file of the day and none of the trip. The file is written by the
  export when it is asked for, from the trip's public form and with the export's
  defaults (the full line as a track, the stops bound to it or within reach), so it is
  never older than the trip. Writing the files when the page is published was the
  alternative: stored copies to renew with every change of a route.
- **Which routes the page has is picked route by route, and is not the trip's.** A day
  in the planner holds more than the ride: the way round for bad weather, a track
  taken from someone's file to plan against. Each route and track has a switch in what
  the page shows; one left out is not in the trip's public form at all, so it is on
  neither the map nor the files, counts in no distance, and takes the stops bound to
  its points with it, which would otherwise stand on the page without their route. A
  free stop stays. The switch is a column on the route that the trip's document does
  not carry: a save writes the columns it names and leaves this one, a new route is on
  the page, and undo in the planner does not reach what the page shows. The route's
  own `optional` was not used for it: that says what is decided on the day of riding,
  and an optional detour may well be one to show.
- **The routes a page leaves out have an index of their own.** Which routes are left
  out is asked with every look at a shared trip, and the column lies behind each
  route's line, so the question read through all of them. A partial index on the
  routes that are left out answers it; it is empty for most trips. The save that
  takes routes or stops off a trip reads which they are first and touches the journal
  only then, since the entries have no index by their route or stop and most saves
  remove nothing.
- **The shared page is headed on the server.** A link pasted into a messenger is
  fetched by a program that runs no script, so the page's title, description and
  cover picture are written into the template from the trip, and an unknown token is
  answered 404 instead of a page that then fails to load. The page asks not to be
  indexed: a share link is for whom it is sent to.
- **The shared API has no session.** PHP's file sessions lock, so the requests of one
  browser wait for each other, and a page of photos loaded them one by one. A visitor
  has nothing in a session; the middleware leaves the shared API out.
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
  day's recordings only once they are shown. The days a ride is on are copied with
  their trip and follow a day that joins another in a merge.
- **A recording is a document of what happened, and only a recorded file becomes one.**
  The plan lives among a day's routes, as routes or tracks, which are lines to edit; the
  ride lives among its recordings, each the file its tracker wrote, never changed, with
  whatever it measured. The folder for recordings first turned what was dropped on it
  into tracks, as every other import does, which kept the line and dropped the times,
  the speed and the lean angle, and a copied track could be pasted as a recording, which
  wrote a file of positions alone. Both made recordings that had nothing to compare.
  Files are now kept as they are, and a track no longer becomes a recording. The other
  way stays: a recording pasted among the routes is a copy to plan from.
- **What a recording's file tells is kept beside it.** Its line thinned to 10 m, its
  length, its first point's time and the file's digest are read once, on the server,
  when the file is added, with a reader that streams the file (XMLReader): a
  recording is megabytes, a library holds hundreds, and listing them, finding those
  that match a day and knowing a file again must not unpack them all. The browser
  still reads the file itself for the map and the figures. The digest is what keeps a
  file once: a tracker's folder is dropped on the rides again and again as it grows,
  and what is kept already is left out; a file added to a day that is kept already is
  put on the day as the ride it is.
- **A day of riding is looked up for a day by its date or by its lines, a part of the
  day being enough.** The same ride kept twice (see the duplicates) is the same from end
  to end; the riding of a day need not be: it may have been stopped at lunch and started
  again, or run from the door to the door around the plan. So it is found where four
  fifths of its points, taken along its files by their length, lie within 75 m of the
  day's routes and the files together are at least a quarter as long as the routes, or
  where four fifths of the routes' points lie within 75 m of one of its files. A day
  that left the plan for longer is found by the day's date alone, taken on the user's
  clock, since a file's times are UTC. The lookup goes through all the user's rides,
  whatever days they are on already, since a ride may follow more than one plan; the
  same road in other years is found as well and told apart by the date each row
  shows. The choice is the user's. What is on the day already counts toward its day
  of riding and is not listed again. The lookup compares against the day as saved, so
  the trip is saved first.
- **A recording's figures are worked out in the browser from its file.** The speed is the
  file's own (metres per second in GPX and in Ridelink's extension), else distance over
  time across two points to either side; the slope is measured over 100 m around a point,
  so that a few metres of height noise do not read as a wall; climb and descent count a
  change once it exceeds 3 m from the last turning point. Moving is where the speed at
  both ends of a stretch averages above 3 km/h and the stretch itself, in the time it
  took, comes to more than 3 km/h; the average speed is the distance
  moving over the time moving, both over stretches that took time: a file whose
  timestamps repeat would otherwise divide the whole distance by a few seconds. The
  second test is there for trackers that write no points while standing, as Ridelink
  does: a stop is then a gap between two points at speed, which the speeds at its ends
  alone took for riding. Over 156 of Ridelink's rides, 355 hours from first to last
  point, that had counted 340 hours as moving, 142 of them in gaps of more than half a
  minute; it is 193 hours with the test. The speeds at the ends stay in the rule for
  the trackers that do write points while standing, whose positions wander. Ridelink's
  own summary in its files (`rl:summary`) was held against these figures: its lowest and highest speed are
  those of the points, as ours are; its distance is 0.14 % below ours at the median,
  ours being the length along the points; its duration is the session's, which may
  begin before the first point and end after the last, where ours is the time between
  them; and its average speed is the mean of the points' speeds, which are written at
  uneven intervals, so it is neither the average while moving nor that of the ride and
  nothing to hold ours against. Heights
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
  schema is `db/schema.sql`; while nothing is released, a changed table recreates the
  database (`make recreate`, which also empties the file store, since `CREATE TABLE IF
  NOT EXISTS` adds tables but never columns), or, once the data is worth keeping, a
  one-shot script in `bin/` changes it and is deleted after it has run, so that no
  migration code stays. Migrations start with the first release.
- **The library's pane has one frame.** The library's actions as icons and the search
  on top, then the tree; the actions of days, routes and recordings are icons on their
  own headers. The open trip's name with its actions as icons stood between the tabs
  and the tree, far from its row once a long list was scrolled, and repeated a close
  that the day's pane has itself; the actions are now in the open trip's row's menu,
  where every other trip's are, and its row says whether it is saved.
  They were buttons that pushed the panel wide. The path heading and the card that led
  one level up went with the explorer that showed one level at a time: in a tree the
  place is where the row stands.
- **The duplicates report takes the pane beside the library, not the library's place.**
  It stood where the tree stands, so looking at a route it listed meant leaving the
  report, and the trip had to be left to show it. In the pane between the library and
  the map the tree stays, and the map draws what is selected in the report beside it.
  It shares the pane with the open trip: the report has it while it is switched on,
  and a pad that opens a pane takes it back. The pane's frame (its head with the pads
  that fold and close it, its strip, the edge that sets its width, the handle that
  makes it a sheet on a phone) is one component for every pane (`ui/Pane.tsx`).
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
- **The build installs npm's packages only when the lock file changed.** `npm ci` deletes
  and unpacks every package on each deploy, a third of the build's time on the server
  for nothing where the lock is as it was. `make` compares `package-lock.json` with the
  lock npm writes into `node_modules`. The Vite build itself has no switch to turn on:
  measured, its time is Rollup's tree-shaking and the Solid transform, each on one
  thread; minifying, the size report and bundling libheif as a file instead made no
  difference, and `make -j` only runs targets side by side, of which there is one.
  MapLibre is two fifths of it, and keeping it out of the bundle is not worth a second
  way of loading it.
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
