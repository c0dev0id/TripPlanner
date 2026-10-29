import { createMemo, createSignal, For, Show } from 'solid-js';
import { tripApi } from '../api';
import { dayOfEntry, onTarget, type Entry, type EntryTarget } from '../model/journal';
import type { LngLat } from '../model/trip';
import { panTo } from '../state/drawing';
import { addEntry, allEntries, closeJournal, editEntry, entriesOn, journalSpot, journalTarget, removeEntry } from '../state/journal';
import { openTrip, routeById, selectDay } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { followPointer } from '../ui/followPointer';
import { field, isTextField } from '../ui/form';
import { takenAtText } from '../ui/format';
import { DeleteIcon, PencilIcon, PinIcon } from '../ui/icons';
import { showWhile } from '../ui/modal';
import { createRequest } from '../ui/request';
import { EntryFile } from './EntryFile';
import { journalOverview } from './journalOverview';
import { dayLabelOf, routeLabelOf } from './labels';
import { prepareUpload } from './photo';

/** What the open journal is about: the trip, or the part by its label. */
function targetLabel(target: EntryTarget): string {
  const trip = openTrip()!;
  if ('dayId' in target) {
    const day = trip.days.find((d) => d.id === target.dayId);
    return day ? dayLabelOf(trip, day) : 'a removed day';
  }
  if ('stopId' in target) return trip.days.flatMap((d) => d.stops).find((s) => s.id === target.stopId)?.name ?? 'a removed stop';
  if ('routeId' in target) {
    const route = routeById(target.routeId);
    return route ? routeLabelOf(trip, route) : 'a removed route';
  }
  return trip.name;
}

/** Shows where an entry stands: its day on the map, and the map flown there. */
function showOnMap(entry: Entry, spot: LngLat): void {
  const day = dayOfEntry(openTrip()!.days, entry);
  if (day) selectDay(day.id);
  panTo(spot);
}

/** Where the journal window stands once dragged by its title; centred until then. Kept while the page lives. */
const [journalAt, setJournalAt] = createSignal<{ x: number; y: number }>();

/**
 * The journal of one part of the trip: its entries, oldest first, and a form for a new note
 * or file. The trip's own journal reads the whole trip top down, part by part, and takes
 * new entries on the trip itself. It is a window over the map, not a modal: the map stays
 * usable beside it, and it is dragged aside by its title.
 */
export function JournalDialog() {
  let dialog!: HTMLDialogElement;
  let form!: HTMLFormElement;
  showWhile(() => dialog, () => journalTarget() !== undefined);
  const { error, busy, run } = createRequest();
  /** Where the last photo went when the server placed it on the day of its date. */
  const [placed, setPlaced] = createSignal<string>();
  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const data = new FormData(form);
    const text = field(data, 'text');
    const file = data.get('file');
    const chosen = file instanceof File && file.size > 0 ? file : undefined;
    if (!text && !chosen) return;
    setPlaced(undefined);
    void run(async () => {
      const target = journalTarget()!;
      const entry = await addEntry(target, text, chosen && (await prepareUpload(chosen)), journalSpot());
      form.reset();
      if (!onTarget(entry, target) && entry.dayId) setPlaced(`${entry.file!.name} was placed on ${targetLabel({ dayId: entry.dayId })} by the time it was taken.`);
    });
  };
  const close = () => {
    setPlaced(undefined);
    closeJournal();
  };
  /** Moves the window with the pointer that pressed its title, kept whole inside the page. */
  const drag = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const box = dialog.getBoundingClientRect();
    const grip = { x: e.clientX - box.left, y: e.clientY - box.top };
    const within = (at: number, size: number, room: number) => Math.min(Math.max(at, 0), Math.max(room - size, 0));
    followPointer(e, (p) => setJournalAt({ x: within(p.clientX - grip.x, box.width, innerWidth), y: within(p.clientY - grip.y, box.height, innerHeight) }));
  };
  /** Esc closes the window, unless a note being written or edited takes it. */
  const escape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || isTextField(e.target)) return;
    e.preventDefault();
    close();
  };
  return (
    <dialog
      ref={dialog}
      class="dialog journal-dialog"
      classList={{ placed: journalAt() !== undefined }}
      style={journalAt() && { left: `${journalAt()!.x}px`, top: `${journalAt()!.y}px` }}
      aria-label="Journal"
      onClose={close}
      on:keydown={escape}
    >
      <Show when={journalTarget()}>
        {(target) => {
          const label = () => targetLabel(target());
          const wholeTrip = () => Object.keys(target()).length === 0;
          const list = () => entriesOn(target());
          /** The overview's parts by id, so that a change to the trip updates their sections rather than building them anew. */
          const overview = createMemo(() => new Map(wholeTrip() ? journalOverview(openTrip()!, allEntries()).map((part) => [part.id, part]) : []));
          return (
            <div class="dialog-body">
              <h3 class="name grip" title={label()} onPointerDown={drag}>
                Journal · {label()}
              </h3>
              <div class="journal-list" classList={{ overview: wholeTrip() }}>
                <Show when={wholeTrip()} fallback={<EntryList entries={list()} run={run} />}>
                  <For each={[...overview().keys()]}>
                    {(id) => {
                      const part = () => overview().get(id)!;
                      return (
                        <section class="journal-part" classList={{ day: part().kind === 'day' }}>
                          <h4>
                            <Show when={part().kind === 'route' || part().kind === 'stop'}>
                              <span class="kind">{part().kind === 'route' ? 'Route' : 'Stop'} · </span>
                            </Show>
                            {part().label}
                          </h4>
                          <EntryList entries={part().entries} run={run} />
                        </section>
                      );
                    }}
                  </For>
                </Show>
                <Show when={wholeTrip() ? overview().size === 0 : list().length === 0}>
                  <p class="muted">Nothing noted yet.</p>
                </Show>
              </div>
            <form ref={form} onSubmit={add}>
              <label>
                Note
                <textarea name="text" rows={3} maxlength={20000} placeholder="What to remember" />
              </label>
              <label>
                File or photo
                <input type="file" name="file" />
              </label>
              <Show when={journalSpot()}>
                <p class="muted hint">A new entry stands where you pressed the map; a photo that knows where it was taken stands there instead.</p>
              </Show>
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

type Runner = (work: () => Promise<void>) => Promise<void>;

function EntryList(props: { entries: Entry[]; run: Runner }) {
  return (
    <ul class="entries">
      <For each={props.entries}>{(entry) => <EntryItem entry={entry} run={props.run} />}</For>
    </ul>
  );
}

/** An entry: its file, when a photo was taken, its text, editable, where it stands, and its deletion; its requests run through the dialog's runner. */
function EntryItem(props: { entry: Entry; run: Runner }) {
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
      <Show when={props.entry.lngLat}>
        {(spot) => (
          <button type="button" class="icon" title="Show on the map" aria-label="Show on the map" onClick={() => showOnMap(props.entry, spot())}>
            <PinIcon />
          </button>
        )}
      </Show>
      <button type="button" class="icon" title="Edit the note" aria-label="Edit the note" onClick={() => setEditing(true)}>
        <PencilIcon />
      </button>
      <button type="button" class="icon" title="Delete the entry" aria-label="Delete the entry" onClick={() => void remove()}>
        <DeleteIcon />
      </button>
    </li>
  );
}
