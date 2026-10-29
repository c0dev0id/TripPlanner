import { createMemo, For } from 'solid-js';
import type { Track } from '../model/trip';
import { thinningTolerances } from '../routing/routeEdit';
import { ROUTING_MIN_INTERVAL_MS } from '../routing/valhalla';
import { setTrackAction, trackAction } from '../state/drawing';
import { condenseTrack, convertTrackToRoute, openTrip, routeById } from '../state/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import { durationText } from '../ui/format';
import { routeLabelOf } from './labels';

/** The two things the dialog does with a track; `tolerances` are how far the line may move, in metres. */
const ACTIONS = {
  condense: {
    title: 'Condense points',
    submit: 'Condense',
    intro: 'The track keeps the points that hold its line within the distance chosen.',
    field: 'Keep the line within',
    tolerances: [5, 10, 25, 50, 100],
    initial: 10,
    run: condenseTrack,
  },
  convert: {
    title: 'Convert to route',
    submit: 'Convert',
    intro: 'The route keeps a point where the track bends away by more than the distance chosen, and the routing follows the roads between them: the more points, the closer to the track.',
    field: 'Keep a point where the track bends away by',
    tolerances: [50, 100, 250, 500, 1000],
    initial: 250,
    run: convertTrackToRoute,
  },
};

const distance = (metres: number): string => (metres < 1000 ? `${metres} m` : `${metres / 1000} km`);

/** Condenses a track's points, or makes a route of it, at a tolerance chosen with the count of points it leaves. */
export function TrackDialog() {
  const track = createMemo((): Track | undefined => {
    const target = trackAction();
    const route = target && routeById(target.routeId);
    return route?.kind === 'track' ? route : undefined;
  });
  const action = () => ACTIONS[trackAction()?.action ?? 'condense'];
  const tolerances = createMemo(() => {
    const t = track();
    return t ? thinningTolerances(t) : new Float64Array(0);
  });
  const option = (toleranceM: number) => {
    const points = tolerances().filter((t) => t > toleranceM).length;
    const routing = action() === ACTIONS.convert ? `, about ${durationText(Math.max(60, ((points - 1) * ROUTING_MIN_INTERVAL_MS) / 1000))} of routing` : '';
    return `${distance(toleranceM)}: ${points.toLocaleString()} points${routing}`;
  };
  return (
    <EditDialog
      label={action().title}
      value={track()}
      title={(r) => `${action().title} · ${routeLabelOf(openTrip()!, r)}`}
      submit={action().submit}
      onClose={() => setTrackAction(undefined)}
      onSubmit={(form, r) => action().run(r.id, Number(field(form, 'tolerance')))}
    >
      {() => (
        <>
          <p class="muted">
            {action().intro} The track has {tolerances().length.toLocaleString()} points now.
          </p>
          <label>
            {action().field}
            <select name="tolerance" value={action().initial}>
              <For each={action().tolerances}>{(t) => <option value={t}>{option(t)}</option>}</For>
            </select>
          </label>
        </>
      )}
    </EditDialog>
  );
}
