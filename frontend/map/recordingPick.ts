import type { Map as MapLibreMap } from 'maplibre-gl';
import { planeAt } from '../geo/measure';
import type { LngLat } from '../model/trip';
import type { RecordedTrack } from '../recording/track';
import { nearestOnLines, type XY } from '../geo/nearest';
import { opened } from '../state/recordingView';
import { loadedTrack, shownRecordings } from '../state/recordings';
import { toLngLat } from './markers';
import { RECORDING_LINE_LAYERS } from './recordingOverlay';

/** Each track's points in a plane around its first, with the search for the nearest, made once: a mouse asks at every frame. */
const indexes = new WeakMap<RecordedTrack, { plane: (p: LngLat) => XY; nearest: ReturnType<typeof nearestOnLines> }>();

function indexOf(track: RecordedTrack) {
  let index = indexes.get(track);
  if (!index) {
    const plane = planeAt(track.points[0]!);
    index = { plane, nearest: nearestOnLines([track.points.map(plane)]) };
    indexes.set(track, index);
  }
  return index;
}

/** The recording whose line a tap hits within `reach` CSS pixels, the opened one first, or only the recording `only`, and its point nearest the tap. */
export function recordingPointAt(map: MapLibreMap, tap: { x: number; y: number }, reach: number, only?: number): { id: number; index: number } | undefined {
  const hits = map.queryRenderedFeatures(
    [
      [tap.x - reach, tap.y - reach],
      [tap.x + reach, tap.y + reach],
    ],
    { layers: RECORDING_LINE_LAYERS },
  );
  const ids = hits.map((feature) => feature.properties.id as number);
  const openedId = opened()?.recording.id;
  const id = only ?? (openedId !== undefined && ids.includes(openedId) ? openedId : ids[0]);
  if (id === undefined || !ids.includes(id)) return undefined;
  const recording = shownRecordings().find((r) => r.id === id);
  const track = recording && loadedTrack(recording);
  if (!track) return undefined;
  const { plane, nearest } = indexOf(track);
  const place = nearest(plane(toLngLat(map.unproject([tap.x, tap.y]))))!;
  return { id: recording.id, index: place.segment + (place.t > 0.5 ? 1 : 0) };
}
