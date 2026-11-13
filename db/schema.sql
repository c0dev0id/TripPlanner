-- Timestamps are ISO 8601 in UTC (2026-10-25T20:00:00Z), which compare as text.

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    -- Set for an account made with a generated password, which is replaced at the first sign-in.
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL,
    invited_at TEXT
);

CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
);

CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
);

-- The journal: notes and files on the trip, a day, a stop or a route; one whose part goes
-- stays with the trip. A photo's time and position come from its EXIF data.
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_id TEXT REFERENCES days(id) ON DELETE SET NULL,
    stop_id TEXT REFERENCES stops(id) ON DELETE SET NULL,
    route_id TEXT REFERENCES routes(id) ON DELETE SET NULL,
    text TEXT NOT NULL DEFAULT '',
    file_name TEXT,
    media_type TEXT,
    size INTEGER,
    taken_at TEXT,
    lng REAL,
    lat REAL,
    created_at TEXT NOT NULL,
    CHECK ((day_id IS NOT NULL) + (stop_id IS NOT NULL) + (route_id IS NOT NULL) <= 1)
);
CREATE INDEX IF NOT EXISTS entries_trip ON entries(trip_id, id);

-- A user's named sets of export options, as JSON.
CREATE TABLE IF NOT EXISTS export_presets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    options TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, name)
);

-- Folders sort the library: a folder is at the top or inside another (`parent_id`), a
-- trip is in one folder or in none.
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES folders(id),
    name TEXT NOT NULL,
    -- A folder of the user's making, or one of the two every user has at the top of the
    -- library: for recordings that belong to no trip, and for collections.
    kind TEXT NOT NULL DEFAULT 'folder' CHECK (kind IN ('folder', 'recordings', 'collections')),
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS folders_user ON folders(user_id);
CREATE INDEX IF NOT EXISTS folders_parent ON folders(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS folders_special ON folders(user_id, kind) WHERE kind <> 'folder';

CREATE TRIGGER IF NOT EXISTS users_special_folders AFTER INSERT ON users BEGIN
    INSERT INTO folders (user_id, name, kind, created_at) VALUES
        (NEW.id, 'Recordings', 'recordings', NEW.created_at),
        (NEW.id, 'Collections', 'collections', NEW.created_at);
END;

-- A trip's parts carry ids the client generates, so that the whole trip is saved as one
-- document: rows are upserted by id and the ones no longer in the document are deleted.

CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    -- A trip, or a collection of planning material whose days are its sections; fixed at creation.
    kind TEXT NOT NULL DEFAULT 'trip' CHECK (kind IN ('trip', 'collection')),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    -- Planned, or ridden: done.
    state TEXT NOT NULL DEFAULT 'planned' CHECK (state IN ('planned', 'done')),
    -- Set while the trip's read-only page is public under /t/{token}.
    share_token TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS days (
    id TEXT PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    -- The thinned lines of its routes as JSON, each with a key of the route it was made from and the route's length; see Outline.
    outline TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS days_trip ON days(trip_id, position);

-- A route is geometry: its points in order, and the routed legs between them.
-- A routed route has its motorway dial, its points and its routed legs as JSON; a track
-- has its line as polyline6 instead.
CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL CHECK (kind IN ('routed', 'track')),
    profile TEXT NOT NULL,
    -- The motorway dial of the road profile: avoid, allow, prefer.
    highways TEXT,
    optional INTEGER NOT NULL DEFAULT 0,
    -- The colour of its line as #rrggbb where the user chose one.
    color TEXT,
    points TEXT,
    legs TEXT,
    line TEXT,
    CHECK ((kind = 'routed') = (highways IS NOT NULL AND points IS NOT NULL AND legs IS NOT NULL AND line IS NULL)),
    CHECK ((kind = 'track') = (highways IS NULL AND points IS NULL AND legs IS NULL AND line IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS routes_day ON routes(day_id, position);

-- A stop is bound to a point of one of its day's routes (point_id, same position) or
-- free beside the route.
CREATE TABLE IF NOT EXISTS stops (
    id TEXT PRIMARY KEY,
    day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    -- In riding order, as the client computes it from the routes.
    position INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    -- The Garmin waypoint symbol a GPX file names (<sym>), kept as given; none for a plain stop.
    symbol TEXT,
    lng REAL NOT NULL,
    lat REAL NOT NULL,
    point_id TEXT,
    address TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    booking_reference TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    arrive_at TEXT,
    pause_minutes INTEGER,
    optional INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS stops_day ON stops(day_id);

-- A ride as recorded, kept on a day: the GPX file as uploaded, compressed with gzip; the
-- browser reads its points. A removed day takes its recordings with it. Beside the file
-- stands what is read from it once, to list and find recordings without their files: its
-- line thinned, as polyline6, its length, the time of its first point where it has one,
-- and the file's SHA-256, by which a file kept already is known.
CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY,
    day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gpx BLOB NOT NULL,
    created_at TEXT NOT NULL,
    line TEXT NOT NULL DEFAULT '',
    distance_m INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    digest TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS recordings_day ON recordings(day_id);
CREATE INDEX IF NOT EXISTS recordings_digest ON recordings(digest);

-- The places the map shows of the kinds the planner knows (frontend/poi/places.json),
-- fetched from OpenStreetMap area by area by `make places` and asked for by the planner
-- tile by tile: the tiles of the web's maps at zoom 10. id is the OpenStreetMap object,
-- as "node/123"; tags are the ones a place's details are made of, as JSON; area is the
-- code of the area whose fetch brought the place, which replaces its places as a whole.
CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    lng REAL NOT NULL,
    lat REAL NOT NULL,
    tile_x INTEGER NOT NULL,
    tile_y INTEGER NOT NULL,
    tags TEXT NOT NULL,
    area TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS places_tile ON places(tile_x, tile_y, kind);
CREATE INDEX IF NOT EXISTS places_area ON places(area);

-- The last fetch of each kind of place in each area (by its ISO 3166 code): how many it brought, and when.
CREATE TABLE IF NOT EXISTS place_fetches (
    area TEXT NOT NULL,
    kind TEXT NOT NULL,
    places INTEGER NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (area, kind)
);

-- What a user set for the planner as a whole, as JSON the planner itself reads and writes.
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences TEXT NOT NULL
);
