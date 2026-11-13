# Core features

## Available

- Accounts: sign-up from the landing page by a link mailed to the address, or, with
  `open_signup` off, a waiting list there and invitations by mail from an admin page or
  the command line; sign-in that lasts 30 days from the last visit, sign-out, password
  reset by mail. `make user EMAIL=…` makes
  an account without an invitation and prints a generated password; at the first
  sign-in the user has to replace it before the planner opens.
- The library is a tree: under "All trips" the folders and trips as rows, each unfolding
  in place by a click on it, a folder to its folders and trips, a trip to its days, as
  many at once as wanted; what is unfolded is kept per browser. The tree has one mark,
  on the row clicked last: a folder, a trip or a day. A click on a folder marks it,
  which makes it the one new trips, imports and pasted ones go into, and unfolds it;
  marked and unfolded already, it folds. A trip is a folder of days and answers the
  same way: a click marks it and unfolds it, which opens a trip that was not open. A
  click on a day marks the day and shows it in its pane. A click on the trip then gives
  the mark back to the trip and closes the day; the next click folds the trip, the one
  after unfolds it again. A click on the day that is shown changes nothing but the
  mark, which it takes back from a folder; a day is closed by its pane's button or by
  a click on its trip. What folds takes what it holds with it: a folder its
  folders and trips, a trip its day, a day the lists of its routes. The marked row is
  tinted, and a coloured strip runs down the left of it and of what is open besides:
  the folders around the mark, its trip and the top, and the open trip and its day
  while the mark is elsewhere. A click on a day of any trip
  opens that trip at the day. A trip's days are listed only while it is unfolded, the
  open trip's like any other's: opening one trip folds no other. A day reads the same in every trip, open or not: its number
  and name over its date and length, a collection's section over what it holds; the
  open trip's days have in addition the grip that reorders them, their recordings and
  their journal. The days stand under their trip without a heading; a trip without days
  says so. The button on "All trips" folds every
  folder and trip away.
  The open trip stays in the tree, the others around it, so that another trip is one
  click away. Above the tree stand the library's two switches as icons (the duplicates
  report, the places on the map), the search, and
  the open trip's name with its own icons (edit, export, journal, print and share,
  whether it is saved, and a button that closes the trip, saved, and leaves the map
  empty).
- A library of the user's trips in folders, which may hold folders: create, open, rename,
  duplicate and delete trips, create, rename and delete folders (for a folder that holds
  anything the confirmation asks whether that moves up into its parent or is deleted with it), move a trip between folders from Move… in its menu, create a trip or a folder
  from New in the menu of the folder it goes into. Trips and folders are dragged by their pad into a folder to move them there: onto its
  row or onto anything it holds while unfolded, the folder lighting up; anywhere else in
  the library's pane, "All trips" lights up and the drop goes to the top; selected trips go together, and a
  folder never goes into itself. Folders and trips are cards with the name over a line
  of metadata, each with the icon of its kind: a folder, a trip, a collection of planning
  material; a trip's card also shows its shape, small, each line in the colour its route
  has on the map; right-click or a long press on a card opens its menu. A search by name
  across trips and folders, listing at most twenty results; a trip opened from it stands
  in its own folder.
- Folders and trips answer to one menu: New, Add, Rename, Duplicate, Cut, Copy, Paste,
  Move…, Merge, Export, Delete; what does not apply is greyed out. New makes what the
  row can hold, named in a dialog: in a folder a folder or a trip, a collection where
  the folder holds those; in a trip a day at its end, whether the trip is open or not,
  in the open one as an edit that can be undone and that shows the day; a collection
  has no New. Add takes files from the computer: into a folder GPX files, zips of
  exported trips or a whole folder, imported as if dropped there; into a trip GPX files
  as days, into a collection as sections. “All trips” has a menu too, with New and Add
  for the top, Paste, and Export for every trip there is. Several are selected
  together, folders and trips alike: a tap or click on a card's pad (drawn as a drag
  grip), Cmd or Ctrl with a click, Shift with a click for a run (a plain click or tap
  still opens). The menu then acts on all of them, and a press on a pad drags them all
  onto a folder. Cut folders and trips move to where they are pasted, copied trips get a
  copy there, and either way the clipboard is empty after: what is on it is pasted
  once, and a new cut or copy takes its place before that. A folder that does not hold
  what is on the clipboard offers no paste: from Paste in a folder's menu, or from the line that offers it at the top
  of the folder shown. Export takes the trips of selected folders along, at any depth;
  Delete asks once for all. Several trips of a kind merge into the one selected first:
  a day joins that trip's day of the same date or goes in among its days by date, an
  undated day at the end; a collection's sections go at its end. The journal moves
  along, and the merged trips are deleted. Trips and collections are not merged with
  each other. Copied days are pasted onto a trip from its menu, at its end.
