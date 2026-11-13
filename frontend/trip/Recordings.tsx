import { createSignal, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { Recording, WaitingRecording } from '../api';
import type { Day } from '../model/trip';
import { copyRecordings, isCutRecording } from '../state/clipboard';
import { clearPartSelection, clickPart, isPartSelected, partsOfMenu, togglePart } from '../state/partSelection';
import { showWhole } from '../state/drawing';
import { groupEye, recordingEye, setGroupEye, setRecordingEyes } from '../state/eyes';
import { openRecording } from '../state/recordingView';
import {
  activeRecordingId,
  addRecording,
  assignRecording,
  closeLookup,
  isPreviewed,
  loadedTrack,
  lookUp,
  lookupOf,
  preview,
  moveRecording,
  recordingAction,
  recordingById,
  recordingColor,
  recordingGpx,
  recordingNote,
  recordingsOf,
  removeRecording,
  renameRecording,
  trackOf,
} from '../state/recordings';
import { openTrip, openTripId } from '../state/trip';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { counted, distanceText, momentText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CloseIcon, PlusIcon, SearchIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { Eye } from './Eye';
import { eyeItems, moveToDayItem } from './partMenu';
import { pickFile } from '../ui/pickFile';
import { selects } from '../ui/selection';

/** Adds a GPX file of one track the user picks to the day as a recording, and shows it whole on the map. */
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

/** The opened day's recordings, a row each with its eye and its colour on the map: adding one, on a trip's day looking up those that wait for it, and the eye of them all. */
export function DayRecordings(props: { day: Day }) {
  const recordings = () => recordingsOf(props.day.id);
  const [renamed, setRenamed] = createSignal<Recording>();
  const rename = (recording: Recording, name: string) => void recordingAction(recording.dayId, () => renameRecording(recording, name));
  return (
    <>
      <div class="row heading">
        <h4 class="grow">{t('Recordings')}</h4>
        <Show when={recordings().length > 0}>
          <Eye of={t('the recordings')} open={groupEye('recordings')} onToggle={(open) => setGroupEye('recordings', open)} />
        </Show>
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
 * What a day's lookup found among the recordings that wait for their day: a row each with
 * when it began, its length and why it was found; a click shows it on the map, the plus
 * puts it on the day.
 */
function FoundRecordings(props: { dayId: string; found: WaitingRecording[] | undefined }) {
  const said = () => {
    if (!props.found) return t('Looking through the recordings that wait for their day…');
    if (props.found.length === 0) return t('None of the recordings that wait for their day began on this day or ran along its routes.');
    return t('{what} may be of this day:', { what: counted(props.found.length, 'recording') });
  };
  const why = (waiting: WaitingRecording) => [waiting.sameDate && t('on this day'), waiting.share > 0 && t('{share} % along the routes', { share: Math.round(waiting.share * 100) })];
  const assign = (waiting: WaitingRecording) =>
    void recordingAction(props.dayId, async () => {
      await assignRecording(props.dayId, waiting);
      return t('“{name}” added as a recording.', { name: waiting.name });
    });
  return (
    <div class="found-recordings">
      <div class="row">
        <p class="muted hint grow">{said()}</p>
        <IconButton label={t('Close')} onClick={closeLookup}>
          <CloseIcon />
        </IconButton>
      </div>
      <ul class="recordings">
        <For each={props.found}>
          {(waiting) => (
            <li class="recording" classList={{ opened: isPreviewed(waiting) }}>
              <div class="row">
                <button class="text grow" onClick={() => preview(waiting)}>
                  <span class="lines grow">
                    <span class="name">{waiting.name}</span>
                    <span class="muted detail">{[waiting.startedAt && momentText(waiting.startedAt), distanceText(waiting.distanceM), ...why(waiting)].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                <IconButton label={t('Add to this day')} onClick={() => assign(waiting)}>
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

/** Copies recordings of a day of the open trip, each with its GPX file; cut, they leave it when they are pasted. */
export function clipRecordings(chosen: readonly Recording[], cut: boolean): void {
  if (chosen.length === 0) return;
  void recordingAction(chosen[0]!.dayId, async () => {
    const copied = await Promise.all(chosen.map(async (r) => ({ name: r.name, gpx: await recordingGpx(r) })));
    copyRecordings(copied, cut ? { tripId: openTripId()!, ids: chosen.map((r) => r.id) } : undefined);
  });
}

/** Deletes recordings of a day of the open trip, once the user agrees. */
export async function deleteRecordingsAsked(chosen: readonly Recording[]): Promise<void> {
  const [first] = chosen;
  if (!first) return;
  const question = chosen.length > 1 ? t('Delete {what}?', { what: counted(chosen.length, 'recording') }) : t('Delete the recording “{name}”?', { name: first.name });
  if (!(await askConfirmation(question, t('Delete')))) return;
  await recordingAction(first.dayId, async () => {
    for (const r of chosen) await removeRecording(r);
    clearPartSelection();
  });
}

/**
 * The menu of a recording, or of the selected recordings it is one of: rename, cut, copy,
 * move to another day, for several their eyes, select, delete. What takes one recording
 * alone is greyed out for several.
 */
function recordingMenu(recording: Recording, onRename: (recording: Recording) => void): MenuItem[] {
  const chosen = partsOfMenu('recording', String(recording.id)).flatMap((id) => recordingById(Number(id)) ?? []);
  const several = chosen.length > 1;
  const dayId = recording.dayId;
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
    ...(several ? eyeItems((open) => setRecordingEyes(chosen.map((r) => r.id), open)) : []),
    ...(several || isPartSelected('recording', String(recording.id)) ? [] : [{ label: t('Select'), run: () => togglePart('recording', String(recording.id)) }]),
    { label: t('Delete'), run: () => void deleteRecordingsAsked(chosen) },
  ];
}

/**
 * A recording as a row: its colour, its name over when it began and its length, or over
 * why its file cannot be read, and its eye; a click opens it, which shows it whole on the
 * map with its figures whatever its eye says, and a click on the opened one closes it;
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
    if (selects(e)) clickPart('recording', recordingsOf(props.recording.dayId).map((r) => String(r.id)), String(props.recording.id), e);
    else if (isOpened()) openRecording(undefined);
    else openIt();
  };
  return (
    <li
      class="recording"
      classList={{ opened: isOpened(), picked: isPartSelected('recording', String(props.recording.id)), cut: isCutRecording(props.recording.id) }}
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
        <Eye of={props.recording.name} open={recordingEye(props.recording.id)} veiled={!groupEye('recordings')} onToggle={(open) => setRecordingEyes([props.recording.id], open)} />
        <MenuButton of={props.recording.name} items={() => recordingMenu(props.recording, props.onRename)} />
      </div>
    </li>
  );
}
