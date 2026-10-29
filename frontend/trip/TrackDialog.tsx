import { createMemo, For } from 'solid-js';
import type { Route } from '../model/trip';
import { boundPointIds } from '../routing/dayEdit';
import { thinningTolerances } from '../routing/routeEdit';
import { ROUTING_MIN_INTERVAL_MS } from '../routing/valhalla';
import { setTrackAction, trackAction } from '../state/drawing';
import { condenseTrack, convertTrackToRoute, openTrip, routeById } from '../state/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import { durationText } from '../ui/format';
import { routeLabelOf } from './labels';

/** How far the line may move, in metres: for condensing a track, and for the points a route made of it keeps. */
const CONDENSE_TOLERANCES = [5, 10, 25, 50, 100];
const ROUTE_TOLERANCES = [50, 100, 250, 500, 1000];

const distance = (metres: number): string => (metres < 1000 ? `${metres} m` : `${metres / 1000} km`);

/**
 * Condenses a track's points, or makes a route of it, at a tolerance chosen with the count
 * of points it leaves; points that stops stand on are always kept.
 */
export function TrackDialog() {
  const route = createMemo((): Route | undefined => {
    const target = trackAction();
    return target ? routeById(target.routeId) : undefined;
  });
  const converting = () => trackAction()?.action === 'convert';
  const tolerances = createMemo(() => {
    const r = route();
    const day = r && openTrip()?.days.find((d) => d.routes.some((x) => x.id === r.id));
    return r && day ? thinningTolerances(r, boundPointIds(day)) : new Float64Array(0);
  });
  const count = (toleranceM: number) => tolerances().filter((t) => t > toleranceM).length;
  const option = (toleranceM: number) => {
    const points = count(toleranceM);
    const routing = converting() ? `, about ${durationText(Math.max(60, ((points - 1) * ROUTING_MIN_INTERVAL_MS) / 1000))} of routing` : '';
    return `${distance(toleranceM)}: ${points.toLocaleString()} points${routing}`;
  };
  const close = () => setTrackAction(undefined);
  const save = (form: FormData, r: Route) => (converting() ? convertTrackToRoute : condenseTrack)(r.id, Number(field(form, 'tolerance')));
  return (
    <EditDialog
      label={converting() ? 'Convert to route' : 'Condense points'}
      value={route()}
      title={(r) => `${converting() ? 'Convert to route' : 'Condense points'} · ${routeLabelOf(openTrip()!, r)}`}
      submit={converting() ? 'Convert' : 'Condense'}
      onClose={close}
      onSubmit={save}
    >
      {(r) => (
        <>
          <p class="muted">
            {converting()
              ? 'The route keeps a point where the track bends away by more than the distance chosen, and the routing follows the roads between them: the more points, the closer to the track.'
              : 'The track keeps the points that hold its line within the distance chosen.'}{' '}
            Points that stops stand on stay. The track has {r.points.length.toLocaleString()} points now.
          </p>
          <label>
            {converting() ? 'Keep a point where the track bends away by' : 'Keep the line within'}
            <select name="tolerance" value={converting() ? 250 : 10}>
              <For each={converting() ? ROUTE_TOLERANCES : CONDENSE_TOLERANCES}>{(t) => <option value={t}>{option(t)}</option>}</For>
            </select>
          </label>
        </>
      )}
    </EditDialog>
  );
}
