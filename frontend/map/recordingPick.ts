import type { Map as MapLibreMap } from 'maplibre-gl';
import { planeAt } from '../geo/measure';
import { nearestOnLines } from '../geo/nearest';
import { opened } from '../state/recordingView';
import { loadedTrack, shownRecordings } from '../state/recordings';
import { toLngLat } from './markers';
import { RECORDING_LINE_LAYERS } from './recordingOverlay';

/** The recording whose line a tap hits within `reach` CSS pixels, the opened one first, and its point nearest the tap. */
export function recordingPointAt(map: MapLibreMap, tap: { x: number; y: number }, reach: number): { id: number; index: number } | undefined {
  const hits = map.queryRenderedFeatures(
    [
      [tap.x - reach, tap.y - reach],
      [tap.x + reach, tap.y + reach],
    ],
    { layers: RECORDING_LINE_LAYERS },
  );
  const ids = hits.map((feature) => feature.properties.id as number);
  const openedId = opened()?.recording.id;
  const id = openedId !== undefined && ids.includes(openedId) ? openedId : ids[0];
  const recording = shownRecordings().find((r) => r.id === id);
  const track = recording && loadedTrack(recording);
  if (!track) return undefined;
  // In a plane around the tap, the tap is its origin.
  const plane = planeAt(toLngLat(map.unproject([tap.x, tap.y])));
  const place = nearestOnLines([track.points.map(plane)])([0, 0])!;
  return { id: recording.id, index: place.segment + (place.t > 0.5 ? 1 : 0) };
}
