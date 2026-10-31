import { Popup, type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, onCleanup } from 'solid-js';
import { render } from 'solid-js/web';
import { DIFFERENCE_FIGURES, FIGURES, METRICS } from '../recording/figures';
import { SURFACES } from '../recording/lineColors';
import { comparison, hoverIndex, opened, openedSurfaces, pickedIndex, setPickedIndex } from '../state/recordingView';
import { Figures } from '../ui/Figures';
import { clockText, distanceText } from '../ui/format';
import { RECORDING_POINT_SOURCE, recordingPointFeatures } from './recordingOverlay';

/** The series of a file that the measures stand for; the others are listed as the file names them. */
const MEASURED = new Set(['time', 'ele', 'speed', 'lean_angle']);

/** Everything known of the picked point of the opened recording: where along it lies, when, its measures, its surface, the file's other values, and how it differs from what the recording is compared with. */
function PointDetails() {
  const rows = (): [string, string][] => {
    const o = opened();
    const i = pickedIndex();
    if (!o || i === undefined) return [];
    const m = o.measures;
    const rows: [string, string][] = [['Along', distanceText(m.distance[i]!)]];
    const time = m.time?.[i];
    if (time !== null && time !== undefined) rows.push(['Time', clockText(time)]);
    for (const metric of METRICS) {
      const value = m[metric]?.[i];
      if (value !== null && value !== undefined) rows.push([FIGURES[metric].label, FIGURES[metric].text(value)]);
    }
    const surfaces = openedSurfaces();
    if (Array.isArray(surfaces)) rows.push(['Surface', SURFACES.find((s) => s.key === surfaces[i])?.label ?? 'No road matched']);
    for (const [name, values] of Object.entries(o.track.series)) {
      const value = values[i];
      if (!MEASURED.has(name) && value !== null && value !== undefined) rows.push([name, String(Math.round(value * 100) / 100)]);
    }
    const c = comparison();
    if (c) {
      rows.push(['Against', c.name]);
      for (const key of ['offset', 'time', 'speed', 'lean'] as const) {
        const value = c.delta[key]?.[i];
        if (value !== null && value !== undefined && Number.isFinite(value)) rows.push([DIFFERENCE_FIGURES[key].label, DIFFERENCE_FIGURES[key].text(value)]);
      }
    }
    return rows;
  };
  return (
    <>
      <h4>{opened()?.recording.name}</h4>
      <Figures rows={rows()} />
    </>
  );
}

/** The opened recording's point under the pointer in its chart or else the one picked, marked on its line; the picked one with its details in a popup. */
export function RecordingPoint(props: { map: MapLibreMap }) {
  createEffect(() => {
    const o = opened();
    const i = hoverIndex() ?? pickedIndex();
    props.map.getSource<GeoJSONSource>(RECORDING_POINT_SOURCE)?.setData(recordingPointFeatures(o && i !== undefined ? o.track.points[i] : undefined));
  });

  const content = document.createElement('div');
  const dispose = render(() => <PointDetails />, content);
  const popup = new Popup({ closeOnClick: false, maxWidth: '280px', offset: 10, className: 'recording-point' }).setDOMContent(content);
  popup.on('close', () => setPickedIndex(undefined));
  createEffect(() => {
    const o = opened();
    const i = pickedIndex();
    if (!o || i === undefined) {
      popup.remove();
      return;
    }
    popup.setLngLat(o.track.points[i]!);
    if (!popup.isOpen()) popup.addTo(props.map);
  });
  onCleanup(() => {
    popup.remove();
    dispose();
  });
  return null;
}
