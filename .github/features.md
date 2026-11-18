# Core features

## Available

- Accounts: sign-up from the landing page by a link mailed to the address, or, with
  `open_signup` off, a waiting list there and invitations by mail from an admin page or
  the command line; sign-in that lasts 30 days from the last visit, sign-out, password
  reset by mail. `make user EMAIL=…` makes
  an account without an invitation and prints a generated password; at the first
  sign-in the user has to replace it before the planner opens.
- The library has four tabs, which stay in view while it scrolls: Stash, for the files
  that wait to be worked on, Trips, Places, for the lists of the user's own places,
  and Recordings, for the rides; each is its name in bold capitals under its icon, the
  one shown in full ink over a line. A tab is a view of its own: what is
  unfolded, marked and selected in the others stays as it is, and each keeps how far it
  was scrolled, also while the library is folded away. The map and the pane beside the library show what belongs to the tab
  shown, and under the gear what the tab before showed: the open trip and its day in
  Trips, the open list in Places, the file shown in Stash, the ride opened and the
  rides pinned in Recordings; pinned routes and recordings stay on the map whatever tab is
  shown. Trips and Places each keep what they had open when the user left them by
  their tab, the trip or list, its day, the route taken up, the day whose contents
  were open and the recording opened,
  and open it again when the user comes back by their tab; only one trip is open at a
  time, so coming back may open it afresh. No tab has a heading over its tree.
  Under the tabs a line says what the view holds, with the button that folds its tree
  away and the menu of its top; the address keeps the tab, so that loading the page
  again comes back to it. Opening a trip from a ride or from the duplicates shows the
  tab it is in.
- Each tab has its own search, under the tabs: it limits its tab to what it finds
  there, and what is typed into it stays with that tab while another is shown, so
  that each tab can be narrowed by another word and the results are still there on
  coming back. The settings have none, and the tabs stand where they are either way. In Stash, Trips and Places it lists the tree's
  folders and trips whose names contain it, and the routes and tracks of those trips
  that are named so, each with its trip and day, at most twenty in all; a folder found
  is shown in the tree, a trip opens, and a route or a track opens its trip at its day
  with the route taken up, each ending the search. What it lists is selected as the
  tree's rows are, by the pad, with Cmd or Ctrl and with Shift, and has its menu: a
  folder's and a trip's as in the tree, a route's to delete it, or the selected routes,
  from their trips, which the Delete key does too. Routes selected together with
  folders or trips are not deleted, and the menu says so. A changed search starts with
  nothing selected. In Recordings it leaves the rides whose names contain it, every
  year of them unfolded, with their count and length over them.
- The folders at the top of the trips' and of the Stash's tree stand in the order the
  user puts them in, by dragging one by its grip or with the arrow keys on it; a new
  one comes after them. Everything below, and the trips and lists beside them, is by
  name.
- Tags tell trips apart. A tag is a name in a colour, made, renamed, recoloured and
  deleted in the settings. The menu of a trip, or of the trips selected, puts each
  tag on them or takes it off, ticked where all of them have it; a trip shows its
  tags as coloured chips on its row. Above the trips the tags stand as switches:
  those pressed limit the list to the trips that have all of them, in whatever
  folder, and the search then looks among those. The search also finds a trip by the
  name of a tag on it. Lists of places and the Stash have no tags.
- Stash, Trips and Places are each a tree: its folders and trips as rows. A folder
  unfolds in place by a click on it to its folders and trips, a file of the Stash to
  what it holds, a list of places to its categories, as many at once as wanted; what is
  unfolded is kept per browser. A trip does not unfold: its days are in its pane (see
  below). In a folder its folders stand first, then its trips, lists or files, each by
  name whatever the case, so that a row stays where it is when what it holds is
  changed. The tree has one mark, on the row clicked last: a folder, a trip, a list or
  a category of the open list. A click on a folder marks it, which makes it the one
  new trips, imports and pasted ones go into, and unfolds it; marked and unfolded
  already, it folds. A click on a trip marks it and shows it whole on the map without
  opening it (see below), and changes nothing else in the tree. A list of places is a folder of
  categories and answers as a folder does: a click marks it and unfolds it, which
  opens a list that was not open; a click on a category marks it and shows it on the
  map, a click on the list then gives the mark back to the list and closes the
  category, the next click folds the list, the one after unfolds it again. What folds
  takes what it holds with it: a folder its folders and lists, a list its category
  shown. The marked row is tinted, and a coloured strip runs down the left of it and
  of what is open besides: the folders around the mark and the top, and the open trip
  or list while the mark is elsewhere. A click on a category of any list opens that
  list at the category; a category reads the same in every list, open or not, and
  ends in a pad that opens the pane of its places, and closes it. The
  button in the line under the tabs folds every folder and list of the tree shown
  away.
  The open trip stays in the tree, the others around it, so that another trip is one
  click away. Above the tree stands the search, and beside the trips' the duplicates
  report's switch as an icon. A trip's row ends in a pad that opens the trip, with its
  pane beside the library, and closes it again; its arrow points to the pane while
  the trip is closed and back while it is open. The open trip's menu has what only the
  open trip has: Edit… in place of Rename…, Export GPX…, Journal and sharing… and
  Close, which leaves it saved. On a screen without a right-click the head of the open
  trip's pane has a menu button with Edit…, Export GPX… and Journal and sharing…, since
  the trip's row is not shown beside its pane where one pane alone fits; a list of places has Close alone.
- A library of the user's trips in folders, which may hold folders: create, open, rename,
  duplicate and delete trips, create, rename and delete folders (for a folder that holds
  anything the confirmation asks whether that moves up into its parent or is deleted with it), move a trip between folders from Move… in its menu, create a trip or a folder
  from New in the menu of the folder it goes into. Trips and folders are dragged by their pad into a folder to move them there: onto its
  row or onto anything it holds while unfolded, the folder lighting up; anywhere else in
  the library's pane, the line under the tabs lights up and the drop goes to the top of the tree shown; selected trips go together, and a
  folder never goes into itself. Nothing lights up where the drop would change nothing: not the folder a row is in already. Folders and trips are cards with the name over a line
  of metadata, each with the icon of its kind: a folder, a trip, a list of places, a
  file; a trip's card also shows its shape, small, each line in the colour its route
  has on the map; right-click or a long press on a card opens its menu.
- A right-click on the free space of a pane, where it hits no row, opens a menu of
  what is added to what the pane lists: in the library the menu of the tree's top,
  as the line under the tabs has it (New, Add, Paste, Export); in a trip's pane Add
  day, Paste, which puts the days on the clipboard after the trip's last, and
  Journal and sharing…; in the pane of a day's contents Add route, Import GPX or KML…, Add
  recording…, Add files… for its media, and Paste into the day. A trip of one day
  has both in its one pane. The rides, the settings and the pane of a category
  have none, and a text field, a link and selected text keep the browser's menu.
