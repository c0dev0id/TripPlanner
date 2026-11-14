import { createSignal, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { FoundRidingDay, Recording } from '../api';
import type { Day } from '../model/trip';
import { copyRecordings, isCutRecording } from '../state/clipboard';
import { clearPartSelection, clickPart, isPartSelected, partsOfMenu, togglePart } from '../state/partSelection';
import { showWhole } from '../state/drawing';
import { isRecordingPinned, pinRecordings } from '../state/pins';
import { openRecording } from '../state/recordingView';
import { showRide } from '../state/rides';
import {
  activeRecordingId,
  addRecording,
  assignRidingDay,
  closeLookup,
  isPreviewed,
  loadedTrack,
  lookUp,
  lookupOf,
  preview,
  moveRecording,
  recordingAction,
  recordingColor,
  recordingNote,
  recordingsAmong,
  recordingsOf,
  takeOffDay,
  renameRecording,
  trackOf,
} from '../state/recordings';
import { openTrip } from '../state/trip';
import { cardMenu } from '../ui/cardMenu';
import { counted, dateText, distanceText, momentText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CloseIcon, PlusIcon, SearchIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { moveToDayItem, pinItems } from './partMenu';
import { Pin } from './Pin';
import { pickFile } from '../ui/pickFile';

/** Keeps a GPX file of one track the user picks as a ride on the day, and shows it whole on the map. */
export function addRecordingPicked(dayId: string): void {
  void pickFile('.gpx,application/gpx+xml').then((file) => {
    if (!file) return;
    void recordingAction(dayId, async () => {
      const recording = await addRecording(dayId, await file.text(), { fallback: file.name.replace(/\.gpx$/i, '') });
      const track = loadedTrack(recording);
      if (track) showWhole(track.points);
      return t('{file} added as “{name}”.', { file: file.name, name: recording.name });
    });
  });
}

/** The rides on the opened day, a row each with its pin and its colour on the map: adding one, and on a trip's day looking up those that may be its. */
export function DayRecordings(props: { day: Day }) {
  const recordings = () => recordingsOf(props.day.id);
  const [renamed, setRenamed] = createSignal<Recording>();
  const rename = (recording: Recording, name: string) => void recordingAction(recording.dayId, () => renameRecording(recording, name));
  return (
    <>
      <div class="row">
        <h4 class="grow">{t('Recordings')}</h4>
        <Show when={openTrip()?.kind === 'trip'}>
          <IconButton label={t('Look up recordings…')} onClick={() => void recordingAction(props.day.id, () => lookUp(props.day))}>
            <SearchIcon />
          </IconButton>
        </Show>
        <IconButton label={t('Add recording…')} onClick={() => addRecordingPicked(props.day.id)}>
          <PlusIcon />
        </IconButton>
      </div>
      <ul class="recordings">
        <For each={recordings()}>{(recording) => <RecordingItem recording={recording} onRename={setRenamed} />}</For>
      </ul>
      <Show when={recordingNote(props.day.id)}>{(note) => <p class="hint" classList={{ muted: !note().error, error: note().error }}>{note().text}</p>}</Show>
      <Show when={lookupOf(props.day.id)}>{(looked) => <FoundRecordings dayId={props.day.id} found={looked().found} />}</Show>
      <NameDialog
        title={t('Rename recording')}
        open={renamed() !== undefined}
        placeholder={t('Name of the recording')}
        initial={renamed()?.name}
        onClose={() => setRenamed(undefined)}
        onSubmit={(name) => rename(renamed()!, name)}
      />
    </>
  );
}

/**
 * What a day's lookup found among the user's rides: a row for each day of riding with
 * its date, its rides, how far it went and why it was found; a click shows it on the
 * map, the plus puts its rides on the day.
 */
function FoundRecordings(props: { dayId: string; found: FoundRidingDay[] | undefined }) {
  const said = () => {
    if (!props.found) return t('Looking through your rides…');
    if (props.found.length === 0) return t('No ride that is not on this day began on its date or ran along its routes.');
    return t('{what} may be of this day:', { what: counted(props.found.length, 'riding day') });
  };
  const detail = (ridingDay: FoundRidingDay) =>
    [
      ridingDay.rides.length > 1 ? counted(ridingDay.rides.length, 'recording') : ridingDay.date !== null && ridingDay.rides[0]!.name,
      distanceText(ridingDay.rides.reduce((sum, ride) => sum + ride.distanceM, 0)),
      ridingDay.sameDate && t('on this day'),
      ridingDay.share > 0 && t('{share} % along the routes', { share: Math.round(ridingDay.share * 100) }),
    ]
      .filter(Boolean)
      .join(' · ');
  const assign = (ridingDay: FoundRidingDay) =>
    void recordingAction(props.dayId, async () => {
      await assignRidingDay(props.dayId, ridingDay);
      const [first] = ridingDay.rides;
      return ridingDay.rides.length === 1 ? t('“{name}” added as a recording.', { name: first!.name }) : t('{n} recordings added.', { n: ridingDay.rides.length });
    });
  return (
    <div>
      <div class="row">
        <p class="muted hint grow">{said()}</p>
        <IconButton label={t('Close')} onClick={closeLookup}>
          <CloseIcon />
        </IconButton>
      </div>
      <ul class="recordings">
        <For each={props.found}>
          {(ridingDay) => (
            <li class="recording" classList={{ opened: isPreviewed(ridingDay) }}>
              <div class="row">
                <button class="text grow" onClick={() => preview(ridingDay)}>
                  <span class="lines grow">
                    <span class="name">{ridingDay.date === null ? ridingDay.rides[0]!.name : dateText(ridingDay.date)}</span>
                    <span class="muted detail">{detail(ridingDay)}</span>
                  </span>
                </button>
                <IconButton label={t('Add to this day')} onClick={() => assign(ridingDay)}>
                  <PlusIcon />
                </IconButton>
              </div>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

/** Copies rides on a day of the open trip, to be put on the day they are pasted onto; cut, they are taken off theirs then. */
export function clipRecordings(chosen: readonly Recording[], cut: boolean): void {
  if (chosen.length > 0) copyRecordings([...chosen], cut ? chosen[0]!.dayId : undefined);
}

/** Takes rides off their day of the open trip; they stay rides. */
export async function takeRecordingsOff(chosen: readonly Recording[]): Promise<void> {
  const [first] = chosen;
  if (!first) return;
  await recordingAction(first.dayId, async () => {
    for (const r of chosen) await takeOffDay(r.id, r.dayId);
    clearPartSelection();
  });
}

/**
 * The menu of a recording, or of the selected recordings it is one of: rename, cut, copy,
 * move to another day, show it among the rides, for several their pins, select, take off
 * the day. What takes one recording alone is greyed out for several.
 */
function recordingMenu(recording: Recording, onRename: (recording: Recording) => void): MenuItem[] {
  const dayId = recording.dayId;
  const chosen = recordingsAmong(dayId, partsOfMenu('recording', String(recording.id)));
  const several = chosen.length > 1;
  const move = (to: string) =>
    void recordingAction(dayId, async () => {
      for (const r of chosen) await moveRecording(r, to);
      clearPartSelection();
    });
  return [
    ...(several ? [{ label: t('{what} selected', { what: counted(chosen.length, 'recording') }), disabled: true, run: () => undefined }] : []),
    { label: t('Rename…'), disabled: several, run: () => onRename(recording) },
    { label: t('Cut'), run: () => clipRecordings(chosen, true) },
    { label: t('Copy'), run: () => clipRecordings(chosen, false) },
    ...moveToDayItem(dayId, move),
    { label: t('Show in the rides'), disabled: several, run: () => showRide(recording.id) },
    ...(several ? pinItems((pinned) => pinRecordings(chosen.map((r) => r.id), pinned)) : []),
    ...(several || isPartSelected('recording', String(recording.id)) ? [] : [{ label: t('Select'), run: () => togglePart('recording', String(recording.id)) }]),
    { label: t('Take off this day'), run: () => void takeRecordingsOff(chosen) },
  ];
}

/**
 * A recording as a row: its colour, its name over when it began and its length, or over
 * why its file cannot be read, and its pin; a click opens it, which shows it whole on the
 * map with its figures, and a click on the opened one closes it;
 * with Cmd, Ctrl or Shift it selects; its menu is recordingMenu.
 */
function RecordingItem(props: { recording: Recording; onRename: (recording: Recording) => void }) {
  const track = () => trackOf(props.recording);
  const detail = () => {
    const loaded = track();
    if (loaded instanceof Error) return loaded.message;
    const { startedAt, distanceM } = props.recording;
    return `${startedAt ? momentText(startedAt) : t('no times')} · ${distanceText(distanceM)}`;
  };
  const isOpened = () => activeRecordingId() === props.recording.id;
  const openIt = () => {
    // Opened first, so that it is shown whole beside its cards; one whose file is yet to be read is shown whole when it arrives.
    openRecording(props.recording.id);
    const loaded = loadedTrack(props.recording);
    if (loaded) showWhole(loaded.points);
  };
  const click = (e: MouseEvent) => {
    if (clickPart('recording', recordingsOf(props.recording.dayId).map((r) => String(r.id)), String(props.recording.id), e)) return;
    if (isOpened()) openRecording(undefined);
    else openIt();
  };
  return (
    <li
      class="recording"
      classList={{ opened: isOpened(), picked: isPartSelected('recording', String(props.recording.id)), cut: isCutRecording(props.recording) }}
      ref={(el) => cardMenu(el, () => recordingMenu(props.recording, props.onRename))}
    >
      <div class="row">
        <button class="text grow" aria-pressed={isOpened()} onClick={click}>
          <span class="swatch" style={{ background: recordingColor(props.recording) }} />
          <span class="lines grow">
            <span class="name">{props.recording.name}</span>
            <span class="muted detail">{detail()}</span>
          </span>
        </button>
        <Pin of={props.recording.name} pinned={isRecordingPinned(props.recording.id)} onToggle={(pinned) => pinRecordings([props.recording.id], pinned)} />
        <MenuButton of={props.recording.name} items={() => recordingMenu(props.recording, props.onRename)} />
      </div>
    </li>
  );
}
