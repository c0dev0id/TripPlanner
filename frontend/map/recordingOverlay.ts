import type { FeatureCollection, LineString, Point } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { LngLat } from '../model/trip';
import { atZooms, lineAt } from './zoomSize';

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

/**
 * The layers that draw a source's lines, each in the colour it carries, on a white
 * casing: as wide as a route of `width` pixels is at each zoom, over a base map drawn
 * sharp up to the zoom `sharpUntil` (see routeLayers).
 */
const lineLayers = (source: string, width: number, sharpUntil: number): LayerSpecification[] => [
  {
    id: `${source}-casing`,
    type: 'line',
    source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': atZooms((zoom) => lineAt(zoom, width, sharpUntil) + 2.5), 'line-opacity': 0.8 },
  },
  {
    id: `${source}-line`,
    type: 'line',
    source,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': atZooms((zoom) => lineAt(zoom, width, sharpUntil)) },
  },
];

export const recordingLayers = (width: number, sharpUntil: number): LayerSpecification[] => SOURCES.flatMap((source) => lineLayers(source, width, sharpUntil));

/** The routes the duplicates report compares, each in its colour, over the planned routes. */
export const COMPARED_SOURCE = 'compared';

export const comparedLayers = (width: number, sharpUntil: number): LayerSpecification[] => lineLayers(COMPARED_SOURCE, width, sharpUntil);

/** Lines as features, each with its colour and an id: the recordings, a feature each or, coloured by a measure, a feature per piece of one colour, with the recording's id; or the routes compared. */
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
