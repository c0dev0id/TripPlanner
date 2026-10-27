import { createMemo, For, Show } from 'solid-js';
import { gpxUrl, gpxZipUrl } from '../api';
import { BOUND_COLOR, FREE_COLOR } from '../map/routeOverlay';
import { PROFILES, type Day, type Route } from '../model/trip';
import { routeDistance } from '../routing/legs';
import type { SequenceEntry } from '../routing/sequence';
import { saveState } from '../state/autosave';
import { panTo, setShowNeighbours, setShowRoutePoints, setStopDialogId, showNeighbours, showRoutePoints } from '../state/drawing';
import { addDay, addRoute, editingRouteId, editRoute, openTrip, removeDay, removeRoute, removeStop, renameDay, renameRoute, renameTrip, selectDay, selectedDayId, selectedSequence, updateStop } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { EditableName } from '../ui/EditableName';
import { distanceText } from '../ui/format';
import { BackIcon, DeleteIcon, DownloadIcon, PencilIcon } from '../ui/icons';
import { StopShape } from '../ui/StopShape';
import { dayLabel, routeLabel } from './labels';

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
      <div class="row export">
        <DownloadIcon />
        <a href={gpxUrl(trip().id)} download="">
          GPX of the trip
        </a>
        <a href={gpxZipUrl(trip().id)} download="">
          one file per day
        </a>
        <Show when={selectedDayId()}>
          {(dayId) => (
            <a href={gpxUrl(trip().id, dayId())} download="">
              this day
            </a>
          )}
        </Show>
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
  const distance = createMemo(() => props.day.routes.reduce((sum, route) => sum + routeDistance(route), 0));
  const remove = async () => {
    const parts = props.day.routes.length + props.day.stops.length;
    if (parts > 0 && !(await askConfirmation(`Remove ${dayLabel(props.day, props.index)} with its routes and stops?`, 'Remove'))) return;
    removeDay(props.day.id);
  };
  return (
    <li class="day" classList={{ selected: selected() }}>
      <div class="row">
        <button class="text grow" onClick={() => selectDay(props.day.id)} aria-pressed={selected()}>
          <span class="name">{dayLabel(props.day, props.index)}</span>
          <span class="muted">{distance() > 0 ? distanceText(distance()) : ''}</span>
        </button>
        <EditableName value={props.day.name} label="day" onRename={(name) => renameDay(props.day.id, name)}>
          <span />
        </EditableName>
        <button class="icon" title="Remove day" aria-label={`Remove ${dayLabel(props.day, props.index)}`} onClick={() => void remove()}>
          <DeleteIcon />
        </button>
      </div>
      <Show when={selected()}>
        <DayDetails day={props.day} />
      </Show>
    </li>
  );
}

/** The selected day's routes, and its stops (and route points on request) in riding order. */
function DayDetails(props: { day: Day }) {
  const listed = createMemo(() => new Map(selectedSequence().filter((e) => e.stop || showRoutePoints()).map((e) => [e.id, e])));
  return (
    <div class="day-details">
      <div class="row heading">
        <h4 class="grow">Routes</h4>
        <button onClick={addRoute}>Add route</button>
      </div>
      <ul class="routes">
        <For each={props.day.routes}>{(route) => <RouteItem route={route} day={props.day} />}</For>
      </ul>
      <Show when={props.day.routes.length === 0}>
        <p class="muted hint">Add a route, then tap the map to draw it.</p>
      </Show>
      <div class="row heading">
        <h4 class="grow">Stops</h4>
        <label class="toggle">
          <input type="checkbox" checked={showRoutePoints()} onChange={(e) => setShowRoutePoints(e.currentTarget.checked)} /> route points
        </label>
      </div>
      <ol class="stops">
        <For each={[...listed().keys()]}>{(id) => <SequenceItem entry={listed().get(id)!} />}</For>
      </ol>
      <Show when={listed().size === 0 && props.day.routes.length > 0}>
        <p class="muted hint">Make stops of route points, or tap beside the route with the stop tool.</p>
      </Show>
    </div>
  );
}

function RouteItem(props: { route: Route; day: Day }) {
  const editing = () => editingRouteId() === props.route.id;
  const profile = () => PROFILES.find((p) => p.value === props.route.profile)?.label ?? props.route.profile;
  const remove = async () => {
    if (props.route.points.length > 0 && !(await askConfirmation(`Remove ${routeLabel(props.route, props.day)} with its ${props.route.points.length} points?`, 'Remove'))) return;
    removeRoute(props.route.id);
  };
  return (
    <li class="row route" classList={{ editing: editing() }}>
      <EditableName value={routeLabel(props.route, props.day)} label="route" onRename={(name) => renameRoute(props.route.id, name)} />
      <span class="muted">
        {profile()}
        {props.route.points.length > 1 ? ` · ${distanceText(routeDistance(props.route))}` : ''}
      </span>
      <button classList={{ primary: editing() }} onClick={() => editRoute(editing() ? undefined : props.route.id)}>
        {editing() ? 'Done' : 'Edit'}
      </button>
      <button class="icon" title="Remove route" aria-label={`Remove ${routeLabel(props.route, props.day)}`} onClick={() => void remove()}>
        <DeleteIcon />
      </button>
    </li>
  );
}

/** A stop, or a plain route point, with its distance from the day's start; a click pans the map there. */
function SequenceItem(props: { entry: SequenceEntry }) {
  const stop = () => props.entry.stop;
  return (
    <li class="row sequence-item" classList={{ point: !stop() }}>
      <button class="text grow" onClick={() => panTo(props.entry.lngLat)} title={stop()?.pointId === null ? `Beside the route, ${distanceText(props.entry.near?.distanceM ?? 0)} from it; show on the map` : 'Show on the map'}>
        <Show when={stop()} fallback={<span class="point-dot" style={{ 'border-color': BOUND_COLOR }} />}>
          {(s) => <StopShape kind={s().kind} color={s().pointId === null ? FREE_COLOR : BOUND_COLOR} height={22} />}
        </Show>
        <span class="name">
          <Show when={stop()} fallback={<span class="muted">Route point</span>}>
            {(s) => <>{s().name}</>}
          </Show>
        </span>
        <span class="muted distance">{distanceText(props.entry.distanceM)}</span>
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
            <button class="icon" title="Remove stop" aria-label={`Remove ${s().name}`} onClick={() => removeStop(s().id)}>
              <DeleteIcon />
            </button>
          </>
        )}
      </Show>
    </li>
  );
}