- Trips as a sequence of days; a day as one or more routes and its stops. A day is a
  card with its number and name over its date and length, and its menu (right-click or
  long press) edits, duplicates, pastes into and removes it. Their headers carry their
  actions as icons: the days', adding a day and showing the neighbouring days on the map;
  the opened day's, editing it; its routes', adding a route and importing a GPX file; its
  recordings', adding one. Days and routes are added in the panel and named, set up and removed in their dialogs or menus; the trip has a
  description and a day has notes, shown under the day's row and on the read-only page.
  A day is dragged into another place by its grip and duplicated (with new ids,
  undated); a route is dragged into another place within its day, duplicated, or
  moved to another day with the stops bound to it, from its row's menu (right-click or
  long press), where Move… opens the other days.
- Days, routes and stops answer to one menu, in a trip and in a collection alike: Edit,
  Duplicate, Cut, Copy, Paste, Move…, what only the kind has (a route's colour, a track's
  condensing), for several routes Show selected and Hide selected, Select, Remove. What does not apply is greyed out. A stop's menu has
  Icon besides: our twelve icons, each drawn before its name and the stop's own marked,
  one of which a click gives to the stop, or to all the stops selected in one step;
  Garmin's symbols stay in the stop's dialog. Several of a kind are
  selected with Cmd or Ctrl and a click, Shift for a run, a tap on the grip, or Select in
  the menu; the menu then acts on all of them. Pasted into a day go routes with the stops
  bound to them, stops, which stand free, and days, which follow it; pasted into a route,
  stops become points of it where the route passes closest, or at its start or end where
  the stop lies off it. What was cut waits, dimmed, and moves when it is pasted: within
  the trip it keeps its journal; into another trip or out of a collection it is copied
  there and then taken from where it was. Every such step is undone with Ctrl+Z.
- The keys of a file manager do what the menus do: Ctrl or Cmd with X and C cut and
  copy what is selected, Delete or Backspace removes it after the menu's question, and
  Ctrl or Cmd with V pastes. In the open trip they act on the selected days, routes,
  stops or recordings; with nothing selected, cut and copy take the route being edited.
  A paste goes into the route being edited where it takes what was copied (stops, as
  its points), else into the day picked, days after it. In the library they act on the
  selected folders and trips, and a paste goes into the folder shown. Selecting in the
  library clears the selection in the trip and the other way round, as does selecting
  in the duplicates report, and what is selected of a day is forgotten when another day
  is shown. In a text field the keys
  type, and a copy while text is selected copies the text.
  Copied routes are also pasted
  from a trip's menu in the library, each onto the day of its date or a new day (into a
  collection as a new section each), and from the menu of a folder that holds
  collections as a new collection with a section per route.
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
  connected to it where it passes closest, a bound one disconnected. A stop has a Garmin
  waypoint symbol, a name, address, contact, booking reference and notes in a dialog.
  Twelve symbols are drawn as our own icons (stop, start, end, meeting point, hotel,
  restaurant, café, fuel, sight, info, photo spot, break), each standing for one Garmin
  symbol; any other symbol is drawn as Garmin's picture on a sign, and a stop without
  one as a plain pin. The dialog offers our icons and, behind *More Garmin symbols…*, all
  of Garmin's with their pictures and a search.
- A trip opens whole: every day's routes on the map with the stops as dots, no day open;
  a click on a day opens it, and another closes it. The panel's arrow goes up one level at a time: from a day to
  the trip, from the trip to the list, in the folder the trip was opened from.
