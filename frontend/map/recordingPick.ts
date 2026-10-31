import type { Map as MapLibreMap } from 'maplibre-gl';
import { planeAt } from '../geo/measure';
import { opened } from '../state/recordingView';
import { shownRecordings, trackOf } from '../state/recordings';
import { toLngLat } from './markers';
import { RECORDING_LINE_LAYER } from './recordingOverlay';

/** The recording whose line a tap hits within `reach` CSS pixels, the opened one first, and its point nearest the tap. */
export function recordingPointAt(map: MapLibreMap, tap: { x: number; y: number }, reach: number): { id: number; index: number } | undefined {
  const hits = map.queryRenderedFeatures(
    [
      [tap.x - reach, tap.y - reach],
      [tap.x + reach, tap.y + reach],
    ],
    { layers: [RECORDING_LINE_LAYER] },
  );
  const ids = hits.map((feature) => feature.properties.id as number);
  const openedId = opened()?.recording.id;
  const id = openedId !== undefined && ids.includes(openedId) ? openedId : ids[0];
  const recording = shownRecordings().find((r) => r.id === id);
  const track = recording && trackOf(recording);
  if (!track || track instanceof Error) return undefined;
  const plane = planeAt(toLngLat(map.unproject([tap.x, tap.y])));
  let index = 0;
  let nearest = Infinity;
  track.points.forEach((point, i) => {
    const [x, y] = plane(point);
    if (x * x + y * y < nearest) {
      nearest = x * x + y * y;
      index = i;
    }
  });
  return { id: recording.id, index };
}
