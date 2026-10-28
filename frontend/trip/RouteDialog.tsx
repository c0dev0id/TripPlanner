import { createMemo, For, Show } from 'solid-js';
import { HIGHWAYS, PROFILES, takesMotorwayDial, type Highways, type Profile, type Route } from '../model/trip';
import { editing, setEditing } from '../state/drawing';
import { openTrip, removeRoute, updateRoute } from '../state/trip';
import { askConfirmation } from '../ui/confirm';
import { EditDialog, field } from '../ui/EditDialog';
import { routeLabel } from './labels';

/** A route: its name, profile, motorway dial and whether it is optional; and its removal. */
export function RouteDialog() {
  const route = createMemo((): { route: Route; label: string } | undefined => {
    const target = editing();
    if (target?.kind !== 'route') return undefined;
    for (const day of openTrip()?.days ?? []) {
      const found = day.routes.find((r) => r.id === target.id);
      if (found) return { route: found, label: routeLabel(found, day) };
    }
    return undefined;
  });
  const close = () => setEditing(undefined);
  const save = (form: FormData) => {
    const r = route()!.route;
    updateRoute(r.id, {
      name: field(form, 'name'),
      profile: field(form, 'profile') as Profile,
      highways: (field(form, 'highways') || r.highways) as Highways,
      optional: form.get('optional') === 'on',
    });
    close();
  };
  const remove = async () => {
    const { route: r, label } = route()!;
    if (r.points.length > 0 && !(await askConfirmation(`Remove ${label} with its ${r.points.length} points?`, 'Remove'))) return;
    removeRoute(r.id);
    close();
  };
  return (
    <EditDialog label="Route" title={route()?.label ?? ''} open={route() !== undefined} onClose={close} onSubmit={save} actions={[{ label: 'Remove', run: () => void remove(), danger: true }]}>
      <Show when={route()} keyed>
        {({ route: r }) => (
          <>
            <label>
              Name
              <input name="name" value={r.name} maxlength={200} placeholder={route()!.label} />
            </label>
            <label>
              Travelled as
              <select name="profile" value={r.profile}>
                <For each={PROFILES}>{(profile) => <option value={profile.value}>{profile.label}</option>}</For>
              </select>
            </label>
            <Show when={takesMotorwayDial(r.profile)}>
              <label>
                Motorways
                <select name="highways" value={r.highways}>
                  <For each={HIGHWAYS}>{(choice) => <option value={choice.value}>{choice.label}</option>}</For>
                </select>
              </label>
            </Show>
            <label class="toggle">
              <input type="checkbox" name="optional" checked={r.optional} /> Optional: a route to decide on the day, left out of an export on request
            </label>
          </>
        )}
      </Show>
    </EditDialog>
  );
}
