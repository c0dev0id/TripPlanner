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
- **Legs carry distance and duration, not geometry alone.** OSRM answers all three at
  once; a route's distance and a stop's distance from the start show now, and the
  timeline needs the durations without routing everything again.
- **The profile belongs to the route.** A day with a ride, a hike and a ride is three
  routes with three profiles; the toolbar sets the profile of the route being edited.
- **The schedule check is the feature.** OSRM returns a duration with every leg. The
  departure plus route durations plus pauses, compared with the fixed arrival times, tells
  before the trip where a day does not work. This is what the times on stops are for.
- **Editing is a mode of one route.** Selecting a day shows it: its routes in colour, its
  stops as pins, the days before and after dimmed for orientation (switchable). Editing a
  route shows its route points as draggable dots and the tools: a tap appends a point or
  inserts one on the line, a tap with the stop tool makes a stop (bound where it hits a
  point or the line, free elsewhere), the delete tool removes. The routing pump serves
  the edited route's legs first. The panel lists the day's routes and its stops in riding
  order with their distance from the start, with the plain route points shown on request,
  and pans the map to what is clicked.

- **Esc steps back one level at a time.** While a route is edited, Esc closes an open menu,
  else returns to the point tool, else ends editing. One key for "get me out of this",
  without ever doing more than the next step back.

## Library

- **Rearranging is a menu per row, not drag and drop.** Each day, route, stop and trip
  has a dots menu with move up, move down, duplicate, move or copy to another day,
  remove. Drag and drop needs a library or a few hundred lines, fights the map's own
  dragging on touch screens, and the lists are short. The row menus and the map's
  context menus are one mechanism: one open menu at a time, at a viewport position,
  closed by a click elsewhere or Esc. A duplicated day gets no date,
  since the day's date would clash with the original's; a duplicated route keeps its
  points but not the stops, which belong to the day; a route moved to another day takes
  the stops bound to its points along, a stop copied to another day arrives free. A trip
  is copied on the server with new ids for every part, so the copy's parts never name the
  original's.

- **Folders are one level deep.** A trip is in one folder or in none. Trips sort by year
  or region in practice; nesting would add paths and moves for a handful of trips.
- **The search runs in the browser.** The library loads all trip summaries and folders of
  the user (a few hundred small rows at most for a personal planner) and filters them by
  name; the results are capped at twenty. A server search would add an endpoint for
  data the client already holds.

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
- **Positions are rounded in the store actions.** Leg keys are built from coordinates as
  text, in the browser and in PHP, and agree only for coordinates of at most six
  decimals. Rounding where coordinates enter the document, the store's actions, keeps
  that an invariant of the model rather than something every map handler remembers.
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
  time plus the pause. Where the ride gets there early the stop shows the waiting; where
  it would get there late the stop shows by how much the ride is short, and the day
  counts such stops. Nothing is corrected: whether to leave earlier, shorten a pause,
  move the stop or ignore a pessimistic calculation is the user's call, and a corrected
  arrival would disagree with the time the stop says. Stops before the first timed one
  have no times, and a day without a timed stop has distances only. All of this is
  planned time: nothing is compared with the clock, and matching the plan against the
  ride as it happens is a navigation system's job, not this tool's.
- **Untimed legs ride at 50 km/h.** OSRM gives every routed leg its duration. A straight
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
  between its points, simplified to 500 at most, so that it keeps its shape and stays
  editable like any route; the kind is shown instead of a profile. Waypoints become stops,
  bound where they stand on a route point, so that this planner's own export comes back
  as it went out. The alternative, a separate immutable track object, would have needed
  its own drawing, editing and export paths for little gain.
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
  repositories, the validator and the export; Vitest the pure modules and the store. The
  pages and the editor are exercised with Playwright against `php -S` by hand: sign-up,
  a route with the point, stop and delete tools, free stops connected and disconnected,
  the stop dialog, neighbouring days, folders and the search, the GPX import and the
  export dialog, the journal with a photo placed by its EXIF data, the trip's state,
  sharing and the read-only page as a guest, and then
  from the mailed link, a trip with stops added by tapping, routing, the line tools, undo
  and redo, the save, a reload and the downloads. Routing in that run answers from a mock
  where OSRM cannot be reached. Keeping it in CI would mean a browser and a PHP server in
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
  database. Migrations start with the first release.
- **Sign-up by invitation.** Open sign-up on a hobby server with photo uploads invites
  abuse. Visitors leave their e-mail on a waiting list; an admin sends an invitation link
  by mail; the link opens sign-up for that address. The address is verified by
  construction, so there is no separate verification step. Open sign-up can be switched
  on later.
- **Export runs on the server, import in the browser.** The data is in SQLite; GPX writing
  and a zip of per-day files are a read of the database, and a download is a URL that can
  be bookmarked. Import needs the editor's context (which day, which gap) and the routing
  of imported legs, so it stays in the browser, ported from Layer Slayer.
- **Routing in the browser by FOSSGIS OSRM.** The same pattern as Layer Slayer: one request
  per 1.1 s per browser, attribution shown, no server in between. The leg key (profile,
  from, to) does not name an engine. Valhalla is the option for later: its motorcycle
  costing (beta) knows `use_highways` and `use_trails`, answers in polyline6 like OSRM, and
  FOSSGIS runs a public instance at valhalla1.openstreetmap.de whose terms of use have not
  been checked.
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
