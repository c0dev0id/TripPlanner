import { createSignal } from 'solid-js';
import { autoname } from '../map/autoname';
import { dayOfRoute } from '../routing/dayEdit';
import { routePositions } from '../routing/legs';
import { openTrip, openTripId, routeById, updateRoute } from '../state/trip';
import { routeLabelOf } from './labels';

/** What the naming of a day's routes says under them: how far it is, then what came of it. */
const [note, setNote] = createSignal<{ dayId: string; text: string; errors: string[] }>();

export const routeNamesNote = (dayId: string) => (note()?.dayId === dayId ? note() : undefined);

let busy = false;

/**
 * Names routes and tracks of the open trip after where they begin and end, as rides are
 * named, each as an edit of the trip, and says under the routes of their day how far it
 * is and which it could not name. A route that is gone by its turn, or with its trip, is
 * passed over; while one naming runs, another is not started.
 */
export async function autonameRoutes(ids: readonly string[]): Promise<void> {
  const trip = openTrip();
  const dayId = trip && ids[0] !== undefined ? dayOfRoute(trip, ids[0])?.id : undefined;
  if (busy || !trip || dayId === undefined) return;
  busy = true;
  const still = (id: string) => (openTripId() === trip.id ? routeById(id) : undefined);
  const routes = ids.flatMap((id) => routeById(id) ?? []);
  const named = routes.map((route) => ({
    name: routeLabelOf(trip, route),
    line: () => routePositions(still(route.id) ?? route),
    rename: (name: string) => {
      if (still(route.id)) updateRoute(route.id, { name });
    },
  }));
  setNote({ dayId, ...(await autoname(named, 'route', (text) => setNote({ dayId, text, errors: [] }))) });
  busy = false;
}
