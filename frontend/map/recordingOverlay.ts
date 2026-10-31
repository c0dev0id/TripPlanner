import type { FeatureCollection, LineString, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { LngLat } from '../model/trip';

/**
 * The sources and layers of the recordings shown, each in its colour, under the planned
 * routes: the opened one in a source of its own, drawn over the others, which often ran
 * the same roads, and set again alone when its colouring changes.
 */

export const RECORDINGS_SOURCE = 'recordings';
export const OPENED_RECORDING_SOURCE = 'recording-opened';

const SOURCES = [RECORDINGS_SOURCE, OPENED_RECORDING_SOURCE];

/** The layers whose lines a tap on a recording hits. */
export const RECORDING_LINE_LAYERS = SOURCES.map((source) => `${source}-line`);

export const RECORDING_LAYERS: LayerSpecification[] = SOURCES.flatMap((source): LayerSpecification[] => [
  {
    id: `${source}-casing`,
    type: 'line',
    source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.8 },
  },
  {
    id: `${source}-line`,
    type: 'line',
    source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 },
  },
]);

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
