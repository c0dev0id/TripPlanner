# Software stack

## Server

- OpenBSD with httpd and php-fpm. php-fpm runs chrooted to `/var/www`, so the application,
  its data and the SQLite file live below that directory.
- PHP 8.4 with pdo_sqlite, sqlite3, zip, gd, intl, curl, xsl, and the core exif and
  fileinfo extensions: gd makes the journal's image previews, fileinfo tells uploaded
  files' types, exif reads when and where a photo was taken (without exif, photos are
  kept but not placed).
- The journal's files are uploads: httpd's `connection max request body` (1 MB by
  default, answered with 413 above it) and php-fpm's `upload_max_filesize` and
  `post_max_size` (2 MB and 8 MB by default) bound a photo's size; phone photos need
  20 MB or so from all three, although a photo arrives as a JPEG of at most 2560 px made
  in the browser (see the frontend). JPEG, PNG and WebP get a preview; a JPEG its EXIF
  placement.
- A save sends the whole trip as one JSON body, so the same request body limits bound a
  trip's size. Tracks are stored as encoded lines of some six bytes a point: an imported
  trip of 1.5 million track points and 5,000 waypoints is an 8.4 MB body, which PHP
  checks and stores in about a second and under 100 MB.
- SQLite in WAL mode with foreign keys on, one database file.
- Mail over SMTP to the local smtpd at 127.0.0.1:25; PHP's `mail()` is not used (no
  sendmail inside the chroot).
- Composer packages: Slim 4.15 (routing, middleware, PSR-7 through slim/psr7 1.8), PHP-DI 7
  (container, autowiring), league/plates 3.6 (templates of the public pages), slim/csrf 1.5
  (form tokens), PHPMailer 7 (SMTP). PHPUnit 12 for tests.

## Frontend

- SolidJS 1.9 (UI and state), Vite 7 (build; see decisions.md for why not 8), TypeScript 7
  (type checking), Vitest 5 with jsdom for unit tests of the pure modules. Two entries:
  the planner app and the read-only trip page.
- MapLibre GL JS 6 (map rendering, Web Mercator).
- libheif-js 1.23 (libheif compiled to WebAssembly, LGPL): decodes a HEIC in browsers that
  cannot, loaded on demand as a chunk of its own, about 2 MB.
- Route tool, GPX reading, line simplification and polyline handling ported from Layer Slayer.
- Routing by the FOSSGIS Valhalla server (valhalla1.openstreetmap.de): at most one request
  per second, attribution shown. The profiles are Valhalla's motorcycle, bicycle and
  pedestrian costings by name; the motorcycle takes the `use_highways` option.
- Garmin's waypoint symbol pictures from GPS Visualizer's copies
  (gpsvisualizer.com/google_maps/icons/garmin/24x24/), fetched once on the server by
  `make garmin-icons` into public/garmin-symbols, outside git: they are Garmin's artwork.
- Place search by Nominatim (nominatim.openstreetmap.org): at most one request per second,
  no search as you type, attribution shown.
- Base maps: OpenFreeMap's vector styles (Liberty, Bright, Positron, Dark) without an
  API key, and raster tiles from OpenTopoMap, OpenStreetMap and CyclOSM, each with its
  attribution; the choice is kept in the browser.

## Targets

- Desktop and phone browsers with WebGL 2, which MapLibre GL JS 6 requires; the build
  targets ES2022. Screens down to 360 px wide.
- The public pages work without JavaScript.

## Build and deployment

- `make check` runs `composer validate`, PHP syntax checks, PHPUnit, and the frontend's
  type check, tests and build; GitHub Actions runs it on every push.
- The server deploys with `git pull` and `make build`: Composer dependencies without
  development packages, `npm ci` and the Vite build into `public/build`.
- The database, the file store and the local configuration live outside the checkout.
  `make init` applies the schema (new tables only); `make recreate` drops everything and
  applies it afresh, which is how a schema change is deployed before the first release.
- `make garmin-icons` fetches Garmin's symbol pictures into `public/garmin-symbols` once
  (with `php-8.4`; `PHP=` names another binary); a second run fetches only what is missing.
  httpd serves that directory as static files, as it serves `public/build`
  (`deploy/httpd.conf.example`).
- Node.js 22 with npm 10 and Composer 2 on the server and for development.
