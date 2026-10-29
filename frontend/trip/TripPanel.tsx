import { createMemo, createSignal, Show } from 'solid-js';
import { errorMessage } from '../api';
import { readGpxFile } from '../gpx/import';
import { BOUND_COLOR, FREE_COLOR } from '../map/routeOverlay';
import type { Day, Route, Stop } from '../model/trip';
import { defaultProfile } from '../routing/dayEdit';
import { routeDistance } from '../routing/legs';
import { standingAlone, type SequenceEntry } from '../routing/sequence';
import type { DayTimeline, EntryTime } from '../routing/timeline';
import { saveState } from '../state/autosave';
import { panTo, setEditTarget, setExportOpen, setShareOpen, setShowNeighbours, setTrackAction, showNeighbours } from '../state/drawing';
import type { MenuItem } from '../ui/menu';
import type { EntryTarget } from '../model/journal';
import { entriesOn, openJournal } from '../state/journal';
import {
  addDay,
  addParts,
  addRoute,
  copyStopToDay,
  duplicateDay,
  duplicateRoute,
  editingRouteId,
  editRoute,
  moveDay,
  moveRoute,
  moveRouteToDay,
  openTrip,
  removeStop,
  selectDay,
  selectedDayId,
  selectedSequence,
  selectedTimeline,
} from '../state/trip';
import { cardMenu } from '../ui/cardMenu';
import { ForById } from '../ui/ForById';
import { counted, distanceText, shortDateText, timeText } from '../ui/format';
import { BackIcon, ClockIcon, DownloadIcon, NotebookIcon, PencilIcon, ShareIcon } from '../ui/icons';
import { Grip } from '../ui/Grip';
import { MoreMenu } from '../ui/MoreMenu';
import { StopShape } from '../ui/StopShape';
import { dayLabel, offTime, routeKindLabel, routeLabel, timelineText, timesText } from './labels';
import { removeDayAsked, removeRouteAsked } from './remove';

/** The journal of a part as an icon, with the number of its entries where it has any. */
function JournalButton(props: { target: EntryTarget; of: string }) {
  const count = createMemo(() => entriesOn(props.target).length);
  const label = () => `Journal of ${props.of}${count() === 0 ? '' : `: ${count()} ${count() === 1 ? 'entry' : 'entries'}`}`;
  return (
    <button class="icon journal" title={label()} aria-label={label()} onClick={() => openJournal(props.target)}>
      <NotebookIcon />
      <Show when={count() > 0}>
        <span class="badge">{count()}</span>
      </Show>
    </button>
  );
}

/** One item per other day of the trip, for moving or copying something there. */
/** An item named `label` whose submenu lists the trip's other days, for moving or copying something there; none in a trip of one day. */
function otherDaysItem(dayId: string, label: string, run: (dayId: string) => void): MenuItem[] {
  const items = openTrip()!.days.flatMap((day, index) => (day.id === dayId ? [] : [{ label: dayLabel(day, index), run: () => run(day.id) }]));
  return items.length > 0 ? [{ label, items }] : [];
}

/** The open trip: its name, its days with their routes and stops, the export links and the saving state. */
export function TripPanel(props: { onLeave: () => void; onReload: () => void }) {
  const trip = () => openTrip()!;
  /** One level up: from a day to the whole trip, from the trip to the list it was opened from. */
  const back = () => (selectedDayId() ? { label: 'Back to the trip', run: () => selectDay(undefined) } : { label: 'Back to the trips', run: props.onLeave });
  return (
    <section class="trip">
      <div class="row">
        <button class="icon" title={back().label} aria-label={back().label} onClick={() => back().run()}>
          <BackIcon />
        </button>
        <h2 class="grow name" title={trip().name}>
          {trip().name}
        </h2>
        <button class="icon" title="Edit trip" aria-label="Edit trip" onClick={() => setEditTarget({ kind: 'trip' })}>
          <PencilIcon />
        </button>
      </div>
      <SaveStatus onReload={props.onReload} />
      <div class="row trip-actions">
        <button class="link" onClick={() => setExportOpen(true)}>
          <DownloadIcon /> Export GPX…
        </button>
        <button class="link" onClick={() => openJournal({})}>
          <NotebookIcon /> Journal…
        </button>
        <button class="link" onClick={() => setShareOpen(true)}>
          <ShareIcon /> Print, share…
        </button>
      </div>
      <div class="row heading">
        <h3 class="grow">Days</h3>
        <label class="toggle">
          <input type="checkbox" checked={showNeighbours()} onChange={(e) => setShowNeighbours(e.currentTarget.checked)} /> neighbouring days on the map
        </label>
      </div>
      <ol class="days">
        <ForById each={trip().days}>{(day, index) => <DayItem day={day()} index={index()} />}</ForById>
      </ol>
      <button onClick={addDay}>Add day</button>
    </section>
  );
}

