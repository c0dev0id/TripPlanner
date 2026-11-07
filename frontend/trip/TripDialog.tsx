import { t } from '../i18n/t';
import { createMemo } from 'solid-js';
import type { Trip } from '../model/trip';
import { editTarget, setEditTarget } from '../state/drawing';
import { openTrip, updateTrip } from '../state/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';

/** The trip: its name, description, and whether it has been ridden. */
export function TripDialog() {
  const trip = createMemo((): Trip | undefined => (editTarget()?.kind === 'trip' ? openTrip() : undefined));
  const save = (form: FormData, item: Trip) => updateTrip({ name: field(form, 'name') || item.name, description: field(form, 'description'), state: form.get('done') === 'on' ? 'done' : 'planned' });
  return (
    <EditDialog label={t('Trip')} value={trip()} title={() => t('Trip')} onClose={() => setEditTarget(undefined)} onSubmit={save}>
      {(item) => (
        <>
          <label>
            {t('Name')}
            <input name="name" value={item.name} maxlength={200} required />
          </label>
          <label>
            {t('Description')}
            <textarea name="description" rows={4}>
              {item.description}
            </textarea>
          </label>
          <label class="toggle">
            <input type="checkbox" name="done" checked={item.state === 'done'} /> {t('Done: the trip has been ridden')}
          </label>
        </>
      )}
    </EditDialog>
  );
}
