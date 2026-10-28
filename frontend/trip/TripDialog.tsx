import { createMemo } from 'solid-js';
import type { Trip } from '../model/trip';
import { editTarget, setEditTarget } from '../state/drawing';
import { openTrip, updateTrip } from '../state/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';

/** The trip: its name, description, and whether it has been ridden. */
export function TripDialog() {
  const trip = createMemo((): Trip | undefined => (editTarget()?.kind === 'trip' ? openTrip() : undefined));
  const save = (form: FormData, t: Trip) => updateTrip({ name: field(form, 'name') || t.name, description: field(form, 'description'), state: form.get('done') === 'on' ? 'done' : 'planned' });
  return (
    <EditDialog label="Trip" value={trip()} title={() => 'Trip'} onClose={() => setEditTarget(undefined)} onSubmit={save}>
      {(t) => (
        <>
          <label>
            Name
            <input name="name" value={t.name} maxlength={200} required />
          </label>
          <label>
            Description
            <textarea name="description" rows={4}>
              {t.description}
            </textarea>
          </label>
          <label class="toggle">
            <input type="checkbox" name="done" checked={t.state === 'done'} /> Done: the trip has been ridden
          </label>
        </>
      )}
    </EditDialog>
  );
}