- Folders and trips answer to one menu: New, Add, Rename, Duplicate, Cut, Copy, Paste,
  Move…, Merge, Export, Delete. Every menu of the planner holds only what can be done
  with what it is opened on, by its kind and by how many are selected: Rename is not
  offered for several, Merge not for one, Duplicate and Copy, which only trips have,
  not on a folder or with one among what is selected, Export not on the Stash's
  folders. An entry is greyed out only where it could be used and something else is
  in the way: Paste while the clipboard holds nothing for the place, Export of a
  folder without trips, Merge of rides that do not follow one another. New makes what the
  row can hold, named in a dialog: in a folder a folder or a trip, which starts with
  Day 1 and opens at it, among the Places a list, in the Stash a folder alone; in a trip a day at its end, whether the trip is
  open or not, in the open one as an edit that can be undone and that shows the day.
  Add takes files from the computer: into a folder GPX files, zips of exported trips
  or a whole folder, imported as if dropped there; into a trip GPX files as days. The
  line under the tabs has a menu too, with New and Add
  for the top of the tree shown, Paste, and Export for what the tree holds, every trip there is in the trips' case. Several are selected
  together, folders and trips alike: a tap or click on a card's pad (drawn as a drag
  grip, also on the rows that are only selected by it), Cmd or Ctrl with a click, Shift with a click for a run: the cards from the one
  clicked last to the one clicked now, and no others. A plain click or tap
  still opens, lets go of what was selected and is where the next run starts. The menu then acts on all of them, and a press on a pad drags them all
  onto a folder. Cut folders and trips move to where they are pasted, copied trips get a
  copy there, and either way the clipboard is empty after: what is on it is pasted
  once, and a new cut or copy takes its place before that. A folder stays in the tree
  it is in, an empty one too, and is not pasted into itself or a folder inside it. A
  folder that does not take what is on the clipboard offers no paste, neither as Paste
  in its menu nor as the line that offers it at the top of the folder shown, nor by
  the key. Export takes the trips of selected folders along, at any depth;
  Delete asks once for all. Several trips of a kind merge into the one selected first:
  a day joins that trip's day of the same date or goes in among its days by date, an
  undated day at the end; a collection's sections go at its end. The journal moves
  along, and the merged trips are deleted. Trips and collections are not merged with
  each other. Copied days are pasted onto a trip from its menu, at its end, with their
  media and the rides they are on.
- A trip of one day says the day's date and length on its row in place of the count
  of its days, its pane is that day's contents under the trip's name, with the button
  that adds a day (the list of the days comes with the second), and its Paste also takes what only
  a day takes (stops, media, recordings), into that day, while the trip is open.
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
- Autoname, in the menu of a route or a track of a day: the selected ones are named
  after the places they begin and end in, as "Hockenheim - Walldorf", as rides are in
  theirs. It is said under the day's routes how far it is and which could not be named.
  Each name is an edit of the trip, undone like any other.
- A drop is a cut and a paste in one move, within the tab and without the clipboard: a
  row is dragged by its grip or pad onto every place where a cut of it would be pasted,
  and the place lights up under it. A day goes onto another trip's row, with its media
  and recordings; a route onto another day or another trip's row; a stop onto another
  day or onto a route, as a point of it; a day's media and recordings onto another day.
  Among the Places a place goes onto another category or another list's row, and a
  category onto another list's row, into the category of its name. A day is the day's
  row in the pane or its button in the strip beside the pane. Several selected
  rows go together, and the label that follows the pointer says how many. Within its
  own list a day, a route and a category are sorted by the grip instead, which merges
  nothing. The routes, tracks, waypoints and media of Stash files and the rides are
  not dragged: they are copied, never cut.
