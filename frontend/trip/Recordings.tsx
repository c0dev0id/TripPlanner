import { createSignal, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { Recording } from '../api';
import { lineLength } from '../geo/measure';
import type { Day } from '../model/trip';
import { copyRecordings, isCutRecording } from '../state/clipboard';
import { clearPartSelection, clickPart, isPartSelected, partsOfMenu, togglePart } from '../state/partSelection';
import { showWhole } from '../state/drawing';
import { opened, openRecording } from '../state/recordingView';
import {
  addRecording,
  loadedTrack,
  moveRecording,
  recordingAction,
  recordingById,
  recordingColor,
  recordingGpx,
  recordingNote,
  recordingsOf,
  recordingsShown,
  removeRecording,
  renameRecording,
  showRecordings,
  trackOf,
} from '../state/recordings';
import { openTrip, openTripId, selectDay } from '../state/trip';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { counted, distanceText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { PlusIcon, RecordingIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { dayLabel } from './labels';
import { pickFile } from '../ui/pickFile';

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

/** The day's recording symbol, there while it has recordings: shows them under the opened day and on the map, or hides them. */
export function RecordingsToggle(props: { dayId: string }) {
  const count = () => recordingsOf(props.dayId).length;
  const shown = () => recordingsShown(props.dayId);
  const label = () => (shown() ? t('Hide the recordings') : t('Show {what}', { what: counted(count(), 'recording') }));
  const toggle = () => {
    if (!shown()) selectDay(props.dayId);
    showRecordings(props.dayId, !shown());
  };
  return (
    <Show when={count() > 0}>
      <button class="icon recordings-toggle" aria-pressed={shown()} title={label()} aria-label={label()} onClick={toggle}>
        <RecordingIcon />
      </button>
    </Show>
  );
}

/** The opened day's recordings: adding one, and while they are shown, a row each with its colour on the map. */
export function DayRecordings(props: { day: Day }) {
  const recordings = () => recordingsOf(props.day.id);
  const [renamed, setRenamed] = createSignal<Recording>();
  const rename = (recording: Recording, name: string) => void recordingAction(recording.dayId, () => renameRecording(recording, name));
  return (
    <>
      <div class="row heading">
        <h4 class="grow">{t('Recordings')}</h4>
        <IconButton label={t('Add recording…')} onClick={() => addRecordingPicked(props.day.id)}>
          <PlusIcon />
        </IconButton>
      </div>
      <Show
        when={recordingsShown(props.day.id)}
        fallback={
          <Show when={recordings().length > 0}>
            <p class="muted hint">{t('{what}, hidden: the recording symbol on the day shows them.', { what: counted(recordings().length, 'recording') })}</p>
          </Show>
        }
      >
        <ul class="recordings">
          <For each={recordings()}>{(recording) => <RecordingItem recording={recording} onRename={setRenamed} />}</For>
        </ul>
      </Show>
      <Show when={recordingNote(props.day.id)}>{(note) => <p class="hint" classList={{ muted: !note().error, error: note().error }}>{note().text}</p>}</Show>
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
 * The menu of a recording, or of the selected recordings it is one of: rename, cut, copy,
 * move to another day, select, delete. What takes one recording alone is greyed out for
 * several.
 */
function recordingMenu(recording: Recording, onRename: (recording: Recording) => void): MenuItem[] {
  const chosen = partsOfMenu('recording', String(recording.id)).flatMap((id) => recordingById(Number(id)) ?? []);
  const several = chosen.length > 1;
  const dayId = recording.dayId;
  const copy = (cut: boolean) =>
    void recordingAction(dayId, async () => {
      const copied = await Promise.all(chosen.map(async (r) => ({ name: r.name, gpx: await recordingGpx(r) })));
      copyRecordings(copied, cut ? { tripId: openTripId()!, ids: chosen.map((r) => r.id) } : undefined);
    });
  const move = (to: string) =>
    void recordingAction(dayId, async () => {
      for (const r of chosen) await moveRecording(r, to);
      clearPartSelection();
    });
  const remove = async () => {
    const question = several ? t('Delete {what}?', { what: counted(chosen.length, 'recording') }) : t('Delete the recording “{name}”?', { name: recording.name });
    if (!(await askConfirmation(question, t('Delete')))) return;
    await recordingAction(dayId, async () => {
      for (const r of chosen) await removeRecording(r);
      clearPartSelection();
    });
  };
  const days = openTrip()!.days.flatMap((day, index) => (day.id === dayId ? [] : [{ label: dayLabel(day, index), run: () => move(day.id) }]));
  return [
    ...(several ? [{ label: t('{what} selected', { what: counted(chosen.length, 'recording') }), disabled: true, run: () => undefined }] : []),
    { label: t('Rename…'), disabled: several, run: () => onRename(recording) },
    { label: t('Cut'), run: () => copy(true) },
    { label: t('Copy'), run: () => copy(false) },
    ...(days.length > 0 ? [{ label: t('Move…'), items: days }] : []),
    ...(several || isPartSelected('recording', String(recording.id)) ? [] : [{ label: t('Select'), run: () => togglePart('recording', String(recording.id)) }]),
    { label: t('Delete'), run: () => void remove() },
  ];
}

/**
 * A recording as a row: its colour, its name over its length; a click shows it whole on
 * the map with its figures, with Cmd, Ctrl or Shift it selects; its menu is recordingMenu.
 */
function RecordingItem(props: { recording: Recording; onRename: (recording: Recording) => void }) {
  const track = () => trackOf(props.recording);
  const detail = () => {
    const loaded = track();
    if (loaded === undefined) return t('Reading…');
    if (loaded instanceof Error) return loaded.message;
    return `${distanceText(lineLength(loaded.points))} · ${counted(loaded.points.length, 'point')}`;
  };
  const openIt = () => {
    // Opened first, so that it is shown whole beside its cards.
    openRecording(props.recording.id);
    const loaded = loadedTrack(props.recording);
    if (loaded) showWhole(loaded.points);
  };
  const click = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) clickPart('recording', recordingsOf(props.recording.dayId).map((r) => String(r.id)), String(props.recording.id), e);
    else openIt();
  };
  return (
    <li
      class="recording"
      classList={{ opened: opened()?.recording.id === props.recording.id, picked: isPartSelected('recording', String(props.recording.id)), cut: isCutRecording(props.recording.id) }}
      ref={(el) => cardMenu(el, () => recordingMenu(props.recording, props.onRename))}
    >
      <div class="row">
        <button class="text grow" onClick={click}>
          <span class="swatch" style={{ background: recordingColor(props.recording) }} />
          <span class="lines grow">
            <span class="name">{props.recording.name}</span>
            <span class="muted detail">{detail()}</span>
          </span>
        </button>
        <MenuButton of={props.recording.name} items={() => recordingMenu(props.recording, props.onRename)} />
      </div>
    </li>
  );
}
