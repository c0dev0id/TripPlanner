import { createEffect, createMemo, createRoot, createSignal, on } from 'solid-js';
import type { Recording } from '../api';
import { lineColors, type Coloring } from '../recording/lineColors';
import { measuresOf, type Measures } from '../recording/measures';
import { trackSurfaces } from '../recording/surfaces';
import type { RecordedTrack } from '../recording/track';
import { shownRecordings, trackOf } from './recordings';
import { openTripId } from './trip';

/**
 * The recording opened for its figures: its cards over the map, its line coloured by a
 * measure, and the point of it picked on the map or in its chart.
 */

const [openedId, setOpenedId] = createSignal<number>();

/** The point under the pointer in the chart, and the point picked on the map or by a click in the chart, by their index in the track. */
const [hoverIndex, setHoverIndex] = createSignal<number>();
const [pickedIndex, setPickedIndex] = createSignal<number>();
export { hoverIndex, pickedIndex, setHoverIndex, setPickedIndex };

/** Opens a recording's figures, or closes them; any point picked before is let go. */
export function openRecording(id: number | undefined): void {
  if (id !== openedId()) setPickedIndex(undefined);
  setHoverIndex(undefined);
  setOpenedId(id);
}

/** Picks a point of a recording, opening it. */
export function pickPoint(id: number, index: number): void {
  openRecording(id);
  setPickedIndex(index);
}

/** What the lines of opened recordings are coloured by; nothing for their own colour. */
const [coloring, setColoring] = createSignal<Coloring>();
export { setColoring };

/** The surfaces under each opened recording's points, once asked for, by recording id. */
const [surfaces, setSurfaces] = createSignal<ReadonlyMap<number, (string | null)[] | 'matching' | Error>>(new Map());

const keepSurfaces = (id: number, value: (string | null)[] | 'matching' | Error) => setSurfaces(new Map(surfaces()).set(id, value));

export interface Opened {
  recording: Recording;
  track: RecordedTrack;
  measures: Measures;
  /** The colourings its figures allow: the measures it has, and the surface. */
  colorings: Coloring[];
}

const view = createRoot(() => {
  const recording = createMemo(() => shownRecordings().find((r) => r.id === openedId()));
  const track = createMemo(() => {
    const r = recording();
    const t = r && trackOf(r);
    return t instanceof Error ? undefined : t;
  });
  const measures = createMemo(() => {
    const t = track();
    return t && measuresOf(t);
  });
  const opened = createMemo((): Opened | undefined => {
    const [r, t, m] = [recording(), track(), measures()];
    if (!r || !t || !m) return undefined;
    const colorings = (['speed', 'altitude', 'slope', 'lean'] as const).filter((metric) => m[metric] !== undefined);
    return { recording: r, track: t, measures: m, colorings: [...colorings, 'surface'] };
  });
  /** The colouring chosen where the opened recording allows it. */
  const shownColoring = createMemo(() => {
    const c = coloring();
    return c && opened()?.colorings.includes(c) ? c : undefined;
  });
  const openedSurfaces = () => {
    const o = opened();
    return o && surfaces().get(o.recording.id);
  };
  const colors = createMemo(() => {
    const [o, c, s] = [opened(), shownColoring(), openedSurfaces()];
    return o && c ? lineColors(c, o.measures, Array.isArray(s) ? s : undefined) : undefined;
  });

  // Another trip starts with no recording opened; surfaces are matched for this page only.
  createEffect(on(openTripId, () => openRecording(undefined)));
  // The surfaces are matched once a line is coloured by them.
  createEffect(() => {
    const o = opened();
    if (shownColoring() !== 'surface' || !o || surfaces().has(o.recording.id)) return;
    const id = o.recording.id;
    keepSurfaces(id, 'matching');
    trackSurfaces(o.track.points, o.measures.distance).then(
      (matched) => keepSurfaces(id, matched),
      (fault: unknown) => keepSurfaces(id, fault instanceof Error ? fault : new Error(String(fault))),
    );
  });
  return { opened, shownColoring, openedSurfaces, colors };
});

/** The opened recording with its track and measures, while it is shown and its track is read. */
export const opened = view.opened;

/** What the opened recording's line is coloured by, where it allows the colouring chosen. */
export const shownColoring = view.shownColoring;

/** The surfaces under the opened recording's points: being matched, matched, or why they could not be. */
export const openedSurfaces = view.openedSurfaces;

/** The colour of each point of the opened recording's line, while it is coloured by a measure it has. */
export const openedLineColors = view.colors;
