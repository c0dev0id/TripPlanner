import type { FeatureCollection, LineString } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { LngLat } from '../model/trip';

/** The line from a position to the nearest place on what the map draws, over everything else. */
export const REACH_SOURCE = 'reach';

export const REACH_LAYERS: LayerSpecification[] = [
  { id: `${REACH_SOURCE}-casing`, type: 'line', source: REACH_SOURCE, paint: { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.7 } },
  { id: REACH_SOURCE, type: 'line', source: REACH_SOURCE, paint: { 'line-color': '#212529', 'line-width': 1.5, 'line-dasharray': [3, 3] } },
];

/** The line between two positions as a feature, or none where one is missing. */
export function reachFeatures(from: LngLat | undefined, to: LngLat | undefined): FeatureCollection<LineString> {
  return { type: 'FeatureCollection', features: from && to ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[...from], [...to]] } }] : [] };
}
