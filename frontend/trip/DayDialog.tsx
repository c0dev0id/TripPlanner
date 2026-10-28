import { createMemo } from 'solid-js';
import type { Day } from '../model/trip';
import { editTarget, setEditTarget } from '../state/drawing';
import { openTrip, removeDay, updateDay } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import { dayLabelOf } from './labels';

/** A day: its name, date and notes; and its removal with everything on it. */
export function DayDialog() {
  const day = createMemo((): Day | undefined => {
    const target = editTarget();
    return target?.kind === 'day' ? openTrip()?.days.find((d) => d.id === target.id) : undefined;
  });
  const close = () => setEditTarget(undefined);
  const save = (form: FormData, d: Day) => updateDay(d.id, { name: field(form, 'name'), date: field(form, 'date') || null, notes: field(form, 'notes') });
  const remove = async (d: Day) => {
    const parts = d.routes.length + d.stops.length;
    if (parts > 0 && !(await askConfirmation(`Remove ${dayLabelOf(openTrip()!, d)} with its routes and stops?`, 'Remove'))) return;
    removeDay(d.id);
    close();
  };
  return (
    <EditDialog label="Day" value={day()} title={(d) => dayLabelOf(openTrip()!, d)} onClose={close} onSubmit={save} actions={(d) => [{ label: 'Remove', run: () => void remove(d), danger: true }]}>
      {(d) => (
        <>
          <label>
            Name
            <input name="name" value={d.name} maxlength={200} placeholder="Where the day goes" />
          </label>
          <label>
            Date
            <input type="date" name="date" value={d.date ?? ''} />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={4}>
              {d.notes}
            </textarea>
          </label>
        </>
      )}
    </EditDialog>
  );
}