function SaveStatus(props: { onReload: () => void }) {
  return (
    <p class="save-status muted" classList={{ failed: saveState() === 'failed' || saveState() === 'conflict' }}>
      {saveState() === 'saved' && 'Saved'}
      {saveState() === 'dirty' && 'Unsaved changes'}
      {saveState() === 'saving' && 'Saving…'}
      {saveState() === 'failed' && 'Saving failed; trying again shortly'}
      <Show when={saveState() === 'conflict'}>
        The trip was changed elsewhere. <button onClick={props.onReload}>Reload it</button> to go on; the changes made here since are lost.
      </Show>
    </p>
  );
}

/** A day as a card: its number and name over its date and length; its menu edits, duplicates and removes it. */
function DayItem(props: { day: Day; index: number }) {
  const selected = () => selectedDayId() === props.day.id;
  const label = createMemo(() => dayLabel(props.day, props.index));
  // The day's routes change less often than the day.
  const routes = createMemo(() => props.day.routes);
  const distance = createMemo(() => routes().reduce((sum, route) => sum + routeDistance(route), 0));
  const meta = () => [props.day.date ? shortDateText(props.day.date) : 'No date', distance() > 0 && distanceText(distance())].filter(Boolean).join(' · ');
  const more = (): MenuItem[] => [
    { label: 'Edit…', run: () => setEditTarget({ kind: 'day', id: props.day.id }) },
    { label: 'Duplicate', run: () => duplicateDay(props.day.id) },
    { label: 'Remove', run: () => void removeDayAsked(props.day) },
  ];
  return (
    <li class="day card" classList={{ selected: selected() }}>
      <div class="row" ref={(el) => cardMenu(el, more)}>
        <Grip label={`Drag ${label()} to another place`} index={props.index} onMove={(to) => moveDay(props.day.id, to)} />
        <button class="text grow" onClick={() => selectDay(selected() ? undefined : props.day.id)} aria-pressed={selected()}>
          <span class="lines">
            <span class="name">{[`Day ${props.index + 1}`, props.day.name].filter(Boolean).join(' · ')}</span>
            <span class="muted detail">{meta()}</span>
          </span>
        </button>
        <JournalButton target={{ dayId: props.day.id }} of={label()} />
      </div>
      <Show when={selected()}>
        <DayDetails day={props.day} />
      </Show>
    </li>
  );
}

/** The selected day's notes and times, its routes with their stops, and the stops that stand beside no route. */
function DayDetails(props: { day: Day }) {
  const unplaced = createMemo(() => standingAlone(props.day, selectedSequence()));
  /** The sequence by route, in order: each route's points and the stops placed along it. */
  const byRoute = createMemo(() => {
    const groups = props.day.routes.map((): SequenceEntry[] => []);
    for (const entry of selectedSequence()) groups[entry.routeIndex]?.push(entry);
    return groups;
  });
  const [importNote, setImportNote] = createSignal<{ text: string; error: boolean }>();
  let fileInput!: HTMLInputElement;
  const importFile = async (file: File | undefined) => {
    fileInput.value = '';
    if (!file) return;
    try {
      const parts = await readGpxFile(file, defaultProfile(props.day));
      addParts(parts);
      setImportNote({ text: `${file.name}: ${counted(parts.routes.length, 'route')}, ${counted(parts.stops.length, 'stop')} added.`, error: false });
    } catch (fault) {
      setImportNote({ text: `${file.name}: ${errorMessage(fault)}`, error: true });
    }
  };
  return (
    <div class="day-details">
      <Show when={props.day.notes}>
        <p class="muted notes">{props.day.notes}</p>
      </Show>
      <Show when={selectedSequence().some((e) => e.stop)}>
        <Show when={selectedTimeline()} fallback={<p class="day-summary muted">Give the first stop a time for the day's times.</p>}>
          {(timeline) => <DaySummary timeline={timeline()} />}
        </Show>
      </Show>
      <div class="row heading">
        <h4 class="grow">Routes</h4>
        <button onClick={addRoute}>Add route</button>
        <button onClick={() => fileInput.click()}>Import GPX…</button>
        <input ref={fileInput} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => void importFile(e.currentTarget.files?.[0])} />
      </div>
      <ul class="routes">
        <ForById each={props.day.routes}>{(route, index) => <RouteItem route={route()} index={index()} day={props.day} sequence={byRoute()[index()] ?? []} />}</ForById>
      </ul>
      <Show when={props.day.routes.length === 0}>
        <p class="muted hint">Add a route, pick the Point tool and tap the map to draw it, or import a GPX file.</p>
      </Show>
      <Show when={importNote()}>{(note) => <p class="hint" classList={{ muted: !note().error, error: note().error }}>{note().text}</p>}</Show>
      <Show when={unplaced().length > 0}>
        <div class="row heading">
          <h4 class="grow">Stops beside no route</h4>
        </div>
        <ol class="stops">
          <ForById each={unplaced()}>{(stop) => <AloneStopItem stop={stop()} />}</ForById>
        </ol>
      </Show>
    </div>
  );
}

