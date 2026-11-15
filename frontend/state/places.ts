import { createEffect, createMemo, createRoot, createSignal } from 'solid-js';
import { fetchPlaces } from '../api';
import { isStoreKind, POI_CATEGORIES, type Place, type PoiCategory } from '../poi/categories';
import { placesNear } from '../poi/near';
import { tilesAlong, tilesOfView, type Tile } from '../poi/tiles';
import { routeLine } from '../routing/legs';
import { readPreference, writePreference } from '../ui/preferences';
import { placeReachM } from './preferences';
import type { LngLat } from '../model/trip';
import { opened } from './recordingView';
import { activeRouteId, selectedDay } from './trip';

/**
 * The places on the map: of each kind, of the store's and of the user's own lists alike,
 * all of them, those along what is looked at (the recording or route taken up, else the
 * selected day's routes), or none, as the kind's mode says.
 * The store's are read tile by tile. The modes are kept for this browser.
 */

/** From this zoom on the map shows all places in view; farther out there are too many. */
export const PLACES_MIN_ZOOM = 10;

/** Which places of a kind the map shows. */
export type PlaceMode = 'all' | 'along' | 'none';

/** The modes in the order a kind's switch goes through them. */
const MODES: readonly PlaceMode[] = ['all', 'along', 'none'];

/** The modes other than none, by kind, as the browser keeps them: "fuel:along,d-12:all". */
const PLACE_MODES = 'placeModes';

const [modes, setModes] = createSignal<ReadonlyMap<string, PlaceMode>>(
  new Map(
    (readPreference(PLACE_MODES) ?? '').split(',').flatMap((entry) => {
      const at = entry.lastIndexOf(':');
      const mode = entry.slice(at + 1) as PlaceMode;
      return at > 0 && (mode === 'all' || mode === 'along') ? [[entry.slice(0, at), mode] as const] : [];
    }),
  ),
);

/** Which places of the kind the map shows: a kind of the store by its id, one of the user's own by its section's. */
export const placeMode = (kind: string): PlaceMode => modes().get(kind) ?? 'none';

/** Whether a kind of the user's own places is on the map: one not of the store's kinds. */
export const anyOwnKindShown = (): boolean => [...modes().keys()].some((kind) => !isStoreKind(kind));

/** Gives the kind the next mode: all, along the routes, none, and all again. */
export function cyclePlaceMode(kind: string): void {
  const next = new Map(modes());
  const mode = MODES[(MODES.indexOf(placeMode(kind)) + 1) % MODES.length]!;
  if (mode === 'none') next.delete(kind);
  else next.set(kind, mode);
  setModes(next);
  writePreference(PLACE_MODES, next.size > 0 ? [...next].map(([id, shown]) => `${id}:${shown}`).join(',') : undefined);
}

/**
 * The lines places are shown along: of what is taken up, the recording opened or the
 * route, else the selected day's routes; none while no kind is shown along them.
 */
export const alongLines = createRoot(() =>
  createMemo((): LngLat[][] => {
    if (![...modes().values()].includes('along')) return [];
    const recording = opened();
    if (recording) return [recording.track.points];
    const routes = selectedDay()?.routes ?? [];
    const taken = routes.find((route) => route.id === activeRouteId());
    return (taken ? [taken] : routes).map(routeLine).filter((line) => line.length > 1);
  }),
);

/** What the map shows: its bounds (west, south, east, north) and zoom, as the map says them. */
export const [mapView, setMapView] = createSignal<{ bounds: [number, number, number, number]; zoom: number }>();

/** Whether every place is hidden from the map for now, the store's and the user's own, whatever their kinds' states; for the page only. */
export const [placesHidden, setPlacesHidden] = createSignal(false);

/** The kinds in a state; none while the places are hidden, so that none are read or measured meanwhile. */
const kindsIn = (mode: PlaceMode) => createRoot(() => createMemo(() => (placesHidden() ? [] : POI_CATEGORIES.filter((category) => placeMode(category.id) === mode))));
const allKinds = kindsIn('all');
const alongKinds = kindsIn('along');

/** Whether the map is too far out to show all places in view of the kinds that want them. */
export const isTooFarOut = (): boolean => allKinds().length > 0 && (mapView()?.zoom ?? 0) < PLACES_MIN_ZOOM;

/** The tiles in view, where kinds want all their places and the map is near enough. */
const viewTiles = createRoot(() =>
  createMemo((): Tile[] => {
    const view = mapView();
    return allKinds().length > 0 && view && view.zoom >= PLACES_MIN_ZOOM ? tilesOfView(...view.bounds) : [];
  }),
);

/** The tiles along the day's routes, within the widest distance of the kinds that want their places there. */
const alongTiles = createRoot(() =>
  createMemo((): Tile[] => {
    const kinds = alongKinds();
    const lines = alongLines();
    return kinds.length > 0 && lines.length > 0 ? tilesAlong(lines, Math.max(...kinds.map((kind) => placeReachM(kind.id)))) : [];
  }),
);

/** The places read so far, by tile and kind. */
const [read, setRead] = createSignal<ReadonlyMap<string, Place[]>>(new Map());
/** The tiles and kinds asked for, read or not. */
const asked = new Set<string>();
const keyOf = (tile: Tile, kindId: string): string => `${tile.x}/${tile.y}/${kindId}`;

/** Reads the kinds of the tiles not asked for yet; a tile that fails is asked for again when it is wanted next. */
function readMissing(tiles: readonly Tile[], kinds: readonly PoiCategory[]): void {
  for (const tile of tiles) {
    const missing = kinds.filter((kind) => !asked.has(keyOf(tile, kind.id)));
    if (missing.length === 0) continue;
    for (const kind of missing) asked.add(keyOf(tile, kind.id));
    fetchPlaces(tile.x, tile.y, missing.map((kind) => kind.id)).then(
      (places) => {
        const next = new Map(read());
        for (const kind of missing) next.set(keyOf(tile, kind.id), places.filter((place) => place.kind === kind.id).map((place) => ({ id: place.id, category: kind, lngLat: place.lngLat, tags: place.tags })));
        setRead(next);
      },
      () => missing.forEach((kind) => asked.delete(keyOf(tile, kind.id))),
    );
  }
}

createRoot(() => {
  createEffect(() => readMissing(viewTiles(), allKinds()));
  createEffect(() => readMissing(alongTiles(), alongKinds()));
});

/** The places read of the kinds in the tiles. */
const readIn = (tiles: readonly Tile[], kinds: readonly PoiCategory[]): Place[] => tiles.flatMap((tile) => kinds.flatMap((kind) => read().get(keyOf(tile, kind.id)) ?? []));

/** The places of the store along the day's routes, apart from those in view, so that moving the map does not measure them again. */
const alongPlaces = createRoot(() => createMemo(() => placesNear(readIn(alongTiles(), alongKinds()), alongLines(), (place) => placeReachM(place.category.id))));

/** The places of the store the map shows. */
export const placesOnMap = createRoot(() => createMemo((): Place[] => [...readIn(viewTiles(), allKinds()), ...alongPlaces()]));
