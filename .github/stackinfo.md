# Software stack

## Server

- OpenBSD with httpd and php-fpm. php-fpm runs chrooted to `/var/www`, so the application,
  its data and the SQLite file live below that directory.
- PHP 8.4 with pdo_sqlite, sqlite3, zip, gd, intl, curl, xsl, and the core exif and
  fileinfo extensions: gd makes the journal's image previews, fileinfo tells uploaded
  files' types, exif reads when and where a photo was taken (without exif, photos are
  kept but not placed).
- The journal's files are uploads through php-fpm: `upload_max_filesize` and
  `post_max_size` in its php.ini bound a photo's size (PHP's defaults are 2 MB and 8 MB;
  phone photos need more).
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
- Route tool, GPX reading, line simplification and polyline handling ported from Layer Slayer.
- Routing by the FOSSGIS Valhalla server (valhalla1.openstreetmap.de): at most one request
  per second, attribution shown. The profiles are Valhalla's motorcycle, bicycle and
  pedestrian costings by name; the motorcycle takes the `use_highways` option.
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
- Node.js 22 with npm 10 and Composer 2 on the server and for development.