const lateText = (stops: number): string => (stops === 1 ? 'late at 1 stop' : `late at ${stops} stops`);

/** The day's timeline in one line, and at how many stops the ride gets there after the fixed time. */
function DaySummary(props: { timeline: DayTimeline }) {
  return (
    <p class="day-summary">
      {timelineText(props.timeline)}
      <Show when={props.timeline.late > 0}>
        {' · '}
        <span class="late">{lateText(props.timeline.late)}</span>
      </Show>
    </p>
  );
}

/**
 * A route of the day: its row, whose menu (right-click or a long press) edits, duplicates,
 * moves, condenses or converts a track, and removes it; and while it is selected, its stops
 * and points in riding order under it, out of `sequence`, its part of the day's.
 */
function RouteItem(props: { route: Route; index: number; day: Day; sequence: SequenceEntry[] }) {
  const editing = () => editingRouteId() === props.route.id;
  const label = createMemo(() => routeLabel(props.route, props.day));
  /** The route's points and bound stops, and the free stops that stand beside it; of a track, whose points are many, the stops alone. */
  const entries = createMemo(() => (props.route.kind === 'track' ? props.sequence.filter((e) => e.stop) : props.sequence));
  const stopCount = createMemo(() => entries().filter((e) => e.stop).length);
  const lateCount = createMemo(() => entries().filter((e) => (selectedTimeline()?.times.get(e.id)?.slackMin ?? 0) < 0).length);
  const items = (): MenuItem[] => [
    { label: 'Edit…', run: () => setEditTarget({ kind: 'route', id: props.route.id }) },
    { label: 'Duplicate', run: () => duplicateRoute(props.route.id) },
    ...otherDaysItem(props.day.id, 'Move…', (dayId) => moveRouteToDay(props.route.id, dayId)),
    ...(props.route.kind === 'track'
      ? [
          { label: 'Condense points…', run: () => setTrackAction({ routeId: props.route.id, action: 'condense' }) },
          { label: 'Convert to route…', run: () => setTrackAction({ routeId: props.route.id, action: 'convert' }) },
        ]
      : []),
    { label: 'Remove', run: () => void removeRouteAsked(props.route) },
  ];
  return (
    <li class="route" classList={{ editing: editing() }}>
      <div class="row" ref={(el) => cardMenu(el, items)}>
        <Grip label={`Drag ${label()} to another place`} index={props.index} onMove={(to) => moveRoute(props.route.id, to)} />
        <button class="text grow" aria-expanded={editing()} onClick={() => editRoute(editing() ? undefined : props.route.id)}>
          <span class="lines">
            <span class="name" title={label()}>
              {label()}
            </span>
            <span class="muted detail">
              {routeKindLabel(props.route)}
              {props.route.points.length > 1 ? ` · ${distanceText(routeDistance(props.route))}` : ''}
              {props.route.kind === 'track' ? ` · ${props.route.points.length.toLocaleString()} points` : ''}
              {stopCount() > 0 ? ` · ${stopCount()} ${stopCount() === 1 ? 'stop' : 'stops'}` : ''}
              <Show when={lateCount() > 0}>
                <span class="late"> · {lateText(lateCount())}</span>
              </Show>
              {props.route.optional ? ' · optional' : ''}
            </span>
          </span>
        </button>
        <JournalButton target={{ routeId: props.route.id }} of={label()} />
      </div>
      <Show when={editing()}>
        <ol class="stops">
          <SequenceItems entries={entries()} />
        </ol>
        <Show when={props.route.points.length === 0}>
          <p class="muted hint">Pick the Point tool and tap the map to draw the route.</p>
        </Show>
        <Show when={props.route.points.length > 0 && stopCount() === 0 && props.route.kind !== 'track'}>
          <p class="muted hint">Make stops of route points with the Stop tool, or tap beside the route.</p>
        </Show>
      </Show>
    </li>
  );
}

