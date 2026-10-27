![Trip Planner](docs/banner.png)

Plans whole motorcycle trips, not single routes: days of stops, hotels kept once and used
every night, routes drawn along the roads, exported as GPX in the shape a device needs.

Runs at <https://planner.codevoid.de>, by invitation. In development: planning a trip on
the map and exporting it works; times, alternative routes, GPX import, photos and receipts
are on the way.

![A day planned on the map](docs/screenshot.png)

## Features

- **Trips of days** — a trip is a sequence of days, a day a sequence of stops, with a
  route between consecutive stops.
- **Drawn on the map** — tap to add a stop at the end of the day or on a route, insert
  points to shape a route, drag stops and points, delete them; straight legs where the
  routing knows no way.
- **Routed along the roads** — by OSRM, with a road, bike or foot profile per day, undo
  and redo, and a reroute of the whole day.
- **Saved as you go** — every change is saved to your account moments later.
- **GPX export** — the whole trip in one file, one day, or one file per day in a zip:
  stops as waypoints, routes as tracks.
- **Places kept once** — a hotel is one place however many stops use it; rename it once.

## Getting started

1. Join the waiting list on the landing page; the invitation comes by mail.
2. Sign in, name a new trip, add a day.
3. Tap the map for the first stop, then for the next; the road between them is routed.
4. Download *GPX of the trip*, *one file per day* or *this day* from the trip's panel.

| Key | Does |
|---|---|
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo |
| Esc | Back to the Stop tool; closes a menu |
| Right-click or long press on a stop or point | Straight leg to here, remove |