- Days, routes and stops answer to one menu, in a trip and in a collection alike: Edit,
  Duplicate, Cut, Copy, Paste, Move…, what only the kind has (a route's colour, a track's
  condensing), Convert, for several routes pinning them to the map or letting go of them, Remove; what takes one part alone is left out for several. A stop's menu has
  Icon besides: our twelve icons, each drawn before its name and the stop's own marked,
  one of which a click gives to the stop, or to all the stops selected in one step;
  Garmin's symbols stay in the stop's dialog. Several of a kind are
  selected with Cmd or Ctrl and a click, Shift for a run, or a tap on the row's grip or
  pad, as are recordings and media; the menu then acts on all of them. A run goes from the row clicked last,
  with or without a key held, to the row clicked now and holds nothing else; a plain
  click lets go of what was selected. Pasted into a day go routes with the stops
  bound to them, stops, which stand free, and days, which follow it and bring their
  media and recordings: copied, the files are copied and the rides are on both days;
  cut into another trip, they move with the day. Pasted into a route,
  stops become points of it where the route passes closest, or at its start or end where
  the stop lies off it. What was cut waits, dimmed, and moves when it is pasted: within
  the trip it keeps its journal; into another trip or out of a collection it is copied
  there and then taken from where it was. Every such step is undone with Ctrl+Z. The
  Paste entry says what it pastes by kind and number ("Paste 1 route", "Paste 3
  stops", "Paste 1 category"), never by name, and counts what the place takes of it.
  Nothing is pasted onto what it was cut from.
- The keys of a file manager do what the menus do: Ctrl or Cmd with X and C cut and
  copy what is selected, Delete or Backspace removes it after the menu's question, a
  recording by taking it off its day, and Ctrl or Cmd with V pastes. In the open trip they act on the selected days, routes,
  stops or recordings; with nothing selected, cut and copy take the route being edited.
  A paste goes into the route being edited where it takes what was copied (stops, as
  its points), else into the day picked, days after it. In the library they act on the
  selected folders and trips, and a paste goes into the folder shown; among the rides
  they copy and delete the selected ones, and a paste keeps the tracks copied in the
  Stash. Selecting in the
  library clears the selection in the trip and the other way round, as does selecting
  in the duplicates report, and what is selected of a day is forgotten when another day
  is shown. In a text field the keys
  type, and a copy while text is selected copies the text.
  Copied routes are also pasted
  from a trip's menu in the library, each onto the day of its date or a new day.
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
  waypoint symbol, a name, address, contact, booking reference, website and notes in a dialog.
  Twelve symbols are drawn as our own icons (stop, start, end, meeting point, hotel,
  restaurant, café, fuel, sight, info, photo spot, break), each standing for one Garmin
  symbol; any other symbol is drawn as Garmin's picture on a sign, and a stop without
  one as a plain pin. The dialog offers our icons and, behind *More Garmin symbols…*, all
  of Garmin's with their pictures and a search.
- A click on a trip's row looks at it: the trip is read and drawn whole on the map,
  its stops as dots, without being opened. Nothing of it can be edited there, and
  the open trip stays open with its panes; a click in them, a day picked or a click
  on the open trip's row gives the map back to it. While another trip is looked at,
  the keys that undo, redo, cut, copy and paste in the open trip are off. A route
  the search finds in a trip that is not open is looked at with its day; a ride's
  suggested day likewise.
- The pad on a trip's row opens it, and a trip is open for as long as its pane stands
  beside the library: the pane's pad that closes it, the pad on the row and Close in
  the row's menu all close the trip, saved. A trip that is closed stays on the map,
  looked at. While a save fails, the trip is neither closed nor left for another, and
  the failure is said over the map. The pane lists the days under each other, each
  by its number and name over its date and length, with the grip that reorders them,
  its journal, its menu and a pad. A click on a day shows it on the map; a click on
  the day shown shows the whole trip again. The pad on a day's row opens a third
  pane with what the day holds, and closes it; that pane keeps its day while another
  is shown on the map, and a click in it shows its own day again. The pane's heading
  has the trip's name over the count of its days and their length, the switch that
  shows the neighbouring days on the map, and the button that adds a day.
- Three panes on a wide screen beside the map: the library, the pane of the open
  trip's days or of a list's category, and the pane of a day's contents. Nothing
  opens or folds by itself: a row's click shows on the map, a row's pad opens the
  next pane. While that pane is open it follows the row clicked: another trip is
  opened in its place, with the contents of its first day where a day's are shown,
  and another day's or category's contents take theirs. Each pane has two pads at the top right: one folds it to a narrow strip
  and stands at the same place on the strip, where it unfolds the pane again; the
  other closes it, on the strip as well, and closing a trip's pane closes the day's
  contents with it. The library has the fold alone. Any panes may be folded at once,
  which is kept per browser; a pad that opens a pane unfolds it.
  A day's contents list its routes with profile, distance and the number
  of stops on each, folded: a click on a route takes it up to be edited and unfolds
  its stops and route points in riding order with the distance from the day's start,
  and a click on the route being edited ends that and folds them away; a route unfolded
  stays so while another is taken up; free
  stops within 500 m take the place where the route passes closest, and say how far
  beside it they stand. A click pans the map to the entry. A route point's row has the
  menu its marker has on the map: Convert to stop, the leg to it straight or routed,
  Remove point. Free stops farther away, or
  of a day without a route, are listed on their own. Nothing stands
  over the tabs: the account, with the way to sign out, is under the settings. The
  strip of a trip's folded pane keeps the
  days in reach: a numbered button each, in the colour its routes have
  where each day has one, the day shown ringed; a click shows the day, or the whole
  trip again where that day is shown. Of a list of places it keeps the
  categories instead, each by its icon, or its dot where it has none. A button
  under the mouse says at once, in a card beside it, what is behind it: the day's
  number and name, its date and length and what it holds, a category's name and how
  many places it has. The strip of a day's folded contents keeps its routes and
  tracks in reach the same way: a numbered button each, in the route's colour, the
  one taken up ringed; a click takes the route up, or lets go of it. On a screen narrower than 1200 px one pane stands beside the
  map, the deepest that is open: a pad that opens a pane shows it in the place of
  the one it stands in, and the pad that closes reads Back and leads to the pane
  before, which from a trip's pane closes the trip. On a phone held upright that
  pane is a sheet under the map, pulled by its top edge up to nearly the whole
  screen or down to its head, and folded to its head by its pad, an arrow down;
  held sideways, the pane stands beside the map and folds to the side. A category's
  heading steps to the one before and after, its name between the steps.
  A trip is saved by itself and nothing says so while that goes well; a save that fails is
  said over the map. There the menus come up from the bottom edge, a submenu in the list's place under a
  row that leads back, and the route
  tools are one bar with captions: the tools, undo and done, the rest under More. On a
  touch screen every row with a menu has a button with three dots that opens it. The head of the
  open trip's pane has that button with a mouse as well: it is where a trip of one day
  has its journal and sharing. A save
  that failed, or a trip changed elsewhere, is said over the map. The days before and after
  the selected one are drawn dimmed on the map, switchable. Each pane is as wide as its edge is dragged, kept per browser; a double click
  on the edge puts the default back. The edge bears a handle at its middle, and under a
  finger it is taken in a wider strip than it shows.
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
  routed, except those the file carries the way a planner calculated for, which keep that
  way: Garmin's, given from each point to the next, or, where the file has none of
  that, the way DMD's planner calculated for the route as a whole, cut at the route's
  points, as long as the route still has the points it was calculated for, which its
  hash says; its tracks keep their line with every point;
  its waypoints become stops, bound to a point of a GPX route they stand on, free otherwise, with
  their Garmin symbol as the file names it, and with the
  address and phone numbers Garmin's waypoint extension gives as their address and
  contact. Where Garmin's trip planning marks a route's points, a via point becomes a
  stop on its point as well, under its name and symbol, unless a waypoint stands there
  already, and a shaping point is a point of the route and nothing more. A track's row counts its points and
  lists only its stops, which are free along its line, and the map shows no marker for
  each of its points. Its menu condenses it (Douglas–Peucker at a distance chosen from a
  few, each with the count of points it leaves), and Convert in it makes a route of it
  beside it: fewer points, every leg routed, with the time the routing will take.
- KML and KMZ files are read wherever a GPX file is, but as recordings, which are
  kept as the GPX files they are: into a day, as the days of a trip, the sections of a
  collection or the places of a list, picked or dropped, alone or in a folder. A
  placemark's point is a waypoint with its name, its address and phone number, and its
  description as notes; a description written as HTML is read as text, and a page it
  links to is the waypoint's website. A placemark's lines, and a track recorded with
  times, are a track, which Convert makes a route of. The folder a point is in is the
  kind of place it is in a list of places; the document's name names the list. Areas
  are left out. A KMZ is read for the KML at its top.
- Import of a folder tree from disk into a folder of the library, its folders recreated
  (existing ones reused by name), without a dialog. A folder that holds GPX files alone
  becomes a trip named after it without its date; a date in a file's name (YYYY-MM-DD,
  YYYY_MM_DD, or YYYYMMDD at its start) puts it on that day, several files of a date
  on one day; other files are a day each, dated on from a date in the trip folder's
  name, or undated. A folder that also holds folders of GPX files is a folder of
  trips: each of its own files becomes a trip of one day, named and dated by the file.
  The media that lie beside a file as its own are kept with the day the file makes:
  the files of a folder beside it that is named as the file is, with or without
  " (media)" after the name, and files beside it whose names begin with the file's.
  The other files of a folder that becomes one trip are kept with the trip's first day
  as its media; hidden files, and other files beside trips made a file each, are left
  out. Dropped on the Stash, a file's media are kept with the file there.
- Opening a trip says how far it has come on the trip's row: a ring turns where its
  icon stands, and under its name stands how much of its document has arrived of how
  much ("Loading 2.3 of 4.1 MB"), then "Opening…" until the map has drawn its routes.
- The Stash (its tab yellow) holds files and Places (green) lists of places, each in
  folders of their own; the Trips hold trips. The server refuses a list made or moved
  outside the Places, a trip made or moved into either, a file kept outside the
  Stash, and a folder moved across with contents of the wrong kind. The library follows: New in a folder's menu offers a
  list among the Places where others offer a trip, and in the Stash a folder alone;
  Move… offers, from the folder the thing is in, the top of its tree as "/", the folder
  around it as "..", the folders beside it as "../name" and the folders in it, so that its list
  stays short in a large tree, and only those that take what is moved; anything
  further off is reached in steps or by dragging. A folder's card counts files
  in the Stash and lists among the Places.
