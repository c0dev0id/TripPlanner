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
import { panTo, setExportOpen, setShareOpen, setShowNeighbours, setShowRoutePoints, setStopDialogId, showNeighbours, showRoutePoints, type MenuItem } from '../state/drawing';
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
  removeDay,
  removeRoute,
  removeStop,
  renameDay,
  renameRoute,
  renameTrip,
  selectDay,
  selectedDayId,
  selectedSequence,
  selectedTimeline,
  setDayDate,
  setRouteOptional,
  setTripState,
  updateStop,
} from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { EditableName } from '../ui/EditableName';
import { distanceText, durationText } from '../ui/format';
import { BackIcon, DownloadIcon, NotebookIcon, PencilIcon, ShareIcon } from '../ui/icons';
import { MoreMenu } from '../ui/MoreMenu';
import { StopShape } from '../ui/StopShape';
import { dayLabel, routeKindLabel, routeLabel, timelineText, timesText } from './labels';

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
  return (
    <section class="trip">
      <div class="row">
        <button class="icon" title="Back to the trips" aria-label="Back to the trips" onClick={props.onLeave}>
          <BackIcon />
        </button>
        <EditableName value={trip().name} label="trip" onRename={renameTrip}>
          <h2 class="grow name" title={trip().name}>
            {trip().name}
          </h2>
        </EditableName>
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
      <label class="toggle">
        <input type="checkbox" checked={trip().state === 'done'} onChange={(e) => setTripState(e.currentTarget.checked ? 'done' : 'planned')} /> done: the trip has been ridden
      </label>
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
  const label = () => dayLabel(props.day, props.index);
  const distance = createMemo(() => props.day.routes.reduce((sum, route) => sum + routeDistance(route), 0));
  const note = () => [distance() > 0 ? distanceText(distance()) : '', journalCount({ dayId: props.day.id })].filter(Boolean).join(' · ');
  const remove = async () => {
    const parts = props.day.routes.length + props.day.stops.length;
    if (parts > 0 && !(await askConfirmation(`Remove ${label()} with its routes and stops?`, 'Remove'))) return;
    removeDay(props.day.id);
  };
  const more = (): MenuItem[] => [
    { label: 'Move up', run: () => moveDay(props.day.id, -1), disabled: props.index === 0 },
    { label: 'Move down', run: () => moveDay(props.day.id, 1), disabled: props.index === openTrip()!.days.length - 1 },
    { label: 'Duplicate', run: () => duplicateDay(props.day.id) },
    { label: 'Journal…', run: () => setJournalTarget({ dayId: props.day.id }) },
    { label: 'Remove', run: () => void remove() },
  ];
  return (
    <li class="day" classList={{ selected: selected() }}>
      <div class="row">
        <button class="text grow" onClick={() => selectDay(props.day.id)} aria-pressed={selected()}>
          <span class="name">{label()}</span>
          <span class="muted">{note()}</span>
        </button>
        <EditableName value={props.day.name} label="day" onRename={(name) => renameDay(props.day.id, name)}>
          <span />
        </EditableName>
        <MoreMenu label={`More for ${label()}`} items={more} />
      </div>
      <Show when={selected()}>
        <DayDetails day={props.day} />
      </Show>
    </li>
  );
}

/** The selected day's date and times, its routes, and its stops (and route points on request) in riding order. */
function DayDetails(props: { day: Day }) {
  const listed = createMemo(() => new Map(selectedSequence().filter((e) => e.stop || showRoutePoints()).map((e) => [e.id, e])));
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
      <div class="row">
        <label class="field">
          Date <input type="date" value={props.day.date ?? ''} onChange={(e) => setDayDate(props.day.id, e.currentTarget.value || null)} />
        </label>
      </div>
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
        <p class="muted hint">Add a route, then tap the map to draw it, or import a GPX file.</p>
      </Show>
      <Show when={importNote()}>{(note) => <p class="hint" classList={{ muted: !note().error, error: note().error }}>{note().text}</p>}</Show>
      <div class="row heading">
        <h4 class="grow">Stops</h4>
        <label class="toggle">
          <input type="checkbox" checked={showRoutePoints()} onChange={(e) => setShowRoutePoints(e.currentTarget.checked)} /> route points
        </label>
      </div>
      <ol class="stops">
        <For each={[...listed().keys()]}>{(id) => <SequenceItem entry={listed().get(id)!} time={selectedTimeline()?.times.get(id)} />}</For>
      </ol>
      <Show when={listed().size === 0 && props.day.routes.length > 0}>
        <p class="muted hint">Make stops of route points, or tap beside the route with the stop tool.</p>
      </Show>
    </div>
  );
}

