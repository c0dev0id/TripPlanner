-- Timestamps are ISO 8601 in UTC (2026-10-25T20:00:00Z), which compare as text.

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
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

-- Folders sort the library one level deep; a trip is in one folder or in none.
CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS folders_user ON folders(user_id);

-- A trip's parts carry ids the client generates, so that the whole trip is saved as one
-- document: rows are upserted by id and the ones no longer in the document are deleted.

CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS days (
    id TEXT PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    date TEXT,
    notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS days_trip ON days(trip_id, position);

-- A route is geometry: its points in order, and the routed legs between them.
CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL,
    profile TEXT NOT NULL,
    optional INTEGER NOT NULL DEFAULT 0,
    points TEXT NOT NULL,
    legs TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS routes_day ON routes(day_id, position);

-- A stop is bound to a point of one of its day's routes (point_id, same position) or
-- free beside the route.
CREATE TABLE IF NOT EXISTS stops (
    id TEXT PRIMARY KEY,
    day_id TEXT NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
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
