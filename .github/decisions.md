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
