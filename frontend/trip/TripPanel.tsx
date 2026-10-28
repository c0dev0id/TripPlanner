import { createMemo, createSignal, For, Show } from 'solid-js';
import { errorMessage } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts } from '../gpx/import';
import { BOUND_COLOR, FREE_COLOR } from '../map/routeOverlay';
import { newId, type Day, type Route } from '../model/trip';
import { defaultProfile } from '../routing/dayEdit';
import { routeDistance } from '../routing/legs';
import type { SequenceEntry } from '../routing/sequence';
import type { DayTimeline, EntryTime } from '../routing/timeline';
import { saveState } from '../state/autosave';
import { panTo, setEditTarget, setExportOpen, setShareOpen, setShowNeighbours, showNeighbours } from '../state/drawing';
import type { MenuItem } from '../ui/menu';
import type { EntryTarget } from '../model/journal';
import { entriesOn, setJournalTarget } from '../state/journal';
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
  selectDay,
  selectedDayId,
  selectedSequence,
  selectedTimeline,
} from '../state/trip';
import { distanceText, timeText } from '../ui/format';
import { BackIcon, ClockIcon, DownloadIcon, NotebookIcon, PencilIcon, ShareIcon } from '../ui/icons';
import { MoreMenu } from '../ui/MoreMenu';
import { StopShape } from '../ui/StopShape';
import { dayLabel, offTime, routeKindLabel, routeLabel, timelineText, timesText } from './labels';

/** How many journal entries a part has, for its row: "2 in the journal", or nothing for none. */
function journalCount(target: EntryTarget): string {
  const count = entriesOn(target).length;
  return count === 0 ? '' : `${count} in the journal`;
}