- The Stash is folders of files: every file is kept whole, as it was imported, so that
  nothing it holds is lost before it is worked on. A file's card says what it holds,
  its routes, tracks and waypoints and how far they go, and shows its shape; a click
  unfolds it to its routes and tracks, each with its length and when it starts, a
  track with times when it began and a route planned with Garmin's trip planning when
  it is to leave, and under that what it carries that is not seen otherwise, as chips:
  times, elevation, lean angles and G-forces on its points, however the file writes
  them, Garmin's extension of a route and of its points, its trip planning ("Garmin
  trip": which points are stops and which only shape the route), and whether DMD or Rumo
  wrote data of their own into it. It shows the file whole on the map, each line in the colour its row
  has and the waypoints as dots; a click on a route or a track, or on the row of the
  file's waypoints, shows that alone, another click the file again. What is shown
  holds the Stash's mark: its row is tinted, one at a time, and the strip down the
  left runs from the top through its folders and its file to it; a folder clicked
  after takes the mark, and the strip alone still leads to what the map shows. A
  file's media, the photos and documents that belong to it, are one more row under
  its waypoints, Additional Media, which says how many files they are; a click lists
  them under it, each opening as a day's media do, an image or a PDF over the page
  and any other file as a download. They are selected, copied and deleted together,
  by the row's menu, which also adds more; the file's menu adds media too. Files are selected as folders are, dragged or moved
  into the Stash's folders, cut and pasted into them, renamed and deleted from their menu; a folder deleted
  takes its files with it or gives them to the folder around it. Nothing is started
  in the Stash, and no trip or day is pasted into it: a folder is all that is made
  there, and a file takes only what is copied from other files of the Stash. The
  search finds files by name and their routes and tracks by theirs, and shows what it
  found in its folder and on the map.
- A folder of the Stash that holds files of its own offers Group files… in its menu:
  it proposes which of them belong together, the legs of a ride, the days of a tour,
  the versions of a route, and makes nothing by itself. Each proposed group stands in
  a dialog with the name its folder would get, which can be changed, with what tied
  its files (names alike, one continuing the other, a way there and a way back,
  exported together) and with its files; a group unticked is left as it is. Create
  folders makes a folder in the folder for each group ticked, takes the one of that
  name where there is one, and moves the files into it. Files that belong to no group
  stay where they are, and the folder is asked again whenever more should be sorted.
- Things leave the Stash by Copy, in the menu of a file, of a folder, of several
  selected, or of one route or track, and with Ctrl or Cmd with C. A copied folder is
  pasted into a folder of the trips, or their top, or onto a trip, and nowhere else:
  onto a trip its files, and those of the folders in it, become days of that trip; in a
  folder, a folder of files
  becomes a trip named after it, a folder that also holds folders a folder of trips,
  each of its own files a trip of one day. A trip's days are made of the folder's
  files: the files of one date are one day, the date being the one in a file's name
  or else the day it is planned to leave or was recorded, the dated days by date and
  the files of a day by the time they leave. Of the undated files, the parts a name
  numbers as one day ("Tag 2") are one day and those it numbers apart are apart; the
  others are one day while each goes on where the last ended and the day stays within
  400 km, so that the legs of a ride between its stops are one day and the days of a
  tour each their own, two rounds from one place always apart. They stand in the
  order ridden: along the line they form, a closed one from where the Stash's files
  usually leave, or by name where the lines do not say. A copied file is imported where it
  is pasted, as the same file picked there would be: into a folder of the trips, or
  their top, as a trip of one day, dated as a day of a folder is; into a trip as a day dated the same way, where its date puts it among the trip's days, an undated one at the end; into a day of the open trip
  as its routes and tracks with the waypoints on them and the other waypoints as free
  stops; into a folder of the places as a list of its waypoints, and into a list or a
  category of it as places: in a list each under the kind its waypoint is of (`<type>`), else
  under "Places", a place the list holds already left out; in a category all of them. A
  file is offered only where it holds something for the place: routes or tracks for the
  trips, waypoints for the places. Copied routes and tracks go
  as an import would read them, a route with its points and the way Garmin gave
  between them, a track with its line, each with the waypoints on its points, to be
  pasted into a day of any trip. A file's waypoints are one row under its routes and
  tracks, selected and copied all together: pasted into a day they are free stops,
  into a list of places or a category of it places. A file's media go where the file
  goes: with a file pasted as a trip or as a day they are that day's additional media,
  and their row, copied, is pasted into a day of the open trip, where they are kept
  with the day, or into another file of the Stash; a trip's row takes no media by
  themselves, and a list of places none at all. Add to recordings, in the menu of a track, keeps it among the rides with
  everything the file tells of it, its times, heights and sensor values: a track that
  is all its file holds of routes and tracks as the file itself, so that it is known as
  the ride the same file was kept as before, any other alone, without the file's
  other tracks, routes and waypoints. A line over the list then says what came of it,
  by the ride's name and the date it is listed under: that it was added, or that it
  is there already and as what; of more than three tracks, how many of either. The
  file stays in the Stash either way. Copied tracks, and copied files for the tracks
  they hold, are pasted among the recordings to the same effect: by the line that
  offers it above the rides, or by the paste key. Export
  in a file's menu saves the file as it is kept.
- A file of the Stash is cleaned up by whole routes and tracks: one is renamed, and one
  or the selected ones, of any files, are deleted from their files, from the menu or
  with the Delete key, after a question. Either rewrites the stored file and leaves the
  rest of it as it was; the same file imported again is still known as kept. Routes
  and tracks are selected with their pads, Cmd or Ctrl and Shift as files are; selected
  together with files or folders they are not acted on, and the menu says so. What is
  copied of files, routes, tracks and the waypoints of a file, is pasted from another
  file's menu into that file: added to it as it stands in its own, in the format's
  order, while its own file keeps it, so that files are put together from others.
  Nothing finer is changed in the Stash: no geometry, no symbols, and waypoints only
  all of a file together.
- Import by dropping GPX files, zips of exported trips and folders from the computer on
  a folder of the tree, or by Add in its menu; what they become follows from the folder.
  On Places or a folder in it, a GPX file's waypoints
  become the places of a list named as the file names itself, else after the file, each
  under the kind its waypoint is of (`<type>`), else under "Places"; a place the list
  holds already, by name and position, is left out, so a newer file of the same list
  adds only what is new. Routes and tracks in such a file are left out and said so.
  A file that holds waypoints and no route is refused elsewhere, with the pointer to
  this folder. A file that holds KML under a GPX file's name, or the other way round,
  is read as what it holds, wherever it is imported. On the Stash or a folder in it,
  every GPX file is kept as a file, as it is, a KML or KMZ file as the GPX it is turned
  into, and the folders of a dropped
  folder are made as they are; a file the Stash keeps already, wherever, is left out
  and counted, and so is a file of any other kind. While a long import runs, the Stash
  lists every ten seconds what it has kept so far, after what it held, and in order
  once the import is done. On any other folder or the top, a file becomes a trip and a dropped folder
  is imported as the folder tree above says. Exported trips in dropped folders and in
  zips come back as they were.
