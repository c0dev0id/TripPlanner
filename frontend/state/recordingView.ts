import { t } from '../i18n/t';
import { batch, createEffect, createMemo, createRoot, createSignal, on } from 'solid-js';
import type { KeptRide } from '../api';
import { deltaToTrack, offsetsFrom, type Delta } from '../recording/delta';
import { DIFFERENCE_FIGURES, FIGURES, METRICS } from '../recording/figures';
import { colorAt, DIFFERENCE_SERIES, DIMMED, isDifference, scaleOf, surfaceColor, type Coloring, type Difference } from '../recording/lineColors';
import { measuresOf, type Measures } from '../recording/measures';
import { trackSurfaces } from '../recording/surfaces';
import type { RecordedTrack } from '../recording/track';
import type { Route } from '../model/trip';
import { routeLine } from '../routing/legs';
import { showWhole } from './drawing';
import { isRecordingPinned, isRidePinned, isRoutePinned } from './pins';
import { shownTrack } from './section';
import { activeRecordingId, loadedTrack, setActiveRecordingId, shownRecordings, type ShownRecording } from './recordings';
import { activeRouteId, lookedTripId, openTrip, openTripId, pickDay, selectedDayId, takeUpRoute } from './trip';

/**
 * The recording opened for its figures, on its day or in the list of rides: its cards
 * over the map, what it is focused on (a measure, the surface or a difference, which
 * colours its line and picks its chart), what it is compared with, and the point of it
 * picked on the map or in its chart. It is compared with what is pinned beside it on the
 * map where that is one route, track or recording, and with nothing where it is more.
 */

/** The point under the pointer in the chart, and the point picked on the map or by a click in the chart, by their index in the track. */
const [hoverIndex, setHoverIndex] = createSignal<number>();
const [pickedIndex, setPickedIndex] = createSignal<number>();
export { hoverIndex, pickedIndex, setHoverIndex, setPickedIndex };

/** Whether a route, a track or a recording is taken up, which then leads: the map offers nothing else for a click. */
export const somethingTakenUp = (): boolean => activeRouteId() !== undefined || activeRecordingId() !== undefined;

/** Opens a recording's figures, or closes them; any point picked before is let go. */
export function openRecording(id: number | undefined): void {
  if (id !== activeRecordingId()) setPickedIndex(undefined);
  setHoverIndex(undefined);
  setActiveRecordingId(id);
}

/** Shows a day of the open trip whole, as a click on it does: what is taken up of it is let go, the route as the recording. */
export function showDayWhole(id: string): void {
  batch(() => {
    pickDay(id);
    takeUpRoute(undefined);
    openRecording(undefined);
  });
}

/**
 * Opens the figures of a recording of a day or of a ride of the list of rides, which
 * shows it whole on the map, at once where its track is read and else when it arrives;
 * the one opened stays as it is.
 */
export function showRecording(recording: KeptRide): void {
  if (activeRecordingId() === recording.id) return;
  // One thing is taken up at a time: the route taken up is let go. Opened first, so that it is shown whole beside its cards.
  takeUpRoute(undefined);
  openRecording(recording.id);
  const track = loadedTrack(recording);
  if (track) showWhole(track.points);
}

/** Picks a point of a recording, opening it. */
export function pickPoint(id: number, index: number): void {
  openRecording(id);
  setPickedIndex(index);
}

/** Whether the opened recording's facts are shown over the map: its figures as a whole and what its file is like. */
export const [infoShown, setInfoShown] = createSignal(false);

/** What the opened recording is focused on, which colours its line and picks its chart; nothing for its own colour and no chart. It stays chosen for the page, whatever recording is opened; one that does not allow it shows none meanwhile. */
const [coloring, setColoring] = createSignal<Coloring>();
export { setColoring };

/** The foci in the order their buttons stand: those nearly every recording has first, the rare ones last, so that a button keeps its place from one recording to the next. */
const FOCUS_ORDER: readonly Coloring[] = ['speed', 'offset', 'speedDifference', 'surface', 'altitude', 'slope', 'lean', 'leanDifference'];

/** What the opened recording is compared with: a route or a track of its day, or another recording. */
type Comparand = { route: Route; label: string } | { recording: ShownRecording };

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
  recording: ShownRecording;
  track: RecordedTrack;
  measures: Measures;
}

/** The opened recording against what it is compared with, named as a sentence names it. */
export interface Comparison {
  name: string;
  delta: Delta;
}

/** Whether two comparands are the same route as it is, under the same label, or the same recording: what the comparison is worked out from. */
function sameComparand(a: Comparand | undefined, b: Comparand | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if ('route' in a) return 'route' in b && a.route === b.route && a.label === b.label;
  return 'recording' in b && a.recording === b.recording;
}

