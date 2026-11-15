import { t } from '../i18n/t';
import { Popup, type GeoJSONSource, type MapMouseEvent, type Map as MapLibreMap } from 'maplibre-gl';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { render } from 'solid-js/web';
import { DIFFERENCE_FIGURES, FIGURES, METRICS } from '../recording/figures';
import type { Delta } from '../recording/delta';
import { isDifference, surfaceLabel, type Difference } from '../recording/lineColors';
import type { Metric } from '../recording/measures';
import { comparison, hoverIndex, opened, openedSurfaces, pickedIndex, setPickedIndex, shownColoring } from '../state/recordingView';
import { Figures } from '../ui/Figures';
import { clockText, distanceText } from '../ui/format';
import { RECORDING_POINT_SOURCE, recordingPointFeatures } from './recordingOverlay';
import { recordingPointAt } from './recordingPick';
import { tapReach } from './tapFilter';

/** The series of a file that the measures stand for; the others are listed as the file names them. */
const MEASURED = new Set(['time', 'ele', 'speed', 'lean_angle']);

/** What the differences of each focus on a difference are, by their series in the comparison. */
const DIFFERENCES: Record<Difference, readonly (keyof Delta)[]> = { offset: ['offset'], speedDifference: ['speed', 'time'], leanDifference: ['lean'] };

/**
 * What is known of a point of the opened recording, as far as the focus asks: where
 * along it lies, and the value focused on, or the differences of a difference focused
 * on; with no focus, its time, its measures, its surface and the file's other values.
 */
function PointDetails(props: { index: number | undefined }) {
  const rows = (): [string, string][] => {
    const o = opened();
    const i = props.index;
    if (!o || i === undefined) return [];
    const m = o.measures;
    const rows: [string, string][] = [[t('Along'), distanceText(m.distance[i]!)]];
    const measure = (metric: Metric) => {
      const value = m[metric]?.[i];
      if (value !== null && value !== undefined) rows.push([FIGURES[metric].label, FIGURES[metric].text(value)]);
    };
    const surface = () => {
      const surfaces = openedSurfaces();
      if (Array.isArray(surfaces)) rows.push([t('Surface'), surfaceLabel(surfaces[i]!)]);
    };
    const focus = shownColoring();
    if (focus === 'surface') surface();
    else if (focus !== undefined && isDifference(focus)) {
      const delta = comparison()?.delta;
      for (const key of DIFFERENCES[focus]) {
        const value = delta?.[key]?.[i];
        if (value !== null && value !== undefined && Number.isFinite(value)) rows.push([DIFFERENCE_FIGURES[key].label, DIFFERENCE_FIGURES[key].text(value)]);
      }
    } else if (focus !== undefined) measure(focus);
    else {
      const time = m.time?.[i];
      if (time !== null && time !== undefined) rows.push([t('Time'), clockText(time)]);
      METRICS.forEach(measure);
      surface();
      for (const [name, values] of Object.entries(o.track.series)) {
        const value = values[i];
        if (!MEASURED.has(name) && value !== null && value !== undefined) rows.push([name, String(Math.round(value * 100) / 100)]);
      }
    }
    return rows;
  };
  return <Figures rows={rows()} />;
}

/**
 * The opened recording's point under the pointer, in its chart or on its line, or else
 * the one picked, marked on its line, with its details in a popup. The popup follows a
 * mouse along the line and goes when it leaves it; a click on the line pins it there,
 * another click on the line moves it, and closing it lets it follow the mouse again.
 */
export function RecordingPoint(props: { map: MapLibreMap }) {
  /** The point of the opened recording's line under the mouse, while it is over the line. */
  const [onLine, setOnLine] = createSignal<number>();
  const shown = () => pickedIndex() ?? onLine();
  createEffect(() => {
    const o = opened();
    const i = hoverIndex() ?? shown();
    props.map.getSource<GeoJSONSource>(RECORDING_POINT_SOURCE)?.setData(recordingPointFeatures(o && i !== undefined ? o.track.points[i] : undefined));
  });

  let frame = 0;
  const follow = (e: MapMouseEvent) => {
    if (!opened() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const id = opened()?.recording.id;
      setOnLine(id === undefined ? undefined : recordingPointAt(props.map, e.point, tapReach(false), id)?.index);
    });
  };
  const leave = () => setOnLine(undefined);
  props.map.on('mousemove', follow);
  props.map.getCanvas().addEventListener('mouseleave', leave);

  const content = document.createElement('div');
  const dispose = render(() => <PointDetails index={shown()} />, content);
  const popup = new Popup({ closeOnClick: false, maxWidth: '280px', offset: 10, className: 'recording-point' }).setDOMContent(content);
  popup.on('close', () => setPickedIndex(undefined));
  createEffect(() => {
    const o = opened();
    const i = shown();
    if (!o || i === undefined) {
      popup.remove();
      return;
    }
    popup.setLngLat(o.track.points[i]!);
    if (!popup.isOpen()) popup.addTo(props.map);
    // Only a pinned popup has its close button and takes the pointer; one that follows the mouse lets it through to the line. The class takes once the popup is on the map.
    if (pickedIndex() === undefined) popup.addClassName('following');
    else popup.removeClassName('following');
  });
  onCleanup(() => {
    cancelAnimationFrame(frame);
    props.map.off('mousemove', follow);
    props.map.getCanvas().removeEventListener('mouseleave', leave);
    popup.remove();
    dispose();
  });
  return null;
}