/** The day's timeline in one line, and where the ride falls short of a fixed time. */
function DaySummary(props: { timeline: DayTimeline }) {
  return (
    <p class="day-summary">
      {timelineText(props.timeline)}
      <Show when={props.timeline.short > 0}>
        {' · '}
        <span class="short">{props.timeline.short === 1 ? 'short at 1 stop' : `short at ${props.timeline.short} stops`}</span>
      </Show>
    </p>
  );
}

function RouteItem(props: { route: Route; index: number; day: Day }) {
  const editing = () => editingRouteId() === props.route.id;
  const label = () => routeLabel(props.route, props.day);
  const journal = () => journalCount({ routeId: props.route.id });
  const remove = async () => {
    if (props.route.points.length > 0 && !(await askConfirmation(`Remove ${label()} with its ${props.route.points.length} points?`, 'Remove'))) return;
    removeRoute(props.route.id);
  };
  const more = (): MenuItem[] => [
    { label: 'Move up', run: () => moveRoute(props.route.id, -1), disabled: props.index === 0 },
    { label: 'Move down', run: () => moveRoute(props.route.id, 1), disabled: props.index === props.day.routes.length - 1 },
    { label: props.route.optional ? 'Mark as needed' : 'Mark as optional', run: () => setRouteOptional(props.route.id, !props.route.optional) },
    { label: 'Duplicate', run: () => duplicateRoute(props.route.id) },
    ...otherDayItems(props.day.id, 'Move to', (dayId) => moveRouteToDay(props.route.id, dayId)),
    { label: 'Journal…', run: () => setJournalTarget({ routeId: props.route.id }) },
    { label: 'Remove', run: () => void remove() },
  ];
  return (
    <li class="row route" classList={{ editing: editing() }}>
      <EditableName value={label()} label="route" onRename={(name) => renameRoute(props.route.id, name)} />
      <span class="muted">
        {routeKindLabel(props.route)}
        {props.route.points.length > 1 ? ` · ${distanceText(routeDistance(props.route))}` : ''}
        {props.route.optional ? ' · optional' : ''}
        {journal() ? ` · ${journal()}` : ''}
      </span>
      <button classList={{ primary: editing() }} onClick={() => editRoute(editing() ? undefined : props.route.id)}>
        {editing() ? 'Done' : 'Edit'}
      </button>
      <MoreMenu label={`More for ${label()}`} items={more} />
    </li>
  );
}

/** A stop or a plain route point with its times and distance from the day's start; a click pans the map there. */
function SequenceItem(props: { entry: SequenceEntry; time: EntryTime | undefined }) {
  const stop = () => props.entry.stop;
  const slack = () => props.time?.slackMin ?? 0;
  return (
    <li class="row sequence-item" classList={{ point: !stop() }}>
      <button class="text grow" onClick={() => panTo(props.entry.lngLat)} title={stop()?.pointId === null ? `Beside the route, ${distanceText(props.entry.near?.distanceM ?? 0)} from it; show on the map` : 'Show on the map'}>
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
            <Show when={slack() > 0}> · waits {durationText(slack() * 60)}</Show>
            <Show when={slack() < 0}>
              <span class="short"> · {durationText(-slack() * 60)} short</span>
            </Show>
            <Show when={stop()?.optional}> · optional</Show>
            <Show when={stop() && journalCount({ stopId: stop()!.id })}>{(journal) => <> · {journal()}</>}</Show>
          </span>
        </span>
      </button>
      <Show when={stop()}>
        {(s) => (
          <>
            <EditableName value={s().name} label="stop" onRename={(name) => updateStop(s().id, { name }, 'Rename stop')}>
              <span />
            </EditableName>
            <button class="icon" title="Stop details" aria-label={`Details of ${s().name}`} onClick={() => setStopDialogId(s().id)}>
              <PencilIcon />
            </button>
            <MoreMenu
              label={`More for ${s().name}`}
              items={() => [
                ...otherDayItems(selectedDayId()!, 'Copy to', (dayId) => copyStopToDay(s().id, dayId)),
                { label: 'Journal…', run: () => setJournalTarget({ stopId: s().id }) },
                { label: 'Remove', run: () => removeStop(s().id) },
              ]}
            />
          </>
        )}
      </Show>
    </li>
  );
}
