import type { FeatureCollection, LineString, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { LngLat } from '../model/trip';

/** The source and layers of the recordings shown, each in its colour, under the planned routes. */

export const RECORDINGS_SOURCE = 'recordings';

export const RECORDING_LINE_LAYER = `${RECORDINGS_SOURCE}-line`;

export const RECORDING_LAYERS: LayerSpecification[] = [
  {
    id: `${RECORDINGS_SOURCE}-casing`,
    type: 'line',
    source: RECORDINGS_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 },
  },
  {
    id: RECORDING_LINE_LAYER,
    type: 'line',
    source: RECORDINGS_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 },
  },
];

/** The lines of the recordings, a feature each or, coloured by a measure, a feature per piece of one colour; each with its recording's id. */
export function recordingFeatures(lines: readonly { id: number; points: readonly LngLat[]; color: string }[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: lines.map(({ id, points, color }) => ({ type: 'Feature', properties: { id, color }, geometry: { type: 'LineString', coordinates: points as LngLat[] } })),
  };
}

/** The point of the opened recording picked or under the pointer in its chart, over the routes. */
export const RECORDING_POINT_SOURCE = 'recording-point';

export const RECORDING_POINT_LAYERS: LayerSpecification[] = [
  {
    id: RECORDING_POINT_SOURCE,
    type: 'circle',
    source: RECORDING_POINT_SOURCE,
    paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#212529', 'circle-stroke-width': 3 },
  },
];

export function recordingPointFeatures(at: LngLat | undefined): FeatureCollection<Point> {
  return { type: 'FeatureCollection', features: at ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [...at] } }] : [] };
}
