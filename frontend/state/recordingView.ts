import { createEffect, createMemo, createRoot, createSignal, on } from 'solid-js';
import type { Recording } from '../api';
import { deltaToTrack, offsetsFrom, type Delta } from '../recording/delta';
import { METRICS } from '../recording/figures';
import { colorAt, DIFFERENCE_SERIES, isDifference, scaleOf, surfaceColor, type Coloring, type Difference } from '../recording/lineColors';
import { measuresOf, type Measures } from '../recording/measures';
import { trackSurfaces } from '../recording/surfaces';
import type { RecordedTrack } from '../recording/track';
import { legCoordinates, routeLegs } from '../routing/legs';
import { shownRecordings, trackOf } from './recordings';
import { openTrip, openTripId } from './trip';

/**
 * The recording opened for its figures: its cards over the map, its line coloured by a
 * measure or a difference, what it is compared with, and the point of it picked on the
 * map or in its chart.
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

/** What the opened recording is compared with: the planned routes of its day, or another recording shown, by its id. */
export type Comparand = 'plan' | number;
const [comparand, setComparand] = createSignal<Comparand>();
export { setComparand };

/** The surfaces under each opened recording's points, once asked for, by recording id. */
const [surfaces, setSurfaces] = createSignal<ReadonlyMap<number, (string | null)[] | 'matching' | Error>>(new Map());

const keepSurfaces = (id: number, value: (string | null)[] | 'matching' | Error) => setSurfaces(new Map(surfaces()).set(id, value));

/** Each track's measures, worked out once. */
const measured = new WeakMap<RecordedTrack, Measures>();

function measuresFor(track: RecordedTrack): Measures {
  let measures = measured.get(track);
  if (!measures) {
    measures = measuresOf(track);
    measured.set(track, measures);
  }
  return measures;
}

export interface Opened {
  recording: Recording;
  track: RecordedTrack;
  measures: Measures;
}

/** The opened recording against what it is compared with, named as a sentence names it. */
export interface Comparison {
  comparand: Comparand;
  name: string;
  delta: Delta;
}

const view = createRoot(() => {
  const opened = createMemo((): Opened | undefined => {
    const recording = shownRecordings().find((r) => r.id === openedId());
    const track = recording && trackOf(recording);
    return recording && track && !(track instanceof Error) ? { recording, track, measures: measuresFor(track) } : undefined;
  });
  /** The lines of the planned routes of the opened recording's day, as routed so far. */
  const planLines = createMemo(() => {
    const o = opened();
    const day = o && openTrip()?.days.find((d) => d.id === o.recording.dayId);
    return day ? day.routes.flatMap((route) => routeLegs(route).map((leg) => legCoordinates(route, leg))) : [];
  });
  const comparands = createMemo((): { comparand: Comparand; label: string }[] => {
    const o = opened();
    if (!o) return [];
    const plan = planLines().length > 0 ? [{ comparand: 'plan' as const, label: 'The planned route' }] : [];
    const others = shownRecordings().filter((r) => r.id !== o.recording.id);
    return [...plan, ...others.map((r) => ({ comparand: r.id, label: r.name }))];
  });
  const comparison = createMemo((): Comparison | undefined => {
    const [o, c] = [opened(), comparand()];
    if (!o || c === undefined) return undefined;
    if (c === 'plan') {
      const lines = planLines();
      return lines.length > 0 ? { comparand: c, name: 'the planned route', delta: { offset: offsetsFrom(o.track.points, lines) } } : undefined;
    }
    const other = shownRecordings().find((r) => r.id === c && r.id !== o.recording.id);
    const track = other && trackOf(other);
    if (!track || track instanceof Error) return undefined;
    return { comparand: c, name: `“${other!.name}”`, delta: deltaToTrack({ points: o.track.points, measures: o.measures }, { points: track.points, measures: measuresFor(track) }) };
  });
  const colorings = createMemo((): Coloring[] => {
    const o = opened();
    if (!o) return [];
    const delta = comparison()?.delta;
    const differences = delta ? (Object.keys(DIFFERENCE_SERIES) as Difference[]).filter((d) => delta[DIFFERENCE_SERIES[d]] !== undefined) : [];
    return [...METRICS.filter((metric) => o.measures[metric] !== undefined), 'surface', ...differences];
  });
  /** The colouring chosen where the opened recording allows it. */
  const shownColoring = createMemo(() => {
    const c = coloring();
    return c && colorings().includes(c) ? c : undefined;
  });
  const openedSurfaces = () => {
    const o = opened();
    return o && surfaces().get(o.recording.id);
  };
  const shownScale = createMemo(() => {
    const [o, c] = [opened(), shownColoring()];
    if (!o || !c || c === 'surface') return undefined;
    const values = isDifference(c) ? comparison()?.delta[DIFFERENCE_SERIES[c]] : o.measures[c];
    const scale = values && scaleOf(c, values);
    return scale && { coloring: c, values, scale };
  });
  const colors = createMemo(() => {
    if (shownColoring() === 'surface') {
      const s = openedSurfaces();
      return Array.isArray(s) ? s.map(surfaceColor) : undefined;
    }
    const shown = shownScale();
    return shown && shown.values.map((v) => colorAt(shown.scale, v));
  });

  // Another trip starts with no recording opened or compared; surfaces are matched for this page only.
  createEffect(
    on(openTripId, () => {
      openRecording(undefined);
      setComparand(undefined);
    }),
  );
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
  return { opened, comparands, comparison, colorings, shownColoring, openedSurfaces, shownScale, colors };
});

/** The opened recording with its track and measures, while it is shown and its track is read. */
export const opened = view.opened;

/** What the opened recording can be compared with: its day's planned routes, and the other recordings shown. */
export const comparands = view.comparands;

/** The opened recording against what it is compared with, once both are there. */
export const comparison = view.comparison;

/** The colourings the opened recording allows: the measures its file has, the surface, and the differences its comparison has. */
export const colorings = view.colorings;

/** What the opened recording's line is coloured by, where it allows the colouring chosen. */
export const shownColoring = view.shownColoring;

/** The surfaces under the opened recording's points: being matched, matched, or why they could not be. */
export const openedSurfaces = view.openedSurfaces;

/** The values the opened recording's line is coloured by with their scale, while it is coloured by a measure or a difference. */
export const shownScale = view.shownScale;

/** The colour of each point of the opened recording's line, while it is coloured. */
export const openedLineColors = view.colors;
