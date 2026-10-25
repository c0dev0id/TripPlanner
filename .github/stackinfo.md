# Software stack

## Server

- OpenBSD with httpd and php-fpm. php-fpm runs chrooted to `/var/www`, so the application,
  its data and the SQLite file live below that directory.
- PHP 8.4 with pdo_sqlite, sqlite3, zip, gd, intl, curl, xsl.
- SQLite in WAL mode with foreign keys on, one database file.
- Mail over SMTP to the local smtpd at 127.0.0.1:25; PHP's `mail()` is not used (no
  sendmail inside the chroot).
- Composer packages: Slim 4.15 (routing, middleware, PSR-7 through slim/psr7 1.8), PHP-DI 7
  (container, autowiring), league/plates 3.6 (templates of the public pages), slim/csrf 1.5
  (form tokens), PHPMailer 7 (SMTP). PHPUnit 13 for tests.

## Frontend

- SolidJS 1.9 (UI and state), Vite 8 (build), TypeScript 7 (type checking), Vitest 5 with
  jsdom for unit tests of the pure modules.
- MapLibre GL JS 6 (map rendering, Web Mercator).
- Route tool, GPX reading and polyline handling ported from Layer Slayer.
- Routing by the FOSSGIS OSRM servers (routing.openstreetmap.de): at most one request per
  second, attribution shown. Motorcycles ride the car profile.
- Base map from a vector style without an API key (OpenFreeMap), with the raster and
  topographic alternatives decided in phase 1.

## Targets

- Desktop and phone browsers with WebGL 2, which MapLibre GL JS 6 requires; the build
  targets ES2022. Screens down to 360 px wide.
- The public pages work without JavaScript.

## Build and deployment

- GitHub Actions runs `composer validate`, PHP syntax checks and PHPUnit, and the
  frontend's type check, tests and build on every push.
- On `main`, the workflow assembles the deployable application (PHP sources, `vendor/`
  without dev packages, the built frontend) and pushes it to the `deploy` branch. The
  server checks out `deploy` and updates with `git pull`; nothing is built on the server.
- The database, the file store and the local configuration live outside the checkout.
- Node.js LTS and Composer 2 for development and CI.
