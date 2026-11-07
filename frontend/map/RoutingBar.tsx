import { Show } from 'solid-js';
import { failedLegCount, lastError, pendingLegs, retryFailedLegs } from '../state/routing';

/** How the routing is getting on, over the map while legs are still being routed or failed to route. */
export function RoutingBar() {
  return (
    <Show when={pendingLegs() > 0 || failedLegCount() > 0}>
      <div class="routing-bar">
        <Show when={pendingLegs() > 0}>
          <span class="routing">Routing {pendingLegs()} {pendingLegs() === 1 ? 'leg' : 'legs'}…</span>
        </Show>
        <Show when={failedLegCount() > 0}>
          <span class="routing failed" title={lastError()}>
            {failedLegCount()} {failedLegCount() === 1 ? 'leg' : 'legs'} not routed
          </span>
          <button onClick={retryFailedLegs}>Retry</button>
        </Show>
      </div>
    </Show>
  );
}
