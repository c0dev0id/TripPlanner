import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { FilterSpecification, LayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import type { LngLat, Trip } from '../model/trip';
import { legCoordinates, legState, routeLegs } from '../routing/legs';
import { decodePolyline } from '../routing/polyline';

/** The source and layers of the route lines, and their features from the trip. */

export const ROUTES_SOURCE = 'routes';

/** The selected day's routes, and the other days'. */
const SELECTED_COLOR = '#d9480f';
const OTHER_COLOR = '#868e96';

/** Legs drawn as part of the route: routed, or straight by choice. Pending and failed legs are dashed. */
const DRAWN: FilterSpecification = ['in', ['get', 'state'], ['literal', ['routed', 'straight']]];

/** Rounded joins and ends; the selected day's lines are drawn over the others. */
const LINE_LAYOUT: LineLayerSpecification['layout'] = { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['case', ['get', 'selected'], 1, 0] };

export const ROUTE_LAYERS: LayerSpecification[] = [
  {
    id: `${ROUTES_SOURCE}-casing`,
    type: 'line',
    source: ROUTES_SOURCE,
    filter: DRAWN,
    layout: LINE_LAYOUT,
    paint: { 'line-color': '#ffffff', 'line-width': ['case', ['get', 'selected'], 8, 5], 'line-opacity': 0.85 },
  },
  {
    id: `${ROUTES_SOURCE}-line`,
    type: 'line',
    source: ROUTES_SOURCE,
    filter: DRAWN,
    layout: LINE_LAYOUT,
    paint: { 'line-color': ['case', ['get', 'selected'], SELECTED_COLOR, OTHER_COLOR], 'line-width': ['case', ['get', 'selected'], 4, 2.5] },
  },
  {
    id: `${ROUTES_SOURCE}-unrouted`,
    type: 'line',
    source: ROUTES_SOURCE,
    filter: ['in', ['get', 'state'], ['literal', ['pending', 'failed']]],
    paint: {
      'line-color': ['match', ['get', 'state'], 'failed', '#e03131', '#495057'],
      'line-width': 2.5,
      'line-dasharray': [2, 2],
    },
  },
];

/** Decoded leg geometries of the last drawing; polyline strings are immutable, so they are their own cache key. */
let decoded = new Map<string, LngLat[]>();

/** Decodes a leg's geometry, from the cache where the map has drawn it. */
export const decodeCached = (geometry: string): LngLat[] => decoded.get(geometry) ?? decodePolyline(geometry);

/**
 * Every leg of every route as a line: routed and straight legs solid, in the selected
 * day's colour or grey, pending legs grey dashed, failed legs red dashed. The lines hold
 * no store proxies: decoded geometries are plain, and legCoordinates copies the ends.
 */
export function routeFeatures(trip: Trip | undefined, selectedDayId: string | undefined, failed: ReadonlySet<string>): FeatureCollection<LineString> {
  const decodedNow = new Map<string, LngLat[]>();
  const decode = (geometry: string) => {
    const coordinates = decodeCached(geometry);
    decodedNow.set(geometry, coordinates);
    return coordinates;
  };
  const features: Feature<LineString>[] = [];
  for (const day of trip?.days ?? []) {
    const selected = day.id === selectedDayId;
    for (const route of day.routes) {
      for (const leg of routeLegs(route)) {
        const coordinates = legCoordinates(route, leg, decode);
        features.push({ type: 'Feature', properties: { state: legState(route, leg, failed), selected }, geometry: { type: 'LineString', coordinates } });
      }
    }
  }
  decoded = decodedNow;
  return { type: 'FeatureCollection', features };
}
