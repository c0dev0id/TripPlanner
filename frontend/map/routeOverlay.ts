import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import type { Day, LngLat, Route } from '../model/trip';
import { atZooms, lineAt } from './zoomSize';
import { legCoordinates, legState, routeLegs, type LegState } from '../routing/legs';

/** The source and layers of the route lines, the free stops' marks and the other days' stops, and their features. */

export const ROUTES_SOURCE = 'routes';

/** The layer of the routes' lines as they are drawn, by which a route is found under the pointer. */
export const ROUTE_LINE_LAYER = `${ROUTES_SOURCE}-line`;

/** A day's routes on the map: the one being edited, the others of the selected day, the neighbouring days. */
export type RouteRole = 'edited' | 'selected' | 'neighbour';

/** Bound stops, and free stops with their marks on the route. */
export const BOUND_COLOR = '#d9480f';
export const FREE_COLOR = '#1971c2';
const DIM_STOP_COLOR = '#868e96';

/** Legs drawn as part of the route: routed, straight by choice, or a track's line. Pending and failed legs are dashed. */
const DRAWN: FilterSpecification = ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'state'], ['literal', ['routed', 'straight', 'track']]]];

/** Rounded joins and ends; the edited route over the selected day's others, those over the neighbours. */
const LINE_LAYOUT: LineLayerSpecification['layout'] = {
  'line-join': 'round',
  'line-cap': 'round',
  'line-sort-key': ['match', ['get', 'role'], 'edited', 2, 'selected', 1, 0],
};

/**
 * The layers of the routes, a line `width` pixels wide at the zooms a trip is planned at
 * and wider closer in, over a base map drawn sharp up to the zoom `sharpUntil`: the edited
 * route wider than the others, the neighbouring days' narrower and paler.
 */
export function routeLayers(width: number, sharpUntil: number): LayerSpecification[] {
  /** The width by the route's role; under the pointer (see RouteHover), as wide as the edited route. */
  const byRole = (zoom: number, casing: number): ExpressionSpecification => {
    const line = lineAt(zoom, width, sharpUntil);
    return ['case', ['boolean', ['feature-state', 'hover'], false], line * 1.4 + casing, ['match', ['get', 'role'], 'edited', line * 1.4 + casing, 'neighbour', line * 0.7 + casing, line + casing]];
  };
  return [
    {
      id: `${ROUTES_SOURCE}-casing`,
      type: 'line',
      source: ROUTES_SOURCE,
      filter: DRAWN,
      layout: LINE_LAYOUT,
      paint: { 'line-color': '#ffffff', 'line-width': atZooms((zoom) => byRole(zoom, 3.5)), 'line-opacity': ['match', ['get', 'role'], 'neighbour', 0.5, 0.9] },
    },
    {
      id: ROUTE_LINE_LAYER,
      type: 'line',
      source: ROUTES_SOURCE,
      filter: DRAWN,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': atZooms((zoom) => byRole(zoom, 0)), 'line-opacity': ['match', ['get', 'role'], 'neighbour', 0.55, 1] },
    },
    {
      id: `${ROUTES_SOURCE}-unrouted`,
      type: 'line',
      source: ROUTES_SOURCE,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'state'], ['literal', ['pending', 'failed']]]],
      paint: {
        'line-color': ['match', ['get', 'state'], 'failed', '#e03131', '#495057'],
        'line-width': atZooms((zoom) => lineAt(zoom, width, sharpUntil) * 0.6),
        'line-dasharray': [2, 2],
      },
    },
    {
      // Drawn on the map rather than as markers, which a trip of thousands of stops made slow.
      id: `${ROUTES_SOURCE}-dim-stops`,
      type: 'circle',
      source: ROUTES_SOURCE,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'dim']],
      paint: { 'circle-radius': 3, 'circle-color': DIM_STOP_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    },
    {
      id: `${ROUTES_SOURCE}-marks`,
      type: 'circle',
      source: ROUTES_SOURCE,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'dim']]],
      paint: { 'circle-radius': 5, 'circle-color': FREE_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    },
  ];
}

/**
 * The legs of the days shown as lines with their route and its day, their role, their routing state and the colour
 * `colors` holds for their route, consecutive legs of a route in the same state as one
 * line, a mark at each spot given (where a free stop is nearest to the route), and a grey
 * dot at each of `dimStops` (the stops of the days shown that are not selected). Only the
 * routes `drawn` says are on the map get lines.
 */
export function routeFeatures(
  days: readonly { day: Day; role: RouteRole }[],
  colors: ReadonlyMap<string, string>,
  editingRouteId: string | undefined,
  failed: ReadonlySet<string>,
  marks: readonly LngLat[],
  dimStops: readonly LngLat[] = [],
  drawn: (route: Route) => boolean = () => true,
): FeatureCollection<Geometry> {
  const features: Feature<Geometry>[] = [];
  for (const { day, role } of days) {
    for (const route of day.routes.filter(drawn)) {
      const routeRole: RouteRole = route.id === editingRouteId ? 'edited' : role;
      // The lines of consecutive legs in the same state; a run of one leg, such as a track, keeps its line as it is.
      const runs: { state: LegState; parts: LngLat[][] }[] = [];
      for (const leg of routeLegs(route)) {
        const state = legState(route, leg, failed);
        const last = runs.at(-1);
        if (last?.state === state) last.parts.push(legCoordinates(route, leg));
        else runs.push({ state, parts: [legCoordinates(route, leg)] });
      }
      for (const { state, parts } of runs) {
        const coordinates = parts.length === 1 ? parts[0]! : parts.flatMap((part, i) => (i === 0 ? part : part.slice(1)));
        features.push({ type: 'Feature', properties: { route: route.id, day: day.id, state, role: routeRole, color: colors.get(route.id) }, geometry: { type: 'LineString', coordinates } });
      }
    }
  }
  for (const lngLat of marks) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lngLat } });
  for (const lngLat of dimStops) features.push({ type: 'Feature', properties: { dim: true }, geometry: { type: 'Point', coordinates: lngLat } });
  return { type: 'FeatureCollection', features };
}
