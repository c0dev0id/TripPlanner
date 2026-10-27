import { batch, createEffect, createMemo, createRoot, createSignal } from 'solid-js';
import { unwrap } from 'solid-js/store';
import type { Route, RoutedLeg } from '../model/trip';
import { errorMessage } from '../api';
import { legState, nextMissingLeg, routedLegs, routeLegs, type LegJob } from '../routing/legs';
import { fetchLeg, ROUTING_MIN_INTERVAL_MS } from '../routing/osrm';
import { createPump } from './pump';
import { clearDayLegs, openTrip, selectedDay, setRouteLeg } from './trip';

/** Routes every missing leg of the open trip, one request per 1.1 s, the selected day's first. */

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

/** Routes every leg of the selected day again, failed ones included. */
export function recalculateDay(): void {
  const day = selectedDay();
  if (!day) return;
  const keys = new Set(day.routes.flatMap((route) => routedLegs(unwrap(route)).map((leg) => leg.key)));
  batch(() => {
    setFailedLegs((failed) => new Set([...failed].filter((key) => !keys.has(key))));
    clearDayLegs();
  });
}

const pump = createPump<LegJob, RoutedLeg>({
  next: () => {
    const trip = unwrap(openTrip());
    if (!trip) return undefined;
    const preferred = new Set(selectedDay()?.routes.map((r) => r.id));
    return nextMissingLeg(
      trip.days.flatMap((day) => day.routes),
      failedLegs(),
      preferred,
    );
  },
  run: (job) => fetchLeg(job),
  onResult: (job, leg) => setRouteLeg(job.routeId, job.key, leg),
  onFailure: (job, error) => {
    setLastError(errorMessage(error));
    setFailedLegs((failed) => new Set(failed).add(job.key));
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  interval: ROUTING_MIN_INTERVAL_MS,
});

const service = createRoot(() => {
  // Of the legs the routes have now; a failed leg whose point moved is no longer counted.
  const counts = createMemo(() => {
    const failed = failedLegs();
    const count = { pending: 0, failed: 0 };
    for (const route of allRoutes()) {
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