- Three panes on a wide screen: the library with the trip's days, the pane of the day
  picked, the map. The day's pane has in its heading what acts on the day and its
  trip's days: showing the neighbouring days on the map, the day's dialog, its
  journal. It lists its routes with profile, distance and the number
  of stops on each, folded: a click on a route takes it up to be edited and unfolds
  its stops and route points in riding order with the distance from the day's start,
  and a click on the route being edited ends that and folds them away; a route unfolded
  stays so while another is taken up; free
  stops within 500 m take the place where the route passes closest, and say how far
  beside it they stand. A click pans the map to the entry. A route point's row has the
  menu its marker has on the map: Convert to stop, the leg to it straight or routed,
  Remove point. Free stops farther away, or
  of a day without a route, are listed on their own. The button with three lines folds the library away
  to a strip, which leaves the map the room, and brings it back. The strip keeps the
  open trip's days in reach: a numbered button each, in the colour its routes have
  where each day has one, the day shown ringed; a click shows the day, or the whole
  trip again where that day is shown. On a screen without
  room for three panes, narrower than 1200 px, the day's pane takes the library's place while a day is picked,
  and its close button gives the library back; its heading then steps to the day before
  and after, the day's name between the steps and the buttons under it. On a phone the map is the page: the day picked is a sheet under it, pulled
  up to nearly the whole screen or down to its heading by its top edge, and folded down
  by itself while a route is edited; the library lies over everything and folds away,
  when a day is picked in it, to its button over the map, beside the open trip's name
  and whether it is saved. There the menus come up from the bottom edge, a submenu in the list's place under a
  row that leads back, and the route
  tools are one bar with captions: the tools, undo and done, the rest under More. On a
  touch screen every row with a menu has a button with three dots that opens it. A save
  that failed, or a trip changed elsewhere, is said over the map. The days before and after
  the selected one are drawn dimmed on the map, switchable. The library and the pane
  beside it are each as wide as their edge is dragged, kept per browser; a double click
  on the edge puts the default back.
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
- Every change saved to the server a moment later, as one document with a version that
  sends only the days and routes changed since the last save; a save over a newer
  version is refused and the trip offered for reloading.
- GPX import into a day: a file's routes become routes with every point, their legs
  routed, except those the file carries the way a Garmin calculated for, which keep that
  way; its tracks keep their line with every point;
  its waypoints become stops, bound to a point of a GPX route they stand on, free otherwise, with
  their Garmin symbol as the file names it, and with the
  address and phone numbers Garmin's waypoint extension gives as their address and
  contact. A track's row counts its points and
  lists only its stops, which are free along its line, and the map shows no marker for
  each of its points. Its menu condenses it (Douglas–Peucker at a distance chosen from a
  few, each with the count of points it leaves) or makes a route of it: fewer points,
  every leg routed, with the time the routing will take.
- Import of a folder tree from disk into a folder of the library, its folders recreated
  (existing ones reused by name), without a dialog. A folder that holds GPX files alone
  becomes a trip named after it without its date; a date in a file's name (YYYY-MM-DD,
  YYYY_MM_DD, or YYYYMMDD at its start) puts it on that day, several files of a date
  on one day; other files are a day each, dated on from a date in the trip folder's
  name, or undated. A folder that also holds folders of GPX files is a folder of
  trips: each of its own files becomes a trip of one day, named and dated by the file.
  Files that are no GPX are reported and left out.
- Opening a trip says how far it has come on the trip's row: a ring turns where its
  icon stands, and under its name stands how much of its document has arrived of how
  much ("Loading 2.3 of 4.1 MB"), then "Opening…" until the map has drawn its routes.
- Two folders every user has, first in the tree and tinted, which are neither renamed,
  moved nor deleted: Recordings (red), for recordings that belong to no trip, and
  Collections (yellow). They and the folders in them hold collections and nothing else;
  every other folder and the top hold trips. The server refuses a collection made or
  moved elsewhere, a trip made or moved into them, and a folder moved across with
  contents of the wrong kind. The library follows: New in such a folder's menu offers
  a collection where others offer a trip; Move… offers only folders that take what is
  moved;
  copied routes are pasted as a new collection onto these folders only; and a folder's
  card counts collections there.
- Import by dropping GPX files, zips of exported trips and folders from the computer on
  a folder of the tree, or by Add in its menu; what they become follows from the folder. On Recordings or a folder
  in it, every GPX file of one track is kept as a recording, the file as it is: in the
  collection named after the year it was recorded in, on the section of its month
  (its first track point's time, else a date in its name, else the file's own date),
  both made where they are missing. A file the user keeps already, on whatever day, is
  left out, so the same folder can be dropped again; a file of several tracks is
  reported and left out. Files added from the menu of a collection in there are kept
  the same way, in that collection. On Collections or a
  folder in it, files become sections of the collection “Imported” and a dropped folder
  is imported as planning material: a collection per folder of files, its folders
  recreated. On any other folder or the top, a file becomes a trip and a dropped folder
  is imported as the folder tree above says. Exported trips in dropped folders and in
  zips come back as they were.