- A duplicates report, switched on by its icon beside the trips' search, in the pane
  between the library and the map: the routes kept more than once across all trips
  and collections, grouped as exact copies (the same points or the same line, whatever
  the date) or as the same ride kept twice (the same way within a kilometre at both
  ends, lengths within a tenth, nine in ten of each line's points within 75 m of the
  other, on the same date or an undated day). Like is compared with like: a planned
  route and a track of the same way are never duplicates of each other. A day that holds
  the same route twice, or the same track, is listed as any other. A click or a tap selects a route, Cmd or Ctrl one more,
  Shift a run of them; a route's pad adds it or takes it away; a selected row is highlighted.
  A row says whether it is a route or a track, since a planned route and the track of
  the same way are often both wanted, and where it is by the folders its trip is in, the trip and the day,
  so that routes of one trip or of one folder read alike and a whole trip or folder
  kept twice shows as such.
  The map draws the selected routes and brings them into view, each in a colour of its
  own that its row shows as well, the first eight selected, so that they are compared at a
  glance. The menu (right-click or long press) opens the location of a single route: its
  trip opens at its day, the library shows the trip's tab and its folder, and the
  report stays in the pane beside it; the pad on the trip's row gives the pane to
  the trip. The menu also copies or deletes the
  selected ones, as Ctrl+C and Delete do. A pad that opens a trip, a day's contents or a category's places takes the pane for
  itself as well. The report is made once and kept while the page stands: shown again,
  it is there at once, where it was scrolled to; what is deleted from it is taken out
  of it, its heading says when it was made, and the button there makes it afresh. A
  route deleted from the open trip leaves it as an edit that can be undone. While it is made, which takes a
  while on a large library, a ring turns beside how many routes are compared and the
  seconds gone.
- Convert, in the menu of a day or section, of a route and of several selected stops,
  with what the part can be turned into as its submenu. A conversion of a route or a
  track makes a new one right after it and leaves what it was made of as it is, so
  that nothing is lost by it. "Track to route…", in its dialog, makes a route of a
  track. "Route to track" makes a track of a route: its line as it runs, kept as it
  is, with no points of its own. It is greyed out while legs of the route wait for
  their routing or failed it, and a route of fewer than two points has none. A track
  made of a route and a route made of that track again has points all along its
  line: that is how a route that came with two points and the way a planner had
  calculated between them gets one beside it that can be edited. A route whose legs still run along the way its file calculated says so
  on its row by a chip, "Original way", with how many of its legs do where not all
  do; the chip goes as those legs are routed again. The first edit that would route
  such a way again (a point moved, added on it or removed, another profile, Reroute)
  is asked about before it is made: the original is kept as a track beside the route
  and the edit made, or the edit made without, or left. A route is asked about once. Nothing else a file's route or track carries (times,
  elevation, lean angles, accelerations, what DMD or Rumo wrote) is kept in a trip, so
  a trip's rows have no chips for it. The free stops of
  a day or section, or those selected, become a route ("Waypoints to route", in a trip
  "Stops to route"), for a file that kept a route as a string of waypoints, which a
  collection keeps in the file's order: "By order" takes them all, top down; "By
  number" takes those numbered in a series, named alike but for the number at the end
  ("Position 1", "Position 2", …), in the order of their numbers, and leaves a
  waypoint among them that is a place as it is. Each says how many it takes, and is
  there only where it takes two or more: stops that stand on the points of a route are
  that route's already, and a selection of those alone has no Convert. The stops
  become the points of a new route, its legs routed, and are stops no more. One step
  to undo. A list of places has no Convert.
