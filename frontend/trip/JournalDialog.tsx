import { createSignal, For, Show } from 'solid-js';
import { entryFileUrl, entryPreviewUrl, errorMessage, tripApi } from '../api';
import { sizeText, type Entry, type EntryTarget } from '../model/journal';
import { addEntry, editEntry, entriesOn, journalTarget, removeEntry, setJournalTarget } from '../state/journal';
import { openTrip, routeById } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { takenAtText } from '../ui/format';
import { DeleteIcon, PencilIcon } from '../ui/icons';
import { showModalWhile } from '../ui/modal';
import { dayLabel, routeLabel } from './labels';

/** What the open journal is about: the trip, or the part by its label. */
function targetLabel(target: EntryTarget): string {
  const trip = openTrip()!;
  if ('dayId' in target) {
    const index = trip.days.findIndex((d) => d.id === target.dayId);
    return index < 0 ? 'a removed day' : dayLabel(trip.days[index]!, index);
  }
  if ('stopId' in target) return trip.days.flatMap((d) => d.stops).find((s) => s.id === target.stopId)?.name ?? 'a removed stop';
  if ('routeId' in target) {
    const route = routeById(target.routeId);
    return route ? routeLabel(route, trip.days.find((d) => d.routes.includes(route))!) : 'a removed route';
  }
  return trip.name;
}

/** The journal of the trip or of one of its parts: its entries, oldest first, and a form for a new note or file. */
export function JournalDialog() {
  let dialog!: HTMLDialogElement;
  let form!: HTMLFormElement;
  showModalWhile(() => dialog, () => journalTarget() !== undefined);
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const run = async (work: () => Promise<void>) => {
    setError(undefined);
    setBusy(true);
    try {
      await work();
    } catch (fault) {
      setError(errorMessage(fault));
    } finally {
      setBusy(false);
    }
  };
  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const data = new FormData(form);
    const text = String(data.get('text') ?? '').trim();
    const file = data.get('file');
    const chosen = file instanceof File && file.size > 0 ? file : undefined;
    if (!text && !chosen) return;
    void run(async () => {
      await addEntry(journalTarget()!, text, chosen);
      form.reset();
    });
  };
  return (
    <dialog ref={dialog} class="dialog journal-dialog" aria-label="Journal" onClose={() => setJournalTarget(undefined)}>
      <Show when={journalTarget()}>
        {(target) => (
          <div class="dialog-body">
            <h3 class="name" title={targetLabel(target())}>
              Journal · {targetLabel(target())}
            </h3>
            <ul class="entries">
              <For each={entriesOn(target())}>{(entry) => <EntryItem entry={entry} onError={setError} />}</For>
            </ul>
            <Show when={entriesOn(target()).length === 0}>
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
              <div class="row end">
                <button type="button" onClick={() => setJournalTarget(undefined)}>
                  Close
                </button>
                <button type="submit" class="primary" disabled={busy()}>
                  Add
                </button>
              </div>
            </form>
          </div>
        )}
      </Show>
    </dialog>
  );
}

/** An entry: its file as a preview or a link, when and where a photo was taken, its text, editable, and its deletion. */
function EntryItem(props: { entry: Entry; onError: (message: string) => void }) {
  const [editing, setEditing] = createSignal(false);
  const base = () => tripApi(props.entry.tripId);
  const remove = async () => {
    if (!(await askConfirmation('Delete this journal entry?', 'Delete'))) return;
    removeEntry(props.entry).catch((fault) => props.onError(errorMessage(fault)));
  };
  const save = (text: string) => {
    setEditing(false);
    if (text !== props.entry.text) editEntry(props.entry, text).catch((fault) => props.onError(errorMessage(fault)));
  };
  return (
    <li class="entry">
      <Show when={props.entry.file}>
        {(file) => (
          <a class="file" href={entryFileUrl(base(), props.entry.id)} target="_blank" rel="noopener" title={`${file().name}, ${sizeText(file().size)}`}>
            <Show when={file().image} fallback={<span class="file-name">{file().name}</span>}>
              <img src={entryPreviewUrl(base(), props.entry.id)} alt={file().name} loading="lazy" />
            </Show>
          </a>
        )}
      </Show>
      <div class="grow lines">
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
