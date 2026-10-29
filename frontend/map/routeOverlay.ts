import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { FilterSpecification, LayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import type { Day, LngLat } from '../model/trip';
import { legCoordinates, legState, routeLegs, type LegState } from '../routing/legs';
import { decodeCached } from '../routing/polyline';

/** The source and layers of the route lines and the free stops' marks, and their features. */

export const ROUTES_SOURCE = 'routes';

/** A day's routes on the map: the one being edited, the others of the selected day, the neighbouring days. */
export type RouteRole = 'edited' | 'selected' | 'neighbour';

/** Bound stops and the routes, and free stops with their marks on the route. */
export const BOUND_COLOR = '#d9480f';
export const FREE_COLOR = '#1971c2';
const NEIGHBOUR_COLOR = '#adb5bd';

/** Legs drawn as part of the route: routed, or straight by choice. Pending and failed legs are dashed. */
const DRAWN: FilterSpecification = ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'state'], ['literal', ['routed', 'straight']]]];

/** Rounded joins and ends; the edited route over the selected day's others, those over the neighbours. */
const LINE_LAYOUT: LineLayerSpecification['layout'] = {
  'line-join': 'round',
  'line-cap': 'round',
  'line-sort-key': ['match', ['get', 'role'], 'edited', 2, 'selected', 1, 0],
};

export const ROUTE_LAYERS: LayerSpecification[] = [
  {
    id: `${ROUTES_SOURCE}-casing`,
    type: 'line',
    source: ROUTES_SOURCE,
    filter: DRAWN,
    layout: LINE_LAYOUT,
    paint: { 'line-color': '#ffffff', 'line-width': ['match', ['get', 'role'], 'edited', 9, 'selected', 7, 5], 'line-opacity': 0.85 },
  },
  {
    id: `${ROUTES_SOURCE}-line`,
    type: 'line',
    source: ROUTES_SOURCE,
    filter: DRAWN,
    layout: LINE_LAYOUT,
    paint: {
      'line-color': ['match', ['get', 'role'], 'neighbour', NEIGHBOUR_COLOR, BOUND_COLOR],
      'line-width': ['match', ['get', 'role'], 'edited', 5, 'selected', 3.5, 2.5],
      'line-opacity': ['match', ['get', 'role'], 'selected', 0.7, 1],
    },
  },
  {
    id: `${ROUTES_SOURCE}-unrouted`,
    type: 'line',
    source: ROUTES_SOURCE,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'state'], ['literal', ['pending', 'failed']]]],
    paint: {
      'line-color': ['match', ['get', 'state'], 'failed', '#e03131', '#495057'],
      'line-width': 2.5,
      'line-dasharray': [2, 2],
    },
  },
  {
    id: `${ROUTES_SOURCE}-marks`,
    type: 'circle',
    source: ROUTES_SOURCE,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 5, 'circle-color': FREE_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  },
];

/**
 * The legs of the days shown as lines with their role and routing state, consecutive legs
 * of a route in the same state as one line (a track of thousands of straight legs is one),
 * and a mark at each spot given (where a free stop is nearest to the route).
 */
export function routeFeatures(days: readonly { day: Day; role: RouteRole }[], editingRouteId: string | undefined, failed: ReadonlySet<string>, marks: readonly LngLat[]): FeatureCollection<Geometry> {
  const features: Feature<Geometry>[] = [];
  for (const { day, role } of days) {
    for (const route of day.routes) {
      const routeRole: RouteRole = route.id === editingRouteId ? 'edited' : role;
      let line: { state: LegState; coordinates: LngLat[] } | undefined;
      for (const leg of routeLegs(route)) {
        const state = legState(route, leg, failed);
        const coordinates = legCoordinates(route, leg, decodeCached);
        if (line?.state === state) {
          for (let i = 1; i < coordinates.length; i++) line.coordinates.push(coordinates[i]!);
          continue;
        }
        line = { state, coordinates: [...coordinates] };
        features.push({ type: 'Feature', properties: { state, role: routeRole }, geometry: { type: 'LineString', coordinates: line.coordinates } });
      }
    }
  }
  for (const lngLat of marks) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lngLat } });
  return { type: 'FeatureCollection', features };
}