- Lists of the user's own places, in the Places folder: a list is a collection, opened
  like a trip but with sections instead of days and no dates, times, journal, tools or
  export; its sections are the kinds of its places ("Place category…" under New in
  the list's menu), and a kind lists its places by name. A place is a stop without the
  fields of a ride (arrival, pause, booking reference, optional): symbol, name,
  address, contact, website and notes, edited in the stop's dialog and copied, cut
  and removed from its menu. A list takes places alone: stops of trips, places, the
  waypoints of files of the Stash, and categories, which are pasted as their places;
  routes, days, media and recordings are not offered there. A copied place goes with
  its category: onto a list's row into the category of that name, made where the list
  has none; onto a category into that one; onto a day of a trip as a free stop. A
  category cut and pasted onto another of its list is merged into it. "Add place…" in the map's menu adds
  one to the kind shown. A waypoint's link becomes the place's website; where most
  waypoints of a file link to the same host, such as the directory the file was
  downloaded from, those links are left out and the place's own link is kept.
- The user's own places on the map while planning: in the Places tab every kind of a
  list, open or not, has the switch and the gear the standard kinds have (see Places on
  the map). A place is a dot in its kind's colour, or the badge picked for the kind; a
  tap says its name, list and kind, address, contact, notes and website, and with a
  day of a trip shown offers "Add as stop", which adds a copy of the place to the day
  as a free stop. The places of the open list's kind shown in its pane are its stops and
  drawn as those, wearing their kind's look, its badge picked or its list's dot, in the
  list as on the map;
  the list's other kinds follow their switches as any list's do. A
  kind's row shows its look: the badge picked, or the dot in its list's colour.
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

- Recordings on a day: a ride is kept once, as the GPX file its tracker wrote, and is
  on any number of days of any trips or collections. *Add recording…* in the day's
  menu or under the opened day takes a GPX file of one track, such as Ridelink's or
  Scenic's (waypoints in it are left aside); the file is kept as it is, with every
  value it measured per point, and one kept already is put on the day as the ride it
  is. A day's recordings are listed under it by when they began, each in its own
  colour, and those on the map are drawn in that colour under the planned routes.
  A recording's menu renames the ride, cuts, copies and moves it to another day, and
  takes it off the day, which leaves it among the rides; several are selected as
  routes are, and the menu then acts on all of them. Copied recordings paste onto any
  day, of this trip or another, and are then on both; cut ones leave the day they
  were cut from. A single copied recording also pastes as a track route, to plan from
  it; nothing else becomes a recording than a recorded file. A recording's row says
  when it began and how long it is, or that its file has no times. Removing a day, a
  trip or a collection takes its rides off it and deletes none.
- Recordings, the library by when it was ridden: the tab lists every ride the user
  keeps by when it began, while the pane of the day picked stays beside it. Years, the latest unfolded, hold months, and a month the days ridden on, each
  heading with its days and its length; a day is a card with its date and length over
  its rides, since a tracker starts a new file after a break: when each began, its
  name, its length and the days it is on, each as a trip and its day, or "On no day
  yet". Rides without times stand in a card of their own at the end. The plus in the
  line under the tabs, and GPX files or folders dropped on the library while the tab is shown, keep files as rides: a
  file kept already is left out, so a tracker's folder can be dropped again as it
  grows, and it is said above the rides how many were kept and how many were there already. A
  click or tap opens a ride as a recording on a day is opened: whole on the map, with
  its figures, its line coloured by a measure and its charts, without a day to be on;
  a click on the opened one closes it. Cmd or Ctrl with a click selects a ride, and the
  first such click also the ride opened by the click before it; Shift a
  run, its pad adds it or takes it away; a day's or a month's heading selects all its
  rides, for the menu to act on together. A ride's pin keeps it on the map as a
  recording, as a pin does on a day, each in a colour its row shows, so that rides of
  different years are looked at together, and the opened ride is compared with the one
  pinned beside it as on a day. The rides' pins are not the open trip's: they stay for
  the page, whatever trip is opened. A ride's menu renames it, copies it
  to be pasted onto a day, opens a day it is on,
  in the tab its trip is in, and deletes it with its file, from every day it
  is on, after a question; with several selected it copies, pins, unpins, adds and
  deletes all of them. A recording's menu on its day has "Show in Recordings", which
  leaves the day's tab as its button does, keeping what it had open for the way back,
  and shows the rides with that ride opened, selected and in view.
- Autoname, in a ride's menu: the selected rides are named after the places they began
  and ended in, as "Hockenheim - Walldorf", for files an app names all alike. The
  places are asked of Nominatim, one a second, each position once; it is said above
  the rides how far it is and which rides it could not name.
- Merge, in a ride's menu: the selected rides, where they follow one another with no
  other ride between them and all tell their times, become one, for a tracker that
  starts a new file after every break. The files are joined as the segments of one
  track, every point as recorded; the merged ride is on every day one of them was on
  and is named after where it begins and ends. The files merged are deleted and stay
  known: dropped again, they are kept already. Before it merges, the planner says how
  many it merges and, for a joint after a pause of more than six hours or over more
  than 150 m, the pause and the way, across which the merged ride is a straight line.
- Suggested days: the magnifier over the rides looks through every day of every trip
  for the rides that are on no day, as a day's lookup does for one, and lists what it
  finds above the rides, those of a day's date first, then the nearest: the trip and
  its day over the date of the riding, its ride or how many files, its length and why
  it was found. A click shows the rides on the map and the day's routes with them,
  looked at, without leaving the tab or opening its trip, and marks the suggestion for as long as its rides
  are the ones shown. The rides are drawn in red, narrow over the routes, so that a
  route shows on both sides of a ride that followed it and each shows alone where
  they part; a route in the palette's magenta, which reads as that red, is drawn in
  its blue meanwhile. A day's lookup shows what it found the same way; the tick puts the rides on the day, the cross says
  they are not of it, which is remembered, so that they are not suggested for it
  again. Either way the suggestion leaves the list. While it looks, it says how many
  days it has looked through.
- Looking up a day's rides: *Find recordings…* beside *Add recording…* on a trip's
  day goes through all the user's rides and lists the days of riding that may be the
  day's: begun on its date, or ridden along its routes, or its routes along them, a
  part of the day being enough. The files of one date are judged together, so that a
  day recorded in pieces is found as one. A row says its date, its ride or how many
  files it has, its length and why it was found; a click shows its lines on the map,
  the plus puts its rides on the day. Rides that are on the day already are not listed
  again, and a ride on another day is found as any other.
- A lock among the map's controls keeps the view: while it is locked, taking up another
  day, route, stop, recording or ride leaves the map where it is, zoomed as it is, so
  that one place can be looked at in one after the other. The place search and the
  button that shows where the user is still move it. The lock is open when the page
  is loaded.
- A pin among the map's controls, above the lock, hides every place for now, the standard ones and the
  user's own, whatever their kinds are set to, for a clean screenshot of a route or
  where places crowd it; pressed again, they are back as they were. The places are
  shown again when the page is loaded.
- What is on the map follows what is taken up. With the whole trip shown, or a day and
  nothing taken up, the planned routes and tracks are all drawn, and no recordings.
  Taking up a route or opening a recording draws that one alone. One thing is taken up
  at a time: taking up a route closes the recording opened, and opening a recording
  lets go of the route taken up. Every route and every recording has a pin on
  its row: pinned, it stays on the map whatever else is taken up, whatever day is
  shown and whatever trip is open, until it is let go of on its row. Several selected
  are pinned or let go from their menu. A pinned route of another day is drawn as the
  neighbouring days are, one of another trip as a plain line in its colour, as it
  stood when its trip was left. The pins go when the page is loaded again, and with a
  trip that is deleted. A recording added to a day, or put on
  it by the lookup, is not pinned. Another day closes the recording opened, as it lets
  go of the route taken up.
- A route under a mouse's pointer on the map is drawn wider and named, after its day while the
  whole trip is shown; a click or a tap on it shows its day and takes the route up, as a
  click on its row does, which is brought into view. This holds while nothing is taken up:
  a route, a track or a recording taken up leads, and a click on another line on the map
  neither takes that up nor names it; a click on the opened recording's own line picks
  its point, and while a route is edited a tap does the tool's work.
- A recording's figures: a click on it shows it whole, and round buttons take the place
  search's place over the map: the facts, one for each focus the file allows, and one
  that closes the figures. The facts, hidden at first, are its distance, time and
  moving time, average and top speed, climb and descent, lowest and highest point and
  furthest lean to either side, as far as its file has the values, and what the file is
  like, to tell which of two recordings of one ride is the better: what wrote it, how
  many points it has, the usual time and the average way from one to the next, its
  segments where it has more than one, and what it tells of each point, by the names the
  file has for it, with the share of the points that have it where not all do.
  A focus button picks what to look at, and its button again lets go of it: speed, the
  distance and speed against what it is compared with, the road surface, altitude,
  slope, lean angle and lean against the other, in that order, the ones nearly every
  recording has first, so that a button keeps its place from one recording to the
  next. The focus colours the line, opens a card of the figures that belong to it alone
  with the legend of the colours, and a chart along the bottom of it along the way and,
  for speed, slope and lean angle, how far was ridden at each value; with none, the line
  has the recording's colour and neither card nor chart shows. The surfaces, matched once
  by the routing server, are listed with the distance on each. Pointing in the chart
  marks the place on the map, and a click there moves the map to it. A point is said in
  a popup that follows the mouse along the line and goes when it leaves it: the value
  focused on, or the differences of a difference (the distance from the other, or the
  speed against it and the time ahead or behind); with no focus, everything known of it
  (the distance along, the time, the measures, the surface and the file's other
  values); a click on the line, or in the chart, pins the popup there, another click on
  the line moves it, and closing it lets it follow the mouse again.
- Comparing a recording: the recording opened is compared with what is pinned beside
  it on the map where that is one route or track of its day or one other recording;
  with two or more pinned there is no comparison, and the focus offers the measures
  alone. Something new to compare with turns the focus to the distance from it where no
  focus is chosen. A focus chosen stays for the page, whatever route, track, recording
  or trip comes next; a recording that does not allow it shows none until one that does
  is opened. Against
  a route or a track the card says what it is against, how far it went off and how far
  at most, and follows the route as it is edited. What it is compared with is named once,
  among the recording's facts; the focus cards are called Compare distance, Compare speed
  and Compare lean. Against another recording it also
  says the time ahead or behind at the end and the speed difference on average, at the
  same places along the way. The focus offers the distance from the other, and speed
  and lean against another recording, each charted along the way. Focused on a
  difference, the line is coloured where the two run together and both have the value,
  and dimmed elsewhere, as is the other recording where the opened one did not run
  along it; speed and lean against the other are written with their sign, + for more
  and − for less; the speed against the other is coloured on a scale as wide as
  its differences there, in whole km/h below 10. The point picked says how it differs
  there.
- Section lookup: with a ride opened in the Recordings tab, Cmd-click (Ctrl-click) on
  its line marks one end of a section and a second Cmd-click the other. The list of
  rides then holds only the rides that rode that section in the same direction, under
  a line that names its length, whose ✕ lets go of the section. A ride opened shows its
  figures, focus cards, chart and point popup for the section alone, with the rest of
  it dimmed; the one ride pinned beside it is compared with it on the section, so that
  two passes of one road are set against each other, and is itself drawn bright on the
  section alone. With more than one pinned there is no comparison.
- Additional media on a day: files and links kept with it, listed in the day's pane under
  their own heading after Planning (the day's routes and stops) and Recordings. Files
  are picked, as many at once as wanted, and may be of any kind; a link is given a name
  and its address, and shows the name over the address without its scheme, cut where
  it is long. A click opens an image or a PDF over the page, the PDF in the browser's
  own viewer, or in a new tab where the browser has none; a link opens in a new tab;
  any other file is downloaded. Media are renamed (a link edited), selected with Cmd,
  Ctrl or Shift, moved to another day, cut, copied and pasted onto a day of any trip,
  and deleted, from their menu and by the keys of the file verbs. They go with their
  day: removed with it after a question that names them, copied with a duplicated
  trip, moved with a merged one, written into the exported zip and read back from it.
  They are the owner's alone: a shared link shows none of them. A
  section of a collection lists the media it has, under the same heading.
- Files that come with an import: the files in a folder that are neither GPX nor
  hidden are kept with what the folder becomes: a trip made of a folder keeps them
  with its first day, from where they are moved to the day they belong to. Files
  added to a trip from its menu go the same way. The Stash keeps files of routes
  alone and leaves the others out.
- A journal of the trip, read as a document: the trip's own entries as its
  introduction, then a chapter for each day with the entries on the day, its routes
  and its stops. An entry is a text, written as Markdown, or a file (a photo, a
  receipt, a document) with a text, which is a photo's caption. It is linked to the
  trip, a day, a route or track, or a stop, and may stand at a place on the map.
  - A new entry is written in a small window over the map: from the notebook on a
    route's, a track's or a stop's row, which counts their entries, or from the map's
    menu at a spot, on the route being edited or else on the day shown. It takes a
    text, any number of files, or both.
  - A day's journal takes the place of the day's contents in their pane, from the
    notebook on the day's row or in the pane's head, for as long as the pane stands:
    closed and opened again by the pad, the pane has the contents. Its entries are rows: dragged
    into order by their grip, their text written in place and saved as it is written,
    photos put in the order they were taken by one button. A row's menu links it to
    the day, one of its routes or one of its stops, moves it to another chapter, and
    deletes it. A new entry is written under the rows.
  - The journal of the whole trip opens over the page from the notebook in the head of
    the trip's pane, or from Journal and sharing… on the trip: every chapter under the other, where a row is also dragged into another
    chapter. Beside it stands the trip's page as a visitor gets it, which follows what
    is written, the journal on it also before it is published; without room for both,
    the page opens in a window of its own and follows from there. Above both is what
    the page shows to whom: whether it is shared under a link, with the link to copy,
    whether the journal is on it, whether it offers GPX files, which of the trip's
    routes and tracks it has, its cover, which a
    photo is made from its row's menu, and the owner's own page for printing.
  - Photos and files are sent in the background, one after the other, while the page
    is used; the page says how many are on their way and lists what failed, to be
    tried again or dropped.
  - A photo's time and position are read from its EXIF data: it is shown with the time
    it was taken and stands on the map where it was taken. A photo with a position
    says it under its time; while the entry stands elsewhere or is off the map, that
    is a link that puts it there. A photo without a position that stands nowhere has
    "Add location" there: coordinates typed or pasted in, as decimal degrees or as
    degrees, minutes and seconds, with or without the letters of the hemispheres, put
    it on the map. Photos added to the trip
    itself go to the days of their dates. An entry's place is changed by dragging its
    marker; from its menu an entry is put on the map, put back where its photo was
    taken, or taken off the map.
  - A photo is made into a JPEG of at most 2560 px in the browser before it is
    uploaded, HEIC included, with its EXIF kept, so that a phone sends little and
    every browser shows it. A photo opens large over the page from its row or its
    marker on the map, in the planner and on the read-only page alike; other files
    open or download under their name.
  - An entry on a route or a stop that is removed stays in its day's chapter; one whose
    day is removed stays with the trip.
- A trip is planned or done; the library marks done trips.
- A page of the trip for reading and printing, the owner's or shared under a link that
  needs no sign-in and can be withdrawn. It has two forms:
  - The plan, while the page has no journal: the trip's cover, its length in days and
    kilometres and its dates, its name and description, the map with every day and its
    stops, and the days one under the other, each with its number, date, name, length
    and times, what was noted about it, its stops in riding order with their times and
    notes, the shape of its route and its GPX file.
  - The story, once it has a journal: the journal as a document, with the map beside it.
    The head and the trip's own entries come first, then the days to jump to, then a
    chapter for each day: its number and date, its name, its length, the shape of its
    route, the plan of the day folded under "Route and stops", and what was written and
    photographed. Texts are Markdown. A text that is a YouTube address is
    the video, with the lines after it as its caption; it plays without sound while it
    is scrolled to, one video at a time. Photos that follow each other are one gallery:
    one as wide as the text, or half of it in the middle where it is higher than wide, two side by side, at their shape where both are higher than wide, more in rows of three, each with its caption
    under it and, where it has a place, a pin on it that shows it on the map; a click
    opens a photo large, with the others of the gallery a step away by the arrows.
  - The map flies to what is read: a day is seen at a tilt and turned a little to
    fill the map, an entry's place closer and steeper with a ring going out from it,
    the whole trip from above. Where an entry itself stands, a photo's place, the map
    goes closer, to where its scale reads some 300 m, and the photo read is larger on the map than the others.
    Going to an entry by its button answers with one stronger ring, also where the map
    is there already. A photo on the map is called by its caption, never by its
    file's name. The stops' names stand a little off their pins with a
    line to them, on a translucent ground, set so that they lie on nothing else, and
    come in one after the other when the map is there; the entries of the day pop in
    likewise. With reduced motion the map jumps and stays seen from above.
  - The map follows what is read, down to the last day, also where that is too short
    to be scrolled up the page. The day being read stands out and fills the map with
    its stops and the photos and notes that stand somewhere on it; an entry with a place
    is gone to when it is read. A button on such an entry shows it on the map, a marker
    on the map goes to where it is told of, and the map's card names what is shown and
    has every day to go to, each as wide as the day is long, and the whole trip. On a
    narrow screen, and on a tablet held upright, the map is a band above the text.
  - Where the page scrolls over the map (the plan's map, and the story's while it is a
    band above the text), one finger or the wheel scrolls the page and the map takes two
    fingers, or the wheel with Ctrl.
  - It is set in a serif for reading, follows the visitor's light or dark scheme, and
    prints top to bottom: the map with the whole trip, then the text with everything
    unfolded.
  - It offers each route and track as a GPX file of its own, with the stops on it, so
    that a file is one line, which is what most navigation devices take a file to be.
    A day of one route has the one file of the day; a trip of one route has it in the
    page's head. There is no file of the whole trip.
  - The owner's own page has everything, a stop's contact and booking reference
    included. The shared page never has those two, and has only the routes and tracks
    the owner leaves on it: one that is left out is neither on its map, nor in its
    distances, nor among its files, and the stops bound to it go with it. The journal
    and its photos are on the shared page once the owner switches them on, and the GPX
    files unless the owner switches them off. A link to the shared page
    previews with the trip's name, description and card: the routes on the page on a
    map without names, tilted and turned to fill the picture, and under it the trip's
    name and the places its days begin and end at, each named once while the trip
    stays there ("Hockenheim – La Bresse – Hockenheim"); of more places than two lines
    hold, those in the middle give way to a mark, so that the first and the last are
    always named. The card is made in the
    owner's browser while the journal's page settings are shown, anew when the name
    or a route on the page changed; a page without a card previews with its cover. The photos on the shared page
    are pictures made of the uploads: they carry no position and nothing else of what
    the camera wrote into the file.

- A place and address search over the map, by Nominatim on Enter: the first place found
  gets a pin and the map flies there, the others are listed to pick from. The pin stays
  until the search is cleared; while a route is edited, its menu adds a point or a stop
  there.
- A base map to choose on the map: OpenFreeMap's Liberty, Bright, Positron and Dark
  styles, or the OpenTopoMap, OpenStreetMap, CyclOSM, TopPlusOpen and Esri
  satellite raster tiles; the route lines
  and markers stay. A locate-me button shows where the browser is. The interface light
  or dark by hand, or as the browser says. Both choices are kept in the browser.
- The distance to the nearest route or track, switched on by a button among the map's
  controls: a slim dashed line from a mark to the nearest place on any line the map
  draws at that moment (the open trip's days shown, a trip looked at, what is pinned,
  recordings, rides and files of the Stash), labelled with how far that is as the
  crow flies. The mark starts where the device is, read once; it is dragged to
  measure from another place, and the line and its distance follow as it moves and
  as what the map draws changes. Switched off and on again, the mark is back where
  the device is. Where the device does not say where it is, the mark starts in the
  middle of the map. The map stays where it is: the label stands on the part of the
  line that is in view, so the distance is read also while the mark is far outside,
  and beside the mark where the line is too short to bear it. Nothing of it is kept.
- Overlays to switch on over the base map, each with a button of its sign among the
  map's controls, kept in the browser:
  the roadworks Rhineland-Palatinate's and Baden-Württemberg's services list, as a line
  with a warning sign, a red ring where the road is closed, diversions in blue and works
  yet to begin in grey, where a tap on a site says the road, the kind of work, its dates
  and who reports it; and the roads closed to motorcycles in Germany, Austria,
  Switzerland, the Netherlands and Belgium as mintelonline.de collects them, a motorcycle
  in a red ring where one begins, where a tap says when and for whom it holds. Signs and
  lines of both grow with the zoom, so that they stay wider than the road under them.
- "My rides", a third overlay: every ride the user keeps, on a day or on none,
  drawn at once as a translucent line each. A
  road ridden often is drawn darker, one ridden once lightly, and where nothing is
  drawn the user has not been. A tap on a line says which ride it is: its name, when
  it began, its length and the trips or collections it is on a day of. The overlay is under
  the trip's own lines, so that it can stay on while planning, and how opaque one ride
  is drawn is set in the settings. It reads the rides anew each time it is switched
  on.
- Places on the map from the planner's own store of OpenStreetMap data: fuel stations,
  hotels, restaurants, cafes, viewpoints and parking, under "Standard" on top of the
  Places tab. Each kind's switch goes through all in view (from zoom 10 on), those
  along what is looked at, and none: along the recording opened or the route taken up,
  else along the selected day's routes; without a day shown, "along" shows none.
  Its gear opens the kind's settings: how far from a route its places are still shown
  along it, 200 m to begin with, and the badge they are drawn with, one of the kinds'
  badges. The switches are kept for the browser, the settings with the account. A tap on a place shows name, address, cuisine, opening hours, phone and links to
  its homepage and OpenStreetMap. The store is filled area by area by `make places`, which lists
  the areas to pick from when run without one, and names those of which a kind of place
  is behind the others or missing. `make update-places` fetches what is missing: for
  every area that has places, the kinds never fetched for it, and nothing else.
- Settings under the gear at the right of the library's tabs, in the pane where the
  other tabs show their tree, by section, each kept as soon as it changes. User: the
  language, kept in the browser, and the password, changed with the one in use. Map:
  light or dark colours, kept in the browser; kept with the account, how wide route
  lines are drawn, how routes get their colours, and how opaque a ride is in the
  overlay of all rides. A kind of place has its own settings, in the Places tab.
- Route lines in colour: one colour for each day, or the palette's next colour for each
  route of the trip, as the settings say; a route's menu gives it a colour of its own,
  which it keeps wherever it is drawn. A route's row shows its colour. Lines are 5 pixels
  wide unless set otherwise, and grow wider when zoomed in: those of routes, of
  recordings and of the routes the duplicates report and a day's lookup draw alike.
- A spot of the map opened in Google Maps, OpenStreetMap or Google Street View, from the map's menu.
- Loading the page again comes back to where it was: the folder shown, the open trip, its
  selected day, the route being edited, the day whose contents are open, the trip
  looked at and the map's view are kept in the address, which
  can be bookmarked or opened on another device.
- English and German. The planner follows the browser's language, or the one chosen in
  its settings, kept in the browser; numbers, dates and distances
  are written the language's way. The server's pages, messages and mails follow the
  browser's language, and the GPX export names unnamed days and routes ("Tag 1",
  "Route 2") in the planner's.
