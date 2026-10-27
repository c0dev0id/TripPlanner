# Decisions

Brief context and rationale for choices that are not obvious from the code. Newest
entries at the end of their section.

## Model

- **A trip is days of stops with routes between them.** A route planner's model, one line
  with waypoints, cannot hold what a multi-day trip is made of: timed breaks, a lunch at a
  fixed time, loops from one hotel, alternatives, bookings. The spine is therefore a
  calendar: a trip has days, a day has stops in order, and between consecutive stops there
  are routes. Everything else (times, attachments, comments) hangs on one of these.
- **Roads to drive and points to stop; nothing is mandatory or optional by model.** A first
  draft made stops mandatory and put optionality into alternative routes and a separate
  POI entity, so that skipping a stop would still leave a defined route. That models a
  graph of what might happen instead of a plan. A stop has an arrival time and a pause
  where they matter and an `optional` flag that means whatever the user wants it to mean;
  a route has the same flag. Several routes between the same two stops are alternatives;
  the timeline follows the first that is not optional.
- **Places are kept apart from stops.** A base-camp trip references one hotel from the end
  of one day and the start of the next for several days. Its name, address, phone, booking
  reference and receipt belong to the place once; the arrival time belongs to the evening.
  A stop therefore points to a place.
- **A route's points and legs are one JSON value.** The editor works on a route as a unit,
  as Layer Slayer's does: a list of points and a map from leg key (profile and both ends)
  to geometry. Nothing queries single points, so rows per point would add joins and
  ordering for no gain. The row carries distance and duration beside the JSON for the
  timeline and the library view.
- **The schedule check is the feature.** OSRM returns a duration with every leg. The
  departure plus route durations plus pauses, compared with the fixed arrival times, tells
  before the trip where a day does not work. This is what the times on stops are for.
- **A route's points include its two stops' positions.** The first and last point of a
  route are the positions of the stops it joins; one pass after every edit
  (`alignRouteEnds`) keeps them equal to the places, dropping the legs that touched a
  moved stop. The alternative, points between the stops only, would have needed every
  leg function to take the stops' positions from outside and a flag of the route's own
  for a straight last leg. With the ends inside, Layer Slayer's legs and edits port
  unchanged, a route is complete geometry on its own for the export, and the server
  checks the invariant when it validates a document.
- **Legs carry distance and duration, not geometry alone.** OSRM answers all three at
  once; the day's distance shows now, and the timeline of phase 2 needs the durations
  without routing everything again.
- **A tap on a route adds a stop there; elsewhere at the end of the day.** One tool for
  stops, with the line hit-tested within the tap's reach, rather than separate append
  and insert tools as in Layer Slayer: planning a day is mostly "and a stop in between".
  A stop on the line splits the route at the leg hit, the points before staying with the
  first half and the points after going to the second. Removing a middle stop joins the
  two routes without the removed stop's position: whoever removes the stop does not want
  to go there.
- **The editor acts on the selected day only.** Its stops are numbered, named and
  draggable, its routes drawn in colour; the other days' stops are small grey dots and
  their routes grey lines that let taps through. The routing pump serves the selected
  day's legs first. Everything a day needs sits in the panel beside it.

## Saving

- **The trip is saved as one document.** The client holds the whole trip, edits it with
  pure functions and an undo history exactly as Layer Slayer's route store does, and
  saves it as one `PUT` 1.5 s after the last change. Fine-grained requests per stop or
  point would have turned undo into a problem of reversing requests. The document carries
  the version it was loaded at; the server refuses a save over a newer version (409) and
  the app offers to reload, which is enough while a trip has one editor.
- **Parts carry client-generated ids and are upserted.** The server upserts each place,
  day, stop and route by id and deletes the rows the document no longer holds, rather
  than deleting and reinserting: attachments of phase 4 will reference stops and routes
  by id and must survive a save. Trips themselves are created by the server with integer
  ids; a trip is the root the library works with, its content is the document.
- **Leaving the page.** The autosave flushes with a keep-alive request when the page is
  hidden, and `beforeunload` warns while a change is unsaved. A keep-alive request may
  carry at most 64 KB, so a large trip left in the last second before closing the tab
  relies on the warning.

## Export

- **One track per route, waypoints once per place.** A GPX file holds the places of the
  stops in scope as waypoints, each once however many stops use it, with the place's kind
  as the waypoint type, and each route as a track named "Day N name: from – to", so that
  a device lists the day's legs in order. A leg not routed yet is written as the straight
  line between its ends.
- **API paths carry no file extension.** The per-day zip is `gpx?per=day`, not `gpx.zip`:
  PHP's built-in server answers a path with an extension as a static file and never
  reaches the front controller, and nothing is gained by the extension.

## Testing

- **The HTTP layer is checked by a scripted browser run, not in CI.** PHPUnit covers the
  repositories, the validator and the export; Vitest the pure modules and the store. The
  pages and the editor are exercised with Playwright against `php -S` by hand: sign-up
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
