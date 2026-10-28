import { Show } from 'solid-js';
import { editing, setEditing } from '../state/drawing';
import { openTrip, updateTrip } from '../state/trip';
import { EditDialog, field } from '../ui/EditDialog';

/** The trip: its name, description, and whether it has been ridden. */
export function TripDialog() {
  const open = () => editing()?.kind === 'trip' && openTrip() !== undefined;
  const close = () => setEditing(undefined);
  const save = (form: FormData) => {
    updateTrip({
      name: field(form, 'name') || openTrip()!.name,
      description: field(form, 'description'),
      state: form.get('done') === 'on' ? 'done' : 'planned',
    });
    close();
  };
  return (
    <EditDialog label="Trip" title="Trip" open={open()} onClose={close} onSubmit={save}>
      <Show when={open() && openTrip()} keyed>
        {(trip) => (
          <>
            <label>
              Name
              <input name="name" value={trip.name} maxlength={200} required />
            </label>
            <label>
              Description
              <textarea name="description" rows={4}>
                {trip.description}
              </textarea>
            </label>
            <label class="toggle">
              <input type="checkbox" name="done" checked={trip.state === 'done'} /> Done: the trip has been ridden
            </label>
          </>
        )}
      </Show>
    </EditDialog>
  );
}
