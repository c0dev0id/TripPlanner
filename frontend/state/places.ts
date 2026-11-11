import { createEffect, createMemo, createRoot, createSignal } from 'solid-js';
import { fetchPlaces } from '../api';
import { POI_CATEGORIES, type Place, type PoiCategory } from '../poi/categories';
import { placesNear } from '../poi/near';
import { tilesAlong, tilesOfView, type Tile } from '../poi/tiles';
import { routeLine } from '../routing/legs';
import { readPreference, writePreference } from '../ui/preferences';
import { placeReachM } from './preferences';
import { selectedDay } from './trip';

/**
 * The places on the map: of the kinds switched on, read tile by tile from the planner's own
 * store, either those along the selected day's routes or all in view. Which kinds are on
 * and which of the two is kept for this browser.
 */

/** From this zoom on the map shows all places in view; farther out there are too many. */
export const PLACES_MIN_ZOOM = 10;

const [shownIds, setShownIds] = createSignal<readonly string[]>((readPreference('placeKinds') ?? '').split(',').filter((id) => POI_CATEGORIES.some((c) => c.id === id)));

export const isKindShown = (category: PoiCategory): boolean => shownIds().includes(category.id);

const shownKinds = createRoot(() => createMemo(() => POI_CATEGORIES.filter(isKindShown)));

export const shownKindCount = (): number => shownKinds().length;

/** Whether the list of kinds is open in the panel. */
export const [placesListOpen, setPlacesListOpen] = createSignal(false);

export function toggleKind(category: PoiCategory): void {
  const ids = isKindShown(category) ? shownIds().filter((id) => id !== category.id) : [...shownIds(), category.id];
  setShownIds(ids);
  writePreference('placeKinds', ids.length > 0 ? ids.join(',') : undefined);
}

/** Whether only the places along the selected day's routes are shown, each kind within its distance. */
const [alongOnly, setAlongOnly] = createSignal(readPreference('placesAlong') !== 'no');
export { alongOnly };

export function toggleAlongOnly(): void {
  setAlongOnly(!alongOnly());
  writePreference('placesAlong', alongOnly() ? undefined : 'no');
}

/** The lines of the selected day's routes, where places are shown along them. */
const routeLines = createRoot(() =>
  createMemo(() => (alongOnly() ? (selectedDay()?.routes ?? []).map(routeLine).filter((line) => line.length > 1) : [])),
);

/** What the map shows: its bounds (west, south, east, north) and zoom, as the map says them. */
export const [mapView, setMapView] = createSignal<{ bounds: [number, number, number, number]; zoom: number }>();

/** Whether the map is too far out to show all places in view. */
export const isTooFarOut = (): boolean => routeLines().length === 0 && (mapView()?.zoom ?? 0) < PLACES_MIN_ZOOM;

/** The tiles whose places are wanted: along the routes within the widest distance, or those in view. */
const wantedTiles = createRoot(() =>
  createMemo((): Tile[] => {
    const kinds = shownKinds();
    if (kinds.length === 0) return [];
    const lines = routeLines();
    if (lines.length > 0) return tilesAlong(lines, Math.max(...kinds.map((kind) => placeReachM(kind.id))));
    const view = mapView();
    return view && view.zoom >= PLACES_MIN_ZOOM ? tilesOfView(...view.bounds) : [];
  }),
);

/** The places read so far, by tile and kind. */
const [read, setRead] = createSignal<ReadonlyMap<string, Place[]>>(new Map());
/** The tiles and kinds asked for, read or not. */
const asked = new Set<string>();
const keyOf = (tile: Tile, kindId: string): string => `${tile.x}/${tile.y}/${kindId}`;

createRoot(() => {
  // Reads what is wanted and not asked for yet; a tile that fails is asked for again when it is wanted next.
  createEffect(() => {
    const kinds = shownKinds();
    for (const tile of wantedTiles()) {
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
  });
});

/** The places the map shows. */
export const placesOnMap = createRoot(() =>
  createMemo((): Place[] => {
    const places = wantedTiles().flatMap((tile) => shownKinds().flatMap((kind) => read().get(keyOf(tile, kind.id)) ?? []));
    const lines = routeLines();
    return lines.length > 0 ? placesNear(places, lines, placeReachM) : places;
  }),
);
