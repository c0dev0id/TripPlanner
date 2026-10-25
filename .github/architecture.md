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
    tiles["Base map tiles"]
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
    ui["Presentation<br/>panel, dialogs, map, route editor"]
    state["Application state<br/>the open trip, undo and redo, routing pump"]
    fdomain["Domain<br/>route edits, legs, GPX reading"]
    client["API client"]
    ui --> state --> fdomain
    state --> client
  end
  subgraph backend["PHP application (src/)"]
    direction TB
    http["HTTP<br/>routes, middleware, templates, JSON"]
    domain["Domain<br/>accounts, invitations, trips, export"]
    storage["Storage<br/>SQLite repositories, file store, mail"]
    http --> domain --> storage
  end
  client -->|HTTPS| http
```

| Layer | Contents |
|---|---|
| Presentation (frontend) | The trip panel, the timeline, dialogs, the map view and the route editor's markers. |
| Application state (frontend) | The trip being edited, its undo and redo history, the pull-based routing pump, autosave. |
| Domain (frontend) | Pure route edits, leg keys and geometry, GPX reading; ported from Layer Slayer with their tests. |
| API client (frontend) | Requests to the JSON API; the one place that knows its URLs. |
| HTTP (backend) | Slim routes and middleware (sessions, CSRF, authentication), Plates templates for the public pages, JSON encoding of API answers. |
| Domain (backend) | Accounts, waiting list and invitations, trips with their parts, the timeline, GPX writing and export packaging. |
| Storage (backend) | PDO repositories over SQLite, the file store on disk, mail over SMTP. |

## Database

The target model. Phase 0 implements the account tables; the trip tables follow in
phases 1 to 4.

```mermaid
erDiagram
  USER ||--o{ TRIP : owns
  USER ||--o{ INVITATION : sends
  USER ||--o{ PASSWORD_RESET : requests
  WAITLIST_ENTRY |o--o| INVITATION : "invited by"
  TRIP ||--o{ DAY : "days, in order"
  TRIP ||--o{ PLACE : keeps
  DAY ||--o{ STOP : "stops, in order"
  STOP }o--|| PLACE : at
  STOP ||--o{ ROUTE : "to the next stop"
  TRIP ||--o{ ATTACHMENT : "on the trip, a day, a stop, a route or a place"
  TRIP ||--o{ COMMENT : "on the trip, a day, a stop, a route or a place"

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
  TRIP {
    int id PK
    string name
    string description
    date starts_on
    string state "planned, done"
  }
  DAY {
    int id PK
    int position
    date date
    string name
    string notes
  }
  PLACE {
    int id PK
    string name
    string kind "hotel, restaurant, fuel, sight, other"
    float lng
    float lat
    string address
    string contact
    string booking_reference
    string notes
  }
  STOP {
    int id PK
    int position
    string role "overnight, lunch, break, fuel, visit, photo"
    time arrive_at
    int pause_minutes
    bool optional
    string notes
  }
  ROUTE {
    int id PK
    string name
    string kind "routed, track"
    string profile
    bool optional
    json points "route points, in order"
    json legs "geometry per leg, keyed by profile and ends"
    int distance_m
    int duration_s
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

A route's points and legs are stored as JSON in the route's row, in the shape the route
editor works with. Attachments and comments carry one nullable foreign key per possible
target with a check that exactly one is set, so that deleting a target deletes them.
