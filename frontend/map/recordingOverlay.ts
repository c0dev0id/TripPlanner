import type { FeatureCollection, LineString } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { LngLat } from '../model/trip';

/** The source and layers of the recordings shown, each in its colour, under the planned routes. */

export const RECORDINGS_SOURCE = 'recordings';

export const RECORDING_LAYERS: LayerSpecification[] = [
  {
    id: `${RECORDINGS_SOURCE}-casing`,
    type: 'line',
    source: RECORDINGS_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 },
  },
  {
    id: `${RECORDINGS_SOURCE}-line`,
    type: 'line',
    source: RECORDINGS_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 },
  },
];

export function recordingFeatures(lines: readonly { points: readonly LngLat[]; color: string }[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: lines.map(({ points, color }) => ({ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: points as LngLat[] } })),
  };
}
