import { createMemo, For, Show } from 'solid-js';
import { gpxUrl, gpxZipUrl } from '../api';
import type { Day, Stop } from '../model/trip';
import { routeDistance } from '../routing/legs';
import { saveState } from '../state/autosave';
import { addDay, openTrip, removeDay, removeStop, renameDay, renamePlace, renameTrip, selectDay, selectedDayId } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { EditableName } from '../ui/EditableName';
import { distanceText } from '../ui/format';
import { BackIcon, DeleteIcon, DownloadIcon } from '../ui/icons';

/** The open trip: its name, its days with their stops, the export links and the saving state. */
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
      <h3>Days</h3>
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
  const label = () => `Day ${props.index + 1}`;
  const remove = async () => {
    if (props.day.stops.length > 0 && !(await askConfirmation(`Remove ${label()} with its ${props.day.stops.length} stops?`, 'Remove'))) return;
    removeDay(props.day.id);
  };
  return (
    <li class="day" classList={{ selected: selected() }}>
      <div class="row">
        <button class="text grow" onClick={() => selectDay(props.day.id)} aria-pressed={selected()}>
          <span class="name">
            {label()}
            {props.day.name ? ` · ${props.day.name}` : ''}
          </span>
          <span class="muted">{props.day.stops.length > 1 ? distanceText(distance()) : ''}</span>
        </button>
        <EditableName value={props.day.name} label="day" onRename={(name) => renameDay(props.day.id, name)}>
          <span />
        </EditableName>
        <button class="icon" title="Remove day" aria-label={`Remove ${label()}`} onClick={() => void remove()}>
          <DeleteIcon />
        </button>
      </div>
      <Show when={selected()}>
        <ol class="stops">
          <For each={props.day.stops}>{(stop, index) => <StopItem stop={stop} index={index()} />}</For>
        </ol>
        <Show when={props.day.stops.length === 0}>
          <p class="muted hint">Tap the map to add the first stop.</p>
        </Show>
      </Show>
    </li>
  );
}

function StopItem(props: { stop: Stop; index: number }) {
  const place = createMemo(() => openTrip()?.places.find((p) => p.id === props.stop.placeId));
  return (
    <li class="row stop-row">
      <span class="stop-index">{props.index + 1}</span>
      <EditableName value={place()?.name ?? ''} label="stop" onRename={(name) => renamePlace(props.stop.placeId, name)} />
      <button class="icon" title="Remove stop" aria-label={`Remove stop ${props.index + 1}`} onClick={() => removeStop(props.stop.id)}>
        <DeleteIcon />
      </button>
    </li>
  );
}