const view = createRoot(() => {
  // Kept while its recording and track stay the same objects, as they do when other recordings change.
  const opened = createMemo(
    (): Opened | undefined => {
      const recording = shownRecordings().find((r) => r.id === activeRecordingId());
      const track = recording && shownTrack(recording);
      return recording && track ? { recording, track, measures: measuresFor(track) } : undefined;
    },
    undefined,
    { equals: (a, b) => a?.recording === b?.recording && a?.track === b?.track },
  );
  /** The opened recording's day, the same object while other days are edited. */
  const day = createMemo(() => {
    const dayId = opened()?.recording.dayId;
    return openTrip()?.days.find((d) => d.id === dayId);
  });
  /** What is pinned beside the opened recording, where it is one thing: a route or a track of its day, or another recording shown. */
  const comparand = createMemo((): Comparand | undefined => {
    const o = opened();
    if (!o) return undefined;
    const routes = day()?.routes ?? [];
    const pinned: Comparand[] = [
      ...routes.flatMap((route, i) => (isRoutePinned(route.id) ? [{ route, label: route.name || t('Route {n}', { n: i + 1 }) }] : [])),
      // Of a day, the recordings pinned on it; in the rides' tab, the rides pinned there.
      ...shownRecordings().flatMap((recording) => (recording.id !== o.recording.id && (recording.dayId === undefined ? isRidePinned(recording.id) : isRecordingPinned(recording.id)) ? [{ recording }] : [])),
    ];
    return pinned.length === 1 ? pinned[0] : undefined;
  }, undefined, { equals: sameComparand });
  /** What the comparison is with, as a key that stays the same while the route or the recording does. */
  const comparedKey = createMemo(() => {
    const c = comparand();
    return c && ('route' in c ? `route:${c.route.id}` : `recording:${c.recording.id}`);
  });
  const otherTrack = createMemo(() => {
    const c = comparand();
    return c && 'recording' in c ? shownTrack(c.recording) : undefined;
  });
  const delta = createMemo((): Delta | undefined => {
    const [o, c] = [opened(), comparand()];
    if (!o || !c) return undefined;
    if ('route' in c) {
      const line = routeLine(c.route);
      return line.length > 1 ? { offset: offsetsFrom(o.track.points, [line]) } : undefined;
    }
    const track = otherTrack();
    return track && track !== o.track ? deltaToTrack({ points: o.track.points, measures: o.measures }, { points: track.points, measures: measuresFor(track) }) : undefined;
  });
  const comparison = createMemo((): Comparison | undefined => {
    const [d, c] = [delta(), comparand()];
    return d && c ? { name: `“${'route' in c ? c.label : c.recording.name}”`, delta: d } : undefined;
  });
  const colorings = createMemo((): Coloring[] => {
    const o = opened();
    if (!o) return [];
    const d = delta();
    const differences = d ? (Object.keys(DIFFERENCE_SERIES) as Difference[]).filter((difference) => d[DIFFERENCE_SERIES[difference]] !== undefined) : [];
    const offered = new Set<Coloring>([...METRICS.filter((metric) => o.measures[metric] !== undefined), 'surface', ...differences]);
    return FOCUS_ORDER.filter((focus) => offered.has(focus));
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
    const values = isDifference(c) ? delta()?.[DIFFERENCE_SERIES[c]] : o.measures[c];
    const scale = values && scaleOf(c, values);
    return scale && { values, scale, figure: isDifference(c) ? DIFFERENCE_FIGURES[DIFFERENCE_SERIES[c]] : FIGURES[c] };
  });
  const colors = createMemo(() => {
    if (shownColoring() === 'surface') {
      const s = openedSurfaces();
      return Array.isArray(s) ? s.map(surfaceColor) : undefined;
    }
    const [shown, focus] = [shownScale(), shownColoring()];
    // A difference shows where the two lines run together and both have the value; the rest, without a value or off the other line for good (no finite distance), is dimmed.
    const dims = focus !== undefined && isDifference(focus);
    return shown && shown.values.map((v) => (dims && (v === null || !Number.isFinite(v)) ? DIMMED : colorAt(shown.scale, v)));
  });

  // Another trip or day, and a trip looked at, start with none opened, as they start with no route taken up; surfaces are matched for this page only.
  createEffect(on([openTripId, selectedDayId, lookedTripId], () => openRecording(undefined)));
  // A point is an index into the track opened; the whole ride and its part on a section count differently.
  createEffect(on(() => opened()?.track, () => { setPickedIndex(undefined); setHoverIndex(undefined); }, { defer: true }));
  // One thing is taken up at a time: a route taken up closes the recording opened.
  createEffect(on(activeRouteId, (id) => id !== undefined && openRecording(undefined), { defer: true }));
  // Something new pinned beside the recording is compared with at once where no focus is chosen: the focus goes to the distance from it. A focus chosen stays, from recording to recording, until another is chosen.
  createEffect(on(comparedKey, (key) => key !== undefined && coloring() === undefined && setColoring('offset'), { defer: true }));
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
  /** The recording compared with, where it is one and a difference is focused on, and of each of its points as shown whether the opened one ran along it there. */
  const comparedCover = createMemo(() => {
    const [c, focus, covered] = [comparand(), shownColoring(), delta()?.covered];
    return c && 'recording' in c && focus !== undefined && isDifference(focus) && covered ? { id: c.recording.id, covered } : undefined;
  });
  return { opened, comparison, colorings, shownColoring, openedSurfaces, shownScale, colors, comparedCover };
});

/** The opened recording with its track and measures, while it is shown and its track is read. */
export const opened = view.opened;

/** The opened recording against the one route, track or recording pinned beside it, once both are there. */
export const comparison = view.comparison;

/** What the opened recording can be focused on: the measures its file has, the surface, and the differences its comparison has. */
export const colorings = view.colorings;

/** What the opened recording is focused on, where it allows the focus chosen. */
export const shownColoring = view.shownColoring;

/** The surfaces under the opened recording's points: being matched, matched, or why they could not be. */
export const openedSurfaces = view.openedSurfaces;

/** The values the opened recording's line is coloured by, with their scale and how they are written, while it is coloured by a measure or a difference. */
export const shownScale = view.shownScale;

/** The colour of each point of the opened recording's line, while it is coloured. */
export const openedLineColors = view.colors;

/** The recording the opened one is compared with while a difference is focused on, and of each of its points whether the two ran together there; elsewhere it is dimmed. */
export const comparedCover = view.comparedCover;