- A duplicates report, switched on by its icon among the library's actions, in the pane
  between the library and the map: the routes kept more than once across all trips
  and collections, grouped as exact copies (the same points or the same line, whatever
  the date) or as the same ride kept twice (the same way within a kilometre at both
  ends, lengths within a tenth, nine in ten of each line's points within 75 m of the
  other, on the same date or an undated day). A day's planned route beside the
  tracks recorded of it on that day is left out: they belong together, unless the day
  holds a route or a track twice. Once the same ride is anywhere else as well, in another trip or in a collection, the group is
  listed whole. A click or a tap selects a route, Cmd or Ctrl one more,
  Shift a run of them; a route's pad adds it or takes it away; a selected row is highlighted.
  The map draws the selected routes and brings them into view, each in a colour of its
  own that its row shows as well, the first eight selected, so that they are compared at a
  glance. The menu (right-click or long press) opens the location of a single route, its
  trip at its day, whose pane takes the report's place while the tree unfolds down to
  the day as if it had been clicked there, and copies or deletes the
  selected ones, as Ctrl+C and Delete do. A day picked in the tree takes the pane for
  itself as well. The report is made once and kept while the page stands: shown again,
  it is there at once, where it was scrolled to; what is deleted from it is taken out
  of it, its heading says when it was made, and the button there makes it afresh. A
  route deleted from the open trip leaves it as an edit that can be undone. While it is made, which takes a
  while on a large library, a ring turns beside how many routes are compared and the
  seconds gone.
- Collections of planning material, such as a long-distance trail by country: listed in
  the library as planning material, opened like a trip but with sections instead of
  days and no dates, times, journal, tools or export. A section lists its routes and
  waypoints; a click on a route takes it up and shows it whole on the map, on a waypoint goes there, and
  their menus copy them, to be pasted into a day of a trip, or remove them. A section is
  renamed or removed from its menu.
- Routes and stops can be marked optional, each in its dialog, and are shown so.
- GPX export from a dialog: the whole trip, the day picked, or the days or routes
  selected, from Export GPX… in their menu; what is exported is saved first; one file
  or one file per day in a zip; routes as tracks with their full line, or as routes of their points for
  the device to route between; with or without the optional routes and stops; free stops
  within a chosen distance of a route. Stops become waypoints with their Garmin symbol;
  each route is named after its day and its own name. Named presets of these options are
  kept with the account.
- Export of whole trips, to keep or to move: *Export* in a trip's menu, or in the menu of
  several selected trips, downloads a zip with a folder per trip. In it stand `trip.json`
  (the trip as the planner holds it, its journal and its recordings), the journal's
  files, the recordings as GPX, and one GPX file per day for other programs. The zip, or
  the folder it unpacks to, is imported again by Add or by dropping it: each trip comes
  back as a new one with its days, routes, stops, journal and recordings, an entry at
  the time it was written. GPX files beside exported trips are imported as before.

- Recordings on a day: *Add recording…* in the day's menu or under the opened day takes
  a GPX file of one track, such as Ridelink's or Scenic's (waypoints in it are left
  aside); the file is kept as it is, with every value it measured per point. A day's
  recordings are listed under it, each in its own colour, and those on the map are
  drawn in that colour under the planned routes.
  A recording's menu renames, cuts, copies, moves it to another day and deletes it;
  several are selected as routes are, and the menu then acts on all of them. Copied
  recordings paste into any day, of this trip or another; cut ones move there. A single
  copied recording also pastes as a track route, to plan from it; nothing else becomes
  a recording than a recorded file. A recording's row says when it began and how long
  it is, or that its file has no times.
- Recordings that wait for their day: those in the Recordings folder, on the sections of
  their collections, where they are listed, shown and opened as on a day; a collection
  there says how many it holds. *Look up recordings…* beside *Add recording…* on a
  trip's day lists the waiting ones that may be the day's: begun on its date, or run
  along its routes, or its routes along them, a part of the day being enough. Each says
  when it began, its length and why it was found; a click shows its line on the map,
  the plus puts it on the day, as it is, and it waits no longer.
- What is on the map is chosen as in a layer panel. Every route and every recording has
  an eye on its row, and the headings Routes and Recordings have one for all of theirs:
  a thing is drawn while its own eye and its group's are open. Routes start open,
  recordings closed. A group's eye takes all of its group off the map and leaves their
  own eyes as they are, shown faint meanwhile, so that opening it brings back what was
  there. The route taken up and the recording opened are drawn whatever the eyes say.
  Several selected are shown or hidden from their menu. The eyes are the open trip's,
  for all of its days, and go when it is left or the page is loaded again. The whole
  trip shows the routes whose eyes are open, the day shown those and its recordings
  whose eyes are open, the neighbouring days their routes; recordings are drawn for the
  day shown only.
