import { batch, createEffect, createMemo, createRoot, createSignal } from 'solid-js';
import type { Route, RoutedLeg } from '../model/trip';
import { errorMessage } from '../api';
import { legState, nextMissingLeg, routedLegs, routeLegs, type LegJob } from '../routing/legs';
import { fetchLeg } from '../routing/valhalla';
import { createPump } from './pump';
import { clearLegs, editingRouteId, openTrip, routeById, selectedDay, setRouteLeg } from './trip';

/** Routes every missing leg of the open trip, one request per 1.1 s, the edited route's first, then the selected day's. */

const [failedLegs, setFailedLegs] = createSignal<ReadonlySet<string>>(new Set());
const [lastError, setLastError] = createSignal<string>();

/** Keys of legs whose routing failed in this session (drawn as red dashed lines), and the last error. */
export { failedLegs, lastError };

/** Clears the failures so the pump tries those legs again. */
export function retryFailedLegs(): void {
  setLastError(undefined);
  setFailedLegs(new Set<string>());
}

const allRoutes = (): Route[] => (openTrip()?.days ?? []).flatMap((day) => day.routes);

/** Routes every leg of a route again, failed ones included. */
export function recalculateRoute(routeId: string): void {
  const route = routeById(routeId);
  if (!route) return;
  const keys = new Set(routedLegs(route).map((leg) => leg.key));
  batch(() => {
    setFailedLegs((failed) => new Set([...failed].filter((key) => !keys.has(key))));
    clearLegs(routeId);
  });
}

const pump = createPump<LegJob, RoutedLeg>({
  next: () => {
    const edited = editingRouteId();
    const preferred = new Set(edited ? [edited] : selectedDay()?.routes.map((r) => r.id));
    return nextMissingLeg(allRoutes(), failedLegs(), preferred);
  },
  run: (job) => fetchLeg(job),
  onResult: (job, leg) => setRouteLeg(job.routeId, job.key, leg),
  onFailure: (job, error) => {
    setLastError(errorMessage(error));
    setFailedLegs((failed) => new Set(failed).add(job.key));
  },
});

const service = createRoot(() => {
  // Of the legs the routes have now; a failed leg whose point moved is no longer counted.
  // The routes change less often than the trip: not with its stops, its days or a save.
  const routes = createMemo(allRoutes, [], { equals: (a, b) => a.length === b.length && a.every((r, i) => r === b[i]) });
  const counts = createMemo(() => {
    const failed = failedLegs();
    const count = { pending: 0, failed: 0 };
    for (const route of routes()) {
      for (const leg of routeLegs(route)) {
        const state = legState(route, leg, failed);
        if (state === 'pending' || state === 'failed') count[state]++;
      }
    }
    return count;
  });
  // Tracks route points, profiles, cached legs and failures; starts the pump when work appears.
  createEffect(() => {
    if (counts().pending > 0) void pump();
  });
  return { counts };
});

/** Number of legs still waiting for routing. */
export const pendingLegs = (): number => service.counts().pending;

/** Number of legs whose routing failed. */
export const failedLegCount = (): number => service.counts().failed;
