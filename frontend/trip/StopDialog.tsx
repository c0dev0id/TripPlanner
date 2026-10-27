import { createMemo, For, Show } from 'solid-js';
import { STOP_KINDS, type Stop, type StopKind } from '../model/trip';
import { setStopDialogId, stopDialogId } from '../state/drawing';
import { selectedDay, updateStop } from '../state/trip';
import { showModalWhile } from '../ui/modal';

/** The details of a stop, in a modal dialog: name, kind, arrival time and pause, address, contact, booking, notes. */
export function StopDialog() {
  let dialog!: HTMLDialogElement;
  const stop = createMemo((): Stop | undefined => selectedDay()?.stops.find((s) => s.id === stopDialogId()));
  showModalWhile(() => dialog, () => stop() !== undefined);
  const save = (e: SubmitEvent) => {
    e.preventDefault();
    const s = stop();
    if (!s) return;
    const form = new FormData(e.currentTarget as HTMLFormElement);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    updateStop(s.id, {
      name: text('name') || s.name,
      kind: text('kind') as StopKind,
      arriveAt: text('arriveAt') || null,
      pauseMinutes: text('pauseMinutes') === '' ? null : Number(text('pauseMinutes')),
      address: text('address'),
      contact: text('contact'),
      bookingReference: text('bookingReference'),
      notes: text('notes'),
    });
    setStopDialogId(undefined);
  };
  return (
    <dialog ref={dialog} class="dialog" aria-label="Stop" onClose={() => setStopDialogId(undefined)}>
      <Show when={stop()} keyed>
        {(s) => (
          <form onSubmit={save}>
            <label>
              Name
              <input name="name" value={s.name} maxlength={200} required />
            </label>
            <label>
              Kind
              <select name="kind" value={s.kind}>
                <For each={STOP_KINDS}>{(kind) => <option value={kind.value}>{kind.label}</option>}</For>
              </select>
            </label>
            <div class="row">
              <label class="grow">
                Arrive at
                <input type="time" name="arriveAt" value={s.arriveAt ?? ''} />
              </label>
              <label class="grow">
                Pause (minutes)
                <input type="number" name="pauseMinutes" min={0} max={1440} step={5} value={s.pauseMinutes ?? ''} />
              </label>
            </div>
            <label>
              Address
              <textarea name="address" rows={2}>
                {s.address}
              </textarea>
            </label>
            <label>
              Contact
              <input name="contact" value={s.contact} />
            </label>
            <label>
              Booking reference
              <input name="bookingReference" value={s.bookingReference} />
            </label>
            <label>
              Notes
              <textarea name="notes" rows={3}>
                {s.notes}
              </textarea>
            </label>
            <div class="row end">
              <button type="button" onClick={() => setStopDialogId(undefined)}>
                Cancel
              </button>
              <button type="submit" class="primary">
                Save
              </button>
            </div>
          </form>
        )}
      </Show>
    </dialog>
  );
}