/** Rows of sequence entries; an edit makes new entries, and their rows are kept by id. */
function SequenceItems(props: { entries: SequenceEntry[] }) {
  return <ForById each={props.entries}>{(entry) => <SequenceItem entry={entry()} time={selectedTimeline()?.times.get(entry().id)} />}</ForById>;
}

/**
 * A stop or a plain route point with its times and distance from the day's start; a click
 * pans the map there. Before a stop whose fixed time the ride misses stands a row of its
 * own that says by how much it is late or early, and when the ride gets there.
 */
function SequenceItem(props: { entry: SequenceEntry; time: EntryTime | undefined }) {
  const stop = () => props.entry.stop;
  return (
    <>
      <Show when={props.time && offTime(props.time)}>
        {(off) => (
          <li class="off-time" classList={{ late: off().late, early: !off().late }}>
            <span class="mark">
              <ClockIcon />
            </span>
            <span class="lines">
              <span>{off().text}</span>
              <span class="muted">arrives {timeText(off().rideMin)}</span>
            </span>
          </li>
        )}
      </Show>
      <li class="row sequence-item" classList={{ point: !stop() }}>
        <button class="text grow" onClick={() => panTo(props.entry.lngLat)}>
          <Show when={stop()} fallback={<span class="point-dot" style={{ 'border-color': BOUND_COLOR }} />}>
            {(s) => <StopShape kind={s().kind} color={s().pointId === null ? FREE_COLOR : BOUND_COLOR} height={22} />}
          </Show>
          <span class="lines">
            <span class="name">
              <Show when={stop()} fallback={<span class="muted">Route point</span>}>
                {(s) => <>{s().name}</>}
              </Show>
            </span>
            <span class="muted detail">
              <Show when={props.time}>{(time) => <>{timesText(time())} · </>}</Show>
              {distanceText(props.entry.distanceM)}
              <Show when={props.entry.near}>{(near) => <> · {distanceText(near().distanceM)} beside the route</>}</Show>
              <Show when={stop()?.optional}> · optional</Show>
            </span>
          </span>
        </button>
        <Show when={stop()}>{(s) => <StopActions stop={s()} />}</Show>
      </li>
    </>
  );
}

/** A stop that stands for itself beside no route, with no place or times on the ride; a click pans the map there. */
function AloneStopItem(props: { stop: Stop }) {
  return (
    <li class="row sequence-item">
      <button class="text grow" onClick={() => panTo(props.stop.lngLat)}>
        <StopShape kind={props.stop.kind} color={FREE_COLOR} height={22} />
        <span class="lines">
          <span class="name">{props.stop.name}</span>
          <Show when={props.stop.optional}>
            <span class="muted detail">optional</span>
          </Show>
        </span>
      </button>
      <StopActions stop={props.stop} />
    </li>
  );
}

/** A stop's journal, its pencil, and its menu: edit, copy to another day, remove. */
function StopActions(props: { stop: Stop }) {
  return (
    <>
      <JournalButton target={{ stopId: props.stop.id }} of={props.stop.name} />
      <button class="icon" title="Edit stop" aria-label={`Edit ${props.stop.name}`} onClick={() => setEditTarget({ kind: 'stop', id: props.stop.id })}>
        <PencilIcon />
      </button>
      <MoreMenu
        label={`More for ${props.stop.name}`}
        items={() => [
          { label: 'Edit…', run: () => setEditTarget({ kind: 'stop', id: props.stop.id }) },
          ...otherDaysItem(selectedDayId()!, 'Copy…', (dayId) => copyStopToDay(props.stop.id, dayId)),
          { label: 'Remove', run: () => removeStop(props.stop.id) },
        ]}
      />
    </>
  );
}
