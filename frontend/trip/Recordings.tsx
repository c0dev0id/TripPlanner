import { createSignal, For, Show } from 'solid-js';
import type { Recording } from '../api';
import { lineLength } from '../geo/measure';
import type { Day } from '../model/trip';
import { copyRecording } from '../state/clipboard';
import { showWhole } from '../state/drawing';
import { opened, openRecording } from '../state/recordingView';
import {
  addRecording,
  recordingAction,
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
import { selectDay } from '../state/trip';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { counted, distanceText } from '../ui/format';
import { RecordingIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { NameDialog } from '../ui/NameDialog';
import { pickFile } from '../ui/pickFile';

/** Adds a GPX file of one track the user picks to the day as a recording, and shows it whole on the map. */
export function addRecordingPicked(dayId: string): void {
  void pickFile('.gpx,application/gpx+xml').then((file) => {
    if (!file) return;
    void recordingAction(dayId, async () => {
      const recording = await addRecording(dayId, await file.text(), { fallback: file.name.replace(/\.gpx$/i, '') });
      const track = trackOf(recording);
      if (track && !(track instanceof Error)) showWhole(track.points);
      return `${file.name} added as “${recording.name}”.`;
    });
  });
}

/** The day's recording symbol, there while it has recordings: shows them under the opened day and on the map, or hides them. */
export function RecordingsToggle(props: { dayId: string }) {
  const count = () => recordingsOf(props.dayId).length;
  const shown = () => recordingsShown(props.dayId);
  const label = () => (shown() ? 'Hide the recordings' : `Show ${counted(count(), 'recording')}`);
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
  const rename = (recording: Recording, name: string) =>
    void recordingAction(recording.dayId, async () => {
      await renameRecording(recording, name);
      return undefined;
    });
  return (
    <>
      <div class="row heading">
        <h4 class="grow">Recordings</h4>
        <button onClick={() => addRecordingPicked(props.day.id)}>Add recording…</button>
      </div>
      <Show
        when={recordingsShown(props.day.id)}
        fallback={
          <Show when={recordings().length > 0}>
            <p class="muted hint">{counted(recordings().length, 'recording')}, hidden: the recording symbol on the day shows them.</p>
          </Show>
        }
      >
        <ul class="recordings">
          <For each={recordings()}>{(recording) => <RecordingItem recording={recording} onRename={setRenamed} />}</For>
        </ul>
      </Show>
      <Show when={recordingNote(props.day.id)}>{(note) => <p class="hint" classList={{ muted: !note().error, error: note().error }}>{note().text}</p>}</Show>
      <NameDialog
        title="Rename recording"
        open={renamed() !== undefined}
        placeholder="Name of the recording"
        initial={renamed()?.name}
        onClose={() => setRenamed(undefined)}
        onSubmit={(name) => rename(renamed()!, name)}
      />
    </>
  );
}

/** A recording as a row: its colour, its name over its length; a click shows it whole on the map with its figures, its menu renames, copies or deletes it. */
function RecordingItem(props: { recording: Recording; onRename: (recording: Recording) => void }) {
  const track = () => trackOf(props.recording);
  const detail = () => {
    const t = track();
    if (t === undefined) return 'Reading…';
    if (t instanceof Error) return t.message;
    return `${distanceText(lineLength(t.points))} · ${counted(t.points.length, 'point')}`;
  };
  const dayId = () => props.recording.dayId;
  const remove = async () => {
    if (!(await askConfirmation(`Delete the recording “${props.recording.name}”?`, 'Delete'))) return;
    await recordingAction(dayId(), async () => {
      await removeRecording(props.recording);
      return undefined;
    });
  };
  const items = (): MenuItem[] => [
    { label: 'Rename…', run: () => props.onRename(props.recording) },
    {
      label: 'Copy',
      run: () =>
        void recordingAction(dayId(), async () => {
          copyRecording(props.recording.name, await recordingGpx(props.recording));
          return undefined;
        }),
    },
    { label: 'Delete', run: () => void remove() },
  ];
  const openIt = () => {
    // Opened first, so that it is shown whole beside its cards.
    openRecording(props.recording.id);
    const t = track();
    if (t && !(t instanceof Error)) showWhole(t.points);
  };
  return (
    <li class="recording" classList={{ opened: opened()?.recording.id === props.recording.id }} ref={(el) => cardMenu(el, items)}>
      <button class="text row" onClick={openIt}>
        <span class="swatch" style={{ background: recordingColor(props.recording) }} />
        <span class="lines grow">
          <span class="name">{props.recording.name}</span>
          <span class="muted detail">{detail()}</span>
        </span>
      </button>
    </li>
  );
}
