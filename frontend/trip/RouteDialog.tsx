import { createMemo, For, Show } from 'solid-js';
import { HIGHWAYS, PROFILES, takesMotorwayDial, type Highways, type Profile, type Route } from '../model/trip';
import { editTarget, setEditTarget } from '../state/drawing';
import { openTrip, routeById, updateRoute } from '../state/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import { routeLabelOf } from './labels';
import { removeRouteAsked } from './remove';

/** A route: its name, profile, motorway dial and whether it is optional; and its removal. */
export function RouteDialog() {
  const route = createMemo((): Route | undefined => {
    const target = editTarget();
    return target?.kind === 'route' ? routeById(target.id) : undefined;
  });
  const label = (r: Route) => routeLabelOf(openTrip()!, r);
  const close = () => setEditTarget(undefined);
  const save = (form: FormData, r: Route) =>
    updateRoute(r.id, {
      name: field(form, 'name'),
      profile: field(form, 'profile') as Profile,
      highways: (field(form, 'highways') || r.highways) as Highways,
      optional: form.get('optional') === 'on',
    });
  const remove = async (r: Route) => {
    if (await removeRouteAsked(r)) close();
  };
  return (
    <EditDialog label="Route" value={route()} title={label} onClose={close} onSubmit={save} actions={(r) => [{ label: 'Remove', run: () => void remove(r), danger: true }]}>
      {(r) => (
        <>
          <label>
            Name
            <input name="name" value={r.name} maxlength={200} placeholder={label({ ...r, name: '' })} />
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
    </EditDialog>
  );
}
