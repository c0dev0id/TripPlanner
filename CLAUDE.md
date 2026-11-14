# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Trip Planner plans multi-day motorcycle trips: a PHP application (Slim) with a SQLite
database serves the public pages and a JSON API; a SolidJS single-page app with MapLibre
is the planner itself.

## Commands

| Command | Does |
|---|---|
| `make install` | Composer and npm dependencies for development. |
| `make check` | Everything CI runs: `composer validate`, PHP syntax check, PHPUnit, `tsc --noEmit`, Vitest, Vite build. |
| `composer test` | PHPUnit alone. |
| `vendor/bin/phpunit tests/Trip/TripMergeTest.php` | One PHP test file; `--filter <name>` for one test. |
| `npm test` | Vitest alone (`vitest run`). |
| `npx vitest run frontend/routing/legs.test.ts` | One frontend test file; `-t <name>` for one test. |
| `npm run typecheck` | TypeScript check alone. |
| `npm run dev` | Vite dev server on port 5173; set `vite_dev_server` in `config/local.php` so the PHP templates load from it. |
| `php bin/planner <command>` | `db:init`, `db:recreate`, `invite`, `user:create`, `user:password`, `admin:grant`, `garmin:icons`, `closures:fetch`, `places:fetch <area>`. |

The Makefile targets `init`, `recreate`, `invite`, `user`, `password` and `admin` wrap
`bin/planner` with `doas -u www` and `pass` for the production OpenBSD box; in
development call `php bin/planner` directly. The Makefile must stay portable between
OpenBSD make and GNU make: no conditionals, no shell functions.

There is no linter beyond `php -l` and `tsc`. PHPUnit fails on warnings and deprecations.

`config/default.php` holds development defaults (data in `var/`, mail written to a log);
`config/local.php` (not in git) overrides them.

## Documentation to read and to keep current

`.github/` holds the development documentation, and a change updates it in the same task:

- `architecture.md`: component and layer diagrams, the layer table, the full API table,
  the ER diagram.
- `decisions.md`: the rationale for every non-obvious choice. Read the relevant section
  before changing how something works; "why" belongs there, not in code comments.
- `features.md`, `overview.md`, `stackinfo.md`.

## Architecture

### Backend (`src/`, namespace `Planner\`)

- `public/index.php` is the front controller. `Kernel` builds the PHP-DI container
  (autowiring; explicit definitions only for what needs configuration) and the Slim app.
  `Http/Routes.php` is the one list of routes: a pages group behind the CSRF guard and an
  `/api` group answering JSON.
- Folders are features (`Trip/`, `Journal/`, `Export/`, `Recording/`, `Poi/`, `Signup/`,
  `Account/`, `Share/`). Each holds its controllers, value objects and PDO repositories
  (plural class names: `Trips`, `Folders`, `Entries`).
- Public pages (landing, sign-up, sign-in) are Plates templates in `templates/` and work
  without JavaScript. `/app` and the read-only trip page (`/trips/{id}`, `/t/{token}`)
  are templates that load a Vite bundle through `Pages/ViteAssets`, which reads the build
  manifest or points at the dev server.
- The schema is `db/schema.sql`. There are no migrations before 1.0: a schema change is
  deployed by `db:recreate`, which drops everything.
- The SQLite file, the journal's file store and `config/local.php` live outside the
  deployed checkout; php-fpm runs chrooted, so paths are given relative to the checkout.

### Frontend (`frontend/`)

Two Vite entries: `main.tsx` (the planner) and `view.tsx` (the read-only page). The build
goes to `public/build`; static paths and page routes never share a name.

Layers, each depending only on the ones below:

- Presentation: `library/`, `trip/`, `map/`, `ui/`, `view/`.
- Application state: `state/` (the open trip, undo and redo, the routing pump, autosave,
  journal, recordings, clipboard, library).
- Domain, pure and unit-tested: `routing/`, `gpx/`, `recording/`, `poi/`, `geo/`,
  `symbols/`, `model/`.
- `api.ts` is the only module that knows the API's URLs.

### The trip document

- A trip is days; a day has routes and stops. A stop is bound to a route point (same
  position, moves with it) or free.
- The client holds the whole trip and saves it as one `PUT /api/trips/{id}` 1.5 s after
  the last change. The document carries the version it was loaded at; the server answers
  409 on a newer version. A day or a route that is the same object as in the trip last
  saved (`state/trip.ts` `savedTrip`) is sent as `{id, unchanged: true}`
  (`model/delta.ts`); the server fills such routes from its rows before validating and
  leaves unchanged rows alone. This relies on parts never being changed in place.
- A ride as recorded is not part of the document: it is kept once for its user
  (`recordings`), and `recording_days` names the days it is on, of any of the user's
  trips. Removing a day or a trip removes links, never a ride.
- Days, routes and stops carry client-generated ids. The server upserts them by id and
  deletes the rows the document no longer holds, because journal entries reference them.
  `Trip/TripDocumentValidator` checks the document, including that no id belongs to
  another trip.
- The open trip is an immutable value in a signal, not a Solid store; every edit is a pure
  function that returns a new trip sharing the untouched parts. Consequences: lists keep
  rows by id (`ui/ForById`), dialogs hold their element by id, and components must not
  hold a part's object across edits.
- Coordinates are rounded to six decimals in the edit actions of `state/trip.ts`. Leg keys
  are built from coordinates as text in both TypeScript and PHP and only agree under that
  invariant.
- Routing (Valhalla), place search and place names (Nominatim), roadworks (WFS) and map tiles are fetched
  by the browser directly, at most one request per second to Valhalla and Nominatim. GPX import runs in
  the browser, GPX export on the server.

### Language

Texts are English in the code and are their own translation keys: `t('Some text')`.
`frontend/i18n/de.json` maps the English text to German and is read by the frontend's
`t()` and by the PHP `t()` (`src/I18n/functions.php`) alike. A new user-visible text needs
its entry in `de.json`; a missing one shows the English and, in a dev build, is listed in
`window.i18nMissing`. Plural forms are one entry separated by `|`. Controllers and
exceptions speak the English keys; `Http/Json::error` translates on the way out. The
validator's messages, the command line and Garmin symbol names are not translated.

## Testing

PHPUnit covers repositories, the validator and the export against an in-memory SQLite
database (`tests/TestDatabase.php`); there are no controller tests. Vitest covers the pure
frontend modules and the open trip's state. The HTTP layer and the editor are exercised by
hand with Playwright against `php -S`, not in CI.

## Constraints

- Vite stays on 7.x: the server builds the frontend on OpenBSD, where Vite 8's Rolldown
  has no native binding.
- `vendor/`, `node_modules/` and `public/build/` are never committed; the server builds
  with `make build` after `git pull`, CI only checks.
- `public/garmin-symbols/` is fetched by `garmin:icons` and `public/closures.geojson` by
  `closures:fetch`; both stay out of git.
- Places (fuel, hotels and the like) are never fetched by the browser: `places:fetch`
  fills the `places` table from the Overpass API, from cron, and the planner reads it by
  tile. `frontend/poi/places.json` lists the kinds for both sides.
- A new table is deployed with `db:init`, which adds what is missing; only a changed
  table needs `db:recreate`.
