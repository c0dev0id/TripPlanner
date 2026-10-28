import { createMemo, Show } from 'solid-js';
import type { Day } from '../model/trip';
import { editing, setEditing } from '../state/drawing';
import { openTrip, removeDay, updateDay } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { EditDialog, field } from '../ui/EditDialog';
import { dayLabel } from './labels';

/** A day: its name, date and notes; and its removal with everything on it. */
export function DayDialog() {
  const day = createMemo((): { day: Day; index: number } | undefined => {
    const target = editing();
    const days = openTrip()?.days ?? [];
    const index = target?.kind === 'day' ? days.findIndex((d) => d.id === target.id) : -1;
    return index < 0 ? undefined : { day: days[index]!, index };
  });
  const close = () => setEditing(undefined);
  const save = (form: FormData) => {
    updateDay(day()!.day.id, {
      name: field(form, 'name'),
      date: field(form, 'date') || null,
      notes: field(form, 'notes'),
    });
    close();
  };
  const remove = async () => {
    const { day: d, index } = day()!;
    const parts = d.routes.length + d.stops.length;
    if (parts > 0 && !(await askConfirmation(`Remove ${dayLabel(d, index)} with its routes and stops?`, 'Remove'))) return;
    removeDay(d.id);
    close();
  };
  return (
    <EditDialog label="Day" title={day() ? dayLabel(day()!.day, day()!.index) : ''} open={day() !== undefined} onClose={close} onSubmit={save} actions={[{ label: 'Remove', run: () => void remove(), danger: true }]}>
      <Show when={day()} keyed>
        {({ day: d }) => (
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
      </Show>
    </EditDialog>
  );
}
