import { createMemo } from 'solid-js';
import type { Stop } from '../model/trip';
import { editTarget, setEditTarget } from '../state/drawing';
import { removeStop, selectedDay, updateStop } from '../state/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import { SymbolField } from './SymbolField';

/** A stop of the selected day: name, symbol, arrival time and pause, address, contact, booking, notes, whether it is optional; and its removal. */
export function StopDialog() {
  const stop = createMemo((): Stop | undefined => {
    const target = editTarget();
    return target?.kind === 'stop' ? selectedDay()?.stops.find((s) => s.id === target.id) : undefined;
  });
  const close = () => setEditTarget(undefined);
  const save = (form: FormData, s: Stop) => {
    const pause = field(form, 'pauseMinutes');
    updateStop(s.id, {
      name: field(form, 'name') || s.name,
      symbol: field(form, 'symbol') || null,
      arriveAt: field(form, 'arriveAt') || null,
      pauseMinutes: pause === '' ? null : Number(pause),
      optional: form.get('optional') === 'on',
      address: field(form, 'address'),
      contact: field(form, 'contact'),
      bookingReference: field(form, 'bookingReference'),
      notes: field(form, 'notes'),
    });
  };
  const remove = (s: Stop) => {
    removeStop(s.id);
    close();
  };
  return (
    <EditDialog label="Stop" value={stop()} title={(s) => s.name} onClose={close} onSubmit={save} actions={(s) => [{ label: 'Remove', run: () => remove(s), danger: true }]}>
      {(s) => (
        <>
          <label>
            Name
            <input name="name" value={s.name} maxlength={200} required />
          </label>
          <SymbolField initial={s.symbol} />
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
    </EditDialog>
  );
}
