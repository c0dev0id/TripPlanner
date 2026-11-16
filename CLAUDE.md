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

The Makefile targets `init`, `recreate`, `invite`, `user`, `password`, `admin` and `places` wrap
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
  `Account/`, `Share/`, `Stash/`, `Media/`). Each holds its controllers, value objects and PDO repositories
  (plural class names: `Trips`, `Folders`, `Entries`).
- Public pages (landing, sign-up, sign-in) are Plates templates in `templates/` and work
  without JavaScript. `/app` and the read-only trip page (`/trips/{id}`, `/t/{token}`)
  are templates that load a Vite bundle through `Pages/ViteAssets`, which reads the build
  manifest or points at the dev server.
- The schema is `db/schema.sql`. There are no migrations before 1.0. A new table or index
  is deployed by `db:init` (`make init`), which adds what is missing; a changed table by
  `db:recreate`, which drops everything, or, where the data is to stay, by a one-shot
  `bin/migrate-…` script that is run once on the server and then deleted. A table that
  keeps files (`stash_files`, `recordings`) has the file as its last column, so that a
  listing does not read through it: such a table gains a column by being made anew in
  its script, never by `ALTER TABLE … ADD COLUMN`.
- The SQLite file, the journal's file store and `config/local.php` live outside the
  deployed checkout; php-fpm runs chrooted, so paths are given relative to the checkout.

### Frontend (`frontend/`)

Two Vite entries: `main.tsx` (the planner) and `view.tsx` (the read-only page). The build
goes to `public/build`; static paths and page routes never share a name.

Layers, each depending only on the ones below:

- Presentation: `library/`, `trip/`, `map/`, `settings/`, `ui/`, `view/`.
- Application state: `state/` (the open trip, undo and redo, the routing pump, autosave,
  journal, recordings, clipboard, library).
- Domain, pure and unit-tested: `routing/`, `gpx/`, `recording/`, `poi/`, `geo/`,
  `symbols/`, `model/`.
- `api.ts` is the only module that knows the API's URLs.

The library has a tab for each of its views (`model/library.ts`, `LibraryTab`; what each
tree is, its kind of folder, what it holds and its texts, is one record there, `TREES`): Stash,
Trips, Places and Recordings. The folders of kind `collections` and `places` are the
tops of the Stash's and the Places' trees and are never rows; each tree keeps its own
mark and selection while another tab is shown.

The Trips' tree stops at the trip: a click on a trip opens it, the one trip document
that is loaded, and shows it on the map; its days are listed in the pane beside the
library (`trip/DayPane.tsx`, `trip/TripPanel.tsx`), one shown at a time, and the pane is
opened by the button on the trip's row (`daysPaneOpen` in `state/trip.ts`, `paneShown`
in `state/library.ts`). A list of places keeps its categories in the tree, the open
list's from its document (`trip/CollectionPanel.tsx`), the others' from the outlines,
and the pane shows the category picked. What is pinned stays on the map whatever trip
is open (`state/pins.ts`): a pin keeps a copy of its line for while its trip is not.

`library/Library.tsx` holds the trees, their menus and keys; beside it are its cards
(`cards.tsx`, `StashFileCard.tsx`), the Stash's verbs and menus (`stashMenu.ts`) and what
is pure and tested: the rows' keys and what a folder takes (`items.ts`), the search
(`search.ts`), which files of a Stash folder belong together (`grouping.ts`, proposed
in `GroupDialog.tsx`), and the trips and days copied Stash folders make
(`stashTrips.ts`).

Every list selects through `ui/selection.ts`: there is one selection for the page, held
by one list at a time. `rowSelect` gives a row its click, its pad and its highlight
(`.selected`), `menuRows` says what a row's menu acts on, and each list reads the keys
itself through `ui/fileVerb.ts`. A selectable row has a pad (`ui/Pad.tsx`) or a grip
whose tap selects; every pad is drawn as a grip, whether it also drags or not.

A drop is a cut and a paste in one move, within the tab (`ui/carry.ts`). What a drag
holds has a kind, and a place to drop is an element made one for a kind with
`dropTarget`: asked what is carried, it answers with the drop or a refusal (null), and
the nearest place around the pointer that is for the kind decides. Rows of the open
trip are held as the clip a cut would make (`heldParts` and its kin in
`state/clipboard.ts`) and dropped by the paste the place offers (`dropsOnPart`,
`dropsOnRow`), so drops follow `model/paste.ts` and leave the clipboard alone; folders,
trips and files of the library are held as items and dropped into folders. A pad
(`ui/Pad.tsx`) and a grip (`ui/Grip.tsx`) both take what they carry as `carries`; a
grip sorts its row within its list and carries it only to places outside it.

The Stash is folders of GPX files kept whole (`stash_files`, `src/Stash/`), with an
index of each file's routes and tracks beside it (`stash_items`) and the media that
belong to a file (`stash_media`, in the database too); it is not made of trip
documents. It works on whole routes, tracks and files: rename, delete, export the file,
and the ways out: by the clipboard, a file imported where it is pasted (a trip in a folder,
a day in a trip, routes and stops in a day, places in a list), its media with it as the
day's, a folder pasted among the trips as a trip of its files or onto a trip as days of
it, or a track among the rides. Cleaning up rewrites the stored file.
Nothing goes into the Stash from the app. The Trips are where things are edited and
tied together. A collection (`trips.kind`) is a list of places, lives among the
Places alone and takes places alone.

What is pasted where is one table, `model/paste.ts`: for each kind of place (a folder of
the trips or the places, a trip's row, a list's row, a day, a category, a route, a file
of the Stash, the recordings) the kinds of clipboard it takes, and what it has a use for
of Stash files. Every paste entry, the line above a list and the keys ask it through
`state/clipboard.ts` (`pasteItems` for the open trip, `libraryPasteItem` for the
library); a change to what is offered where is a change to that table and its test.
Trips, lists and folders moved among folders follow their trees instead (`takerOf` in
`library/items.ts`): a folder never leaves its tree.

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
hand with Playwright against `php -S`, not in CI:

- `rm -rf var && php bin/planner db:init && php bin/planner user:create <email>` gives a
  fresh database and prints a generated password, which the first sign-in must replace.
- `npm run build`, then `php -S 127.0.0.1:8080 -t public`.
- Headless Chromium needs `--use-gl=swiftshader --enable-unsafe-swiftshader
  --ignore-gpu-blocklist` for MapLibre to draw.

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
