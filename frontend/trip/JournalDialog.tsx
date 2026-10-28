import { createSignal, For, Show } from 'solid-js';
import { tripApi } from '../api';
import { onTarget, type Entry, type EntryTarget } from '../model/journal';
import { addEntry, editEntry, entriesOn, journalTarget, removeEntry, setJournalTarget } from '../state/journal';
import { openTrip } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { takenAtText } from '../ui/format';
import { DeleteIcon, PencilIcon } from '../ui/icons';
import { showModalWhile } from '../ui/modal';
import { createRequest } from '../ui/request';
import { EntryFile } from './EntryFile';
import { dayLabel, routeLabel } from './labels';
import { prepareUpload } from './photo';

/** What the open journal is about: the trip, or the part by its label. */
function targetLabel(target: EntryTarget): string {
  const trip = openTrip()!;
  if ('dayId' in target) {
    const index = trip.days.findIndex((d) => d.id === target.dayId);
    return index < 0 ? 'a removed day' : dayLabel(trip.days[index]!, index);
  }
  if ('stopId' in target) return trip.days.flatMap((d) => d.stops).find((s) => s.id === target.stopId)?.name ?? 'a removed stop';
  if ('routeId' in target) {
    for (const day of trip.days) {
      const route = day.routes.find((r) => r.id === target.routeId);
      if (route) return routeLabel(route, day);
    }
    return 'a removed route';
  }
  return trip.name;
}

/** The journal of the trip or of one of its parts: its entries, oldest first, and a form for a new note or file. */
export function JournalDialog() {
  let dialog!: HTMLDialogElement;
  let form!: HTMLFormElement;
  showModalWhile(() => dialog, () => journalTarget() !== undefined);
  const { error, busy, run } = createRequest();
  /** Where the last photo went when the server placed it on the day of its date. */
  const [placed, setPlaced] = createSignal<string>();
  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const data = new FormData(form);
    const text = String(data.get('text') ?? '').trim();
    const file = data.get('file');
    const chosen = file instanceof File && file.size > 0 ? file : undefined;
    if (!text && !chosen) return;
    setPlaced(undefined);
    void run(async () => {
      const target = journalTarget()!;
      const entry = await addEntry(target, text, chosen && (await prepareUpload(chosen)));
      form.reset();
      if (!onTarget(entry, target) && entry.dayId) setPlaced(`${entry.file!.name} was placed on ${targetLabel({ dayId: entry.dayId })} by the time it was taken.`);
    });
  };
  const close = () => {
    setPlaced(undefined);
    setJournalTarget(undefined);
  };
  return (
    <dialog ref={dialog} class="dialog journal-dialog" aria-label="Journal" onClose={close}>
      <Show when={journalTarget()}>
        {(target) => {
          const label = () => targetLabel(target());
          const list = () => entriesOn(target());
          return (
            <div class="dialog-body">
              <h3 class="name" title={label()}>
                Journal · {label()}
              </h3>
              <ul class="entries">
                <For each={list()}>{(entry) => <EntryItem entry={entry} run={run} />}</For>
              </ul>
              <Show when={list().length === 0}>
                <p class="muted">Nothing noted yet.</p>
              </Show>
            <form ref={form} onSubmit={add}>
              <label>
                Note
                <textarea name="text" rows={3} maxlength={20000} placeholder="What to remember" />
              </label>
              <label>
                File or photo
                <input type="file" name="file" />
              </label>
              <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
              <Show when={placed()}>{(note) => <p class="muted hint">{note()}</p>}</Show>
              <div class="row end">
                <button type="button" onClick={close}>
                  Close
                </button>
                <button type="submit" class="primary" disabled={busy()}>
                  Add
                </button>
              </div>
            </form>
            </div>
          );
        }}
      </Show>
    </dialog>
  );
}

/** An entry: its file, when a photo was taken, its text, editable, and its deletion; its requests run through the dialog's runner. */
function EntryItem(props: { entry: Entry; run: (work: () => Promise<void>) => Promise<void> }) {
  const [editing, setEditing] = createSignal(false);
  const remove = async () => {
    if (!(await askConfirmation('Delete this journal entry?', 'Delete'))) return;
    void props.run(() => removeEntry(props.entry));
  };
  const save = (text: string) => {
    setEditing(false);
    if (text !== props.entry.text) void props.run(() => editEntry(props.entry, text));
  };
  return (
    <li class="entry">
      <EntryFile entry={props.entry} base={tripApi(props.entry.tripId)} />
      <div class="lines">
        <Show when={props.entry.takenAt}>{(taken) => <span class="muted detail">{takenAtText(taken())}</span>}</Show>
        <Show when={editing()} fallback={<p class="text">{props.entry.text}</p>}>
          <textarea rows={3} maxlength={20000} ref={(el) => setTimeout(() => el.focus())} onBlur={(e) => save(e.currentTarget.value.trim())} onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}>
            {props.entry.text}
          </textarea>
        </Show>
      </div>
      <button type="button" class="icon" title="Edit the note" aria-label="Edit the note" onClick={() => setEditing(true)}>
        <PencilIcon />
      </button>
      <button type="button" class="icon" title="Delete the entry" aria-label="Delete the entry" onClick={() => void remove()}>
        <DeleteIcon />
      </button>
    </li>
  );
}
