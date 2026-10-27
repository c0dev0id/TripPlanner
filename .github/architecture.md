# Architecture

## High-level architecture

The server renders the public pages and serves the planner app, which talks to it over a
JSON API. Routing and map tiles are fetched by the browser directly.

```mermaid
flowchart LR
  subgraph browser["Browser"]
    pages["Landing, sign-up, sign-in<br/>server-rendered pages"]
    app["Planner app<br/>SolidJS + MapLibre GL JS"]
  end
  subgraph server["planner.codevoid.de<br/>OpenBSD, httpd, php-fpm"]
    httpd["httpd<br/>static files, FastCGI"]
    php["PHP application (Slim)<br/>pages, JSON API, GPX export"]
    db[("SQLite<br/>accounts, trips")]
    files[("File store<br/>photos, receipts, documents")]
    smtpd["smtpd<br/>127.0.0.1:25"]
  end
  subgraph remote["Remote services"]
    osrm["OSRM<br/>routing.openstreetmap.de"]
    tiles["OpenFreeMap<br/>base map tiles"]
  end
  pages --> httpd
  app -->|JSON API| httpd
  httpd --> php
  php --> db
  php --> files
  php -->|invitations, password resets| smtpd
  app --> osrm
  app --> tiles
```

## Block diagram

```mermaid
flowchart TB
  subgraph frontend["Planner app (frontend/)"]
    direction TB
    ui["Presentation<br/>library, trip panel, map, toolbar, markers"]
    state["Application state<br/>the open trip, undo and redo, routing pump, autosave"]
    fdomain["Domain<br/>route and day edits, legs, polyline"]
    client["API client"]
    ui --> state --> fdomain
    state --> client
  end
  subgraph backend["PHP application (src/)"]
    direction TB
    http["HTTP<br/>routes, middleware, templates, JSON"]
    domain["Domain<br/>accounts, invitations, trip documents, export"]
    storage["Storage<br/>SQLite repositories, file store, mail"]
    http --> domain --> storage
  end
  client -->|HTTPS| http
```

| Layer | Contents |
|---|---|
| Presentation (frontend) | The library (`library/`), the trip panel (`trip/`), the map with its route lines, stop and point markers, interactions, toolbar, hint bar and context menu (`map/`), dialogs and small controls (`ui/`). |
| Application state (frontend) | The open trip with undo and redo and the actions that edit it (`state/trip.ts`), the pull-based routing pump (`state/routing.ts`), the autosave (`state/autosave.ts`), the tool and the open menu (`state/drawing.ts`). |
| Domain (frontend) | Pure edits of a route and of a day's stops and routes, leg keys and geometry, the polyline codec, the OSRM client (`routing/`); distances and nearest-line search (`geo/`); the document types (`model/`). |
| API client (frontend) | `api.ts`: requests to the JSON API, the one place that knows its URLs. |
| HTTP (backend) | Slim routes and middleware (sessions, CSRF, body parsing, authentication), Plates templates for the public pages, JSON encoding of API answers (`Http/`, `Pages/`, `Api/`). |
| Domain (backend) | Accounts and password resets (`Account/`), waiting list and invitations (`Signup/`), trips and trip documents with their validator (`Trip/`), GPX writing (`Export/`). |
| Storage (backend) | PDO repositories over SQLite, the file store on disk, mail over SMTP (`Mail/`). |

## API

All under `/api`, for a signed-in user; answers are JSON unless a download.

| Method and path | Does |
|---|---|
| `GET /me` | The user's e-mail address and admin flag. |
| `GET /trips` | The user's trips, last changed first, with their day count. |
| `POST /trips` | Creates a trip from `{name}`. |
| `GET /trips/{id}` | The trip document: name, description, start date, version, places, days with stops and routes. |
| `PUT /trips/{id}` | Replaces the trip's content with the document sent, which carries the version it was loaded at; 409 when that is no longer the current version, 422 when the document is malformed or names parts of another trip. |
| `DELETE /trips/{id}` | Deletes the trip with everything in it. |
| `GET /trips/{id}/gpx` | The trip as GPX; `?day=<id>` one day; `?per=day` a zip with one file per day. |

## Database

The model as phase 2 builds it; the phase 1 schema in `db/schema.sql` still has stops in
a sequence with a route per gap and places apart from stops.

```mermaid
erDiagram
  USER ||--o{ TRIP : owns
  USER ||--o{ FOLDER : owns
  USER ||--o{ INVITATION : sends
  USER ||--o{ PASSWORD_RESET : requests
  WAITLIST_ENTRY |o--o| INVITATION : "invited by"
  FOLDER |o--o{ TRIP : holds
  TRIP ||--o{ DAY : "days, in order"
  DAY ||--o{ ROUTE : "routes, in order"
  DAY ||--o{ STOP : "stops"
  STOP }o--o| ROUTE : "bound to a point of"
  TRIP ||--o{ ATTACHMENT : "on the trip, a day, a stop or a route"
  TRIP ||--o{ COMMENT : "on the trip, a day, a stop or a route"

  USER {
    int id PK
    string email
    string password_hash
    bool is_admin
    datetime created_at
  }
  WAITLIST_ENTRY {
    int id PK
    string email
    datetime created_at
    datetime invited_at
  }
  INVITATION {
    int id PK
    string email
    string token_hash
    datetime expires_at
    datetime used_at
  }
  PASSWORD_RESET {
    int id PK
    string token_hash
    datetime expires_at
  }
  FOLDER {
    int id PK
    string name
  }
  TRIP {
    int id PK
    string name
    string description
    date starts_on
    int version
    datetime updated_at
  }
  DAY {
    string id PK
    int position
    string name
    date date
    string notes
  }
  ROUTE {
    string id PK
    int position
    string name
    string kind "routed, track"
    string profile "car, bike, foot"
    bool optional
    json points "in order: id, position, straight"
    json legs "by profile and ends: geometry, distance, duration"
  }
  STOP {
    string id PK
    string name
    string kind "the icon: hotel, restaurant, fuel, sight, photo, break, other"
    float lng
    float lat
    string point_id "a route point of the day, or null for a free stop"
    string address
    string contact
    string booking_reference
    string notes
    time arrive_at
    int pause_minutes
    bool optional
  }
  ATTACHMENT {
    int id PK
    string kind "photo, receipt, document"
    string file
    string caption
    datetime taken_at
  }
  COMMENT {
    int id PK
    string text
    datetime created_at
  }
```

Attachments and comments are planned (phase 5). A trip's parts carry ids the client
generates, so that the trip's content is saved as one document: rows are upserted by id
and the ones the document no longer holds are deleted. A route's points and legs are
stored as JSON in the route's row, in the shape the editor works with; each routed leg
holds its polyline6 geometry, length and riding time as OSRM answered. A bound stop's
position equals its route point's, which the validator checks. Attachments and comments
will carry one nullable foreign key per possible target with a check that exactly one is
set, so that deleting a target deletes them.