- A route under a mouse's pointer on the map is drawn wider and named, after its day while the
  whole trip is shown; a click or a tap on it shows its day and takes the route up, as a
  click on its row does, which is brought into view. This holds while no route is being
  edited, when a tap does the tool's work.
- A recording's figures: a click on it shows it whole and opens a card over the map with
  its distance, time and moving time, average and top speed, climb and descent, lowest
  and highest point and furthest lean to either side, as far as its file has the values.
  Its line can be coloured by speed, altitude, slope, lean angle or the road surface,
  with a legend; the surfaces, matched once by the routing server, are listed with the
  distance on each. A card along the bottom charts altitude and speed along the way, and
  how far was ridden at each speed, slope and lean angle. Pointing in the chart marks the
  place on the map; a click in the chart or on the line on the map shows everything known
  of that point: the distance along, the time, the measures, the surface and the file's
  other values. On a narrow screen the figures start folded.
- Comparing a recording: its card compares it with its day's planned route or another
  recording shown on the map. Against the plan it says how far it went off the route
  and how far at most, and follows the route as it is edited. Against another recording
  it also says the time ahead or behind at the end and the speed difference on average,
  at the same places along the way. The line can be coloured by the distance from the
  other, and by speed and lean against the other recording; a Difference chart shows
  the time and speed against it along the way, or the distance from the plan. The point
  picked says how it differs there.
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
- A read-only page of the trip for reading and printing: the map with every day, on the
  base map chosen but without the planner's overlays, the
  journal, each day with its routes and its stops in riding order with their times,
  addresses, bookings and notes. The page is the owner's, or shared under a link that
  needs no sign-in and can be withdrawn.

- A place and address search over the map, by Nominatim on Enter: the first place found
  gets a pin and the map flies there, the others are listed to pick from. The pin stays
  until the search is cleared; while a route is edited, its menu adds a point or a stop
  there.
- A base map to choose on the map: OpenFreeMap's Liberty, Bright, Positron and Dark
  styles, or the OpenTopoMap, OpenStreetMap, CyclOSM, TopPlusOpen and Esri
  satellite raster tiles; the route lines
  and markers stay. A locate-me button shows where the browser is. The interface light
  or dark by hand, or as the browser says. Both choices are kept in the browser.
- Overlays to switch on over the base map, each with a button of its sign among the
  map's controls, kept in the browser:
  the roadworks Rhineland-Palatinate's and Baden-Württemberg's services list, as a line
  with a warning sign, a red ring where the road is closed, diversions in blue and works
  yet to begin in grey, where a tap on a site says the road, the kind of work, its dates
  and who reports it; and the roads closed to motorcycles in Germany, Austria,
  Switzerland, the Netherlands and Belgium as mintelonline.de collects them, a motorcycle
  in a red ring where one begins, where a tap says when and for whom it holds. Signs and
  lines of both grow with the zoom, so that they stay wider than the road under them.
- Places on the map from the planner's own store of OpenStreetMap data: fuel stations,
  hotels, restaurants, cafes, viewpoints and parking, each kind a layer to tick in the
  list the places icon of the panel opens. Shown are those along the selected day's routes,
  each kind within its own distance, or, with that switched off, all in view from zoom 10
  on. A tap on a place shows name, address, cuisine, opening hours, phone and links to
  its homepage and OpenStreetMap. The store is filled area by area by `make places`, which lists
  the areas to pick from when run without one, and names those of which a kind of place
  is behind the others or missing.
- Preferences in one dialog. Kept with the account: how wide route lines are drawn, how
  routes get their colours, and how far from a route a place of each kind is still shown
  along it, 200 m to begin with. Kept in the browser: the language, and light or dark
  colours.
- Route lines in colour: one colour for each day, or the palette's next colour for each
  route of the trip, as the preferences say; a route's menu gives it a colour of its own,
  which it keeps wherever it is drawn. A route's row shows its colour. Lines are 5 pixels
  wide unless set otherwise, and grow wider when zoomed in: those of routes, of
  recordings and of the routes the duplicates report and a day's lookup draw alike.
- A spot of the map opened in Google Maps, OpenStreetMap or Google Street View, from the map's menu.
- Loading the page again comes back to where it was: the folder shown, the open trip, its
  selected day, the route being edited and the map's view are kept in the address, which
  can be bookmarked or opened on another device.
- English and German. The planner follows the browser's language, or the one chosen in
  its preferences, kept in the browser; numbers, dates and distances
  are written the language's way. The server's pages, messages and mails follow the
  browser's language, and the GPX export names unnamed days and routes ("Tag 1",
  "Route 2") in the planner's.