/** One item per other day of the trip, for moving or copying something there. */
function otherDayItems(dayId: string, action: string, run: (dayId: string) => void): MenuItem[] {
  return openTrip()!
    .days.flatMap((day, index) => (day.id === dayId ? [] : [{ label: `${action} ${dayLabel(day, index)}`, run: () => run(day.id) }]));
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
        <button class="link" onClick={() => setJournalTarget({})}>
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
        <For each={trip().days}>{(day, index) => <DayItem day={day} index={index()} />}</For>
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

function DayItem(props: { day: Day; index: number }) {
  const selected = () => selectedDayId() === props.day.id;
  const label = createMemo(() => dayLabel(props.day, props.index));
  const distance = createMemo(() => props.day.routes.reduce((sum, route) => sum + routeDistance(route), 0));
  const note = () => [distance() > 0 ? distanceText(distance()) : '', journalCount({ dayId: props.day.id })].filter(Boolean).join(' · ');
  const more = (): MenuItem[] => [
    { label: 'Move up', run: () => moveDay(props.day.id, -1), disabled: props.index === 0 },
    { label: 'Move down', run: () => moveDay(props.day.id, 1), disabled: props.index === openTrip()!.days.length - 1 },
    { label: 'Duplicate', run: () => duplicateDay(props.day.id) },
    { label: 'Journal…', run: () => setJournalTarget({ dayId: props.day.id }) },
  ];
  return (
    <li class="day" classList={{ selected: selected() }}>
      <div class="row">
        <button class="text grow" onClick={() => selectDay(props.day.id)} aria-pressed={selected()}>
          <span class="name">{label()}</span>
          <span class="muted">{note()}</span>
        </button>
        <button class="icon" title="Edit day" aria-label={`Edit ${label()}`} onClick={() => setEditTarget({ kind: 'day', id: props.day.id })}>
          <PencilIcon />
        </button>
        <MoreMenu label={`More for ${label()}`} items={more} />
      </div>
      <Show when={selected()}>
        <DayDetails day={props.day} />
      </Show>
    </li>
  );
}

/** The selected day's notes and times, its routes with their stops, and the stops that stand beside no route. */
function DayDetails(props: { day: Day }) {
  const unplaced = createMemo(() => selectedSequence().filter((e) => e.stop?.pointId === null && !e.near));
  const [importNote, setImportNote] = createSignal<{ text: string; error: boolean }>();
  let fileInput!: HTMLInputElement;
  const importFile = async (file: File | undefined) => {
    fileInput.value = '';
    if (!file) return;
    try {
      const parts = gpxToDayParts(parseGpx(await file.text()), { fileName: file.name.replace(/\.gpx$/i, ''), profile: defaultProfile(props.day), newId });
      addParts(parts);
      const { routes, stops } = { routes: parts.routes.length, stops: parts.stops.length };
      setImportNote({ text: `${file.name}: ${routes} ${routes === 1 ? 'route' : 'routes'}, ${stops} ${stops === 1 ? 'stop' : 'stops'} added.`, error: false });
    } catch (fault) {
      setImportNote({ text: `${file.name}: ${errorMessage(fault)}`, error: true });
    }
  };
  return (
    <div class="day-details">
      <Show when={props.day.notes}>
        <p class="muted notes">{props.day.notes}</p>
      </Show>
      <Show when={props.day.stops.length > 0}>
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
        <For each={props.day.routes}>{(route, index) => <RouteItem route={route} index={index()} day={props.day} />}</For>
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
          <For each={unplaced()}>{(entry) => <SequenceItem entry={entry} time={selectedTimeline()?.times.get(entry.id)} />}</For>
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

/** A route of the day: its row, and while it is selected, its stops and points in riding order under it. */
function RouteItem(props: { route: Route; index: number; day: Day }) {
  const editing = () => editingRouteId() === props.route.id;
  const label = createMemo(() => routeLabel(props.route, props.day));
  const journal = () => journalCount({ routeId: props.route.id });
  /** The route's points and bound stops, and the free stops that stand beside it. */
  const entries = createMemo(() => selectedSequence().filter((e) => e.routeIndex === props.index && !(e.stop?.pointId === null && !e.near)));
  const stopCount = createMemo(() => entries().filter((e) => e.stop).length);
  const lateCount = createMemo(() => entries().filter((e) => (selectedTimeline()?.times.get(e.id)?.slackMin ?? 0) < 0).length);
  const more = (): MenuItem[] => [
    { label: 'Move up', run: () => moveRoute(props.route.id, -1), disabled: props.index === 0 },
    { label: 'Move down', run: () => moveRoute(props.route.id, 1), disabled: props.index === props.day.routes.length - 1 },
    { label: 'Duplicate', run: () => duplicateRoute(props.route.id) },
    ...otherDayItems(props.day.id, 'Move to', (dayId) => moveRouteToDay(props.route.id, dayId)),
    { label: 'Journal…', run: () => setJournalTarget({ routeId: props.route.id }) },
  ];
  return (
    <li class="route" classList={{ editing: editing() }}>
      <div class="row">
        <button class="text grow" aria-expanded={editing()} onClick={() => editRoute(editing() ? undefined : props.route.id)}>
          <span class="lines">
            <span class="name" title={label()}>
              {label()}
            </span>
            <span class="muted detail">
              {routeKindLabel(props.route)}
              {props.route.points.length > 1 ? ` · ${distanceText(routeDistance(props.route))}` : ''}
              {stopCount() > 0 ? ` · ${stopCount()} ${stopCount() === 1 ? 'stop' : 'stops'}` : ''}
              <Show when={lateCount() > 0}>
                <span class="late"> · {lateText(lateCount())}</span>
              </Show>
              {props.route.optional ? ' · optional' : ''}
              {journal() ? ` · ${journal()}` : ''}
            </span>
          </span>
        </button>
        <button class="icon" title="Edit route" aria-label={`Edit ${label()}`} onClick={() => setEditTarget({ kind: 'route', id: props.route.id })}>
          <PencilIcon />
        </button>
        <MoreMenu label={`More for ${label()}`} items={more} />
      </div>
      <Show when={editing()}>
        <ol class="stops">
          <For each={entries()}>{(entry) => <SequenceItem entry={entry} time={selectedTimeline()?.times.get(entry.id)} />}</For>
        </ol>
        <Show when={props.route.points.length === 0}>
          <p class="muted hint">Pick the Point tool and tap the map to draw the route.</p>
        </Show>
        <Show when={props.route.points.length > 0 && stopCount() === 0}>
          <p class="muted hint">Make stops of route points with the Stop tool, or tap beside the route.</p>
        </Show>
      </Show>
    </li>
  );
}

/**
 * A stop or a plain route point with its times and distance from the day's start; a click
 * pans the map there. Before a stop whose fixed time the ride misses stands a row of its
 * own that says by how much it is late or early, and when the ride gets there.
 */
function SequenceItem(props: { entry: SequenceEntry; time: EntryTime | undefined }) {
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
      <SequenceRow entry={props.entry} time={props.time} />
    </>
  );
}

function SequenceRow(props: { entry: SequenceEntry; time: EntryTime | undefined }) {
  const stop = () => props.entry.stop;
  return (
    <li class="row sequence-item" classList={{ point: !stop(), stop: stop() !== undefined }}>
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
            <Show when={stop()?.pointId === null}> · {distanceText(props.entry.near?.distanceM ?? 0)} beside the route</Show>
            <Show when={stop()?.optional}> · optional</Show>
            <Show when={stop() && journalCount({ stopId: stop()!.id })}>{(journal) => <> · {journal()}</>}</Show>
          </span>
        </span>
      </button>
      <Show when={stop()}>
        {(s) => (
          <>
            <button class="icon" title="Edit stop" aria-label={`Edit ${s().name}`} onClick={() => setEditTarget({ kind: 'stop', id: s().id })}>
              <PencilIcon />
            </button>
            <MoreMenu
              label={`More for ${s().name}`}
              items={() => [
                ...otherDayItems(selectedDayId()!, 'Copy to', (dayId) => copyStopToDay(s().id, dayId)),
                { label: 'Journal…', run: () => setJournalTarget({ stopId: s().id }) },
              ]}
            />
          </>
        )}
      </Show>
    </li>
  );
}
