import { createMemo, For, Show } from 'solid-js';
import { STOP_KINDS, type Stop, type StopKind } from '../model/trip';
import { editing, setEditing } from '../state/drawing';
import { removeStop, selectedDay, updateStop } from '../state/trip';
import { EditDialog, field } from '../ui/EditDialog';

/** A stop of the selected day: name, kind, arrival time and pause, address, contact, booking, notes, whether it is optional; and its removal. */
export function StopDialog() {
  const stop = createMemo((): Stop | undefined => {
    const target = editing();
    return target?.kind === 'stop' ? selectedDay()?.stops.find((s) => s.id === target.id) : undefined;
  });
  const close = () => setEditing(undefined);
  const save = (form: FormData) => {
    const s = stop()!;
    updateStop(s.id, {
      name: field(form, 'name') || s.name,
      kind: field(form, 'kind') as StopKind,
      arriveAt: field(form, 'arriveAt') || null,
      pauseMinutes: field(form, 'pauseMinutes') === '' ? null : Number(field(form, 'pauseMinutes')),
      optional: form.get('optional') === 'on',
      address: field(form, 'address'),
      contact: field(form, 'contact'),
      bookingReference: field(form, 'bookingReference'),
      notes: field(form, 'notes'),
    });
    close();
  };
  const remove = () => {
    removeStop(stop()!.id);
    close();
  };
  return (
    <EditDialog label="Stop" title={stop()?.name ?? ''} open={stop() !== undefined} onClose={close} onSubmit={save} danger={{ label: 'Remove', run: remove }}>
      <Show when={stop()} keyed>
        {(s) => (
          <>
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
            <label class="toggle">
              <input type="checkbox" name="optional" checked={s.optional} /> Optional: a stop to decide on the day, left out of an export on request
            </label>
          </>
        )}
      </Show>
    </EditDialog>
  );
}
