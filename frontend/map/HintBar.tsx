import { Show } from 'solid-js';
import { tool, TOOLS } from '../state/drawing';
import { failedLegCount, lastError, pendingLegs, retryFailedLegs } from '../state/routing';
import { editingRoute, selectedDay } from '../state/trip';
import { routeLabel } from '../trip/labels';

/** What the current tool does on the route being edited, and how the routing is getting on. */
export function HintBar() {
  return (
    <Show when={editingRoute()}>
      {(route) => (
        <div class="hint-bar">
          <span>
            <strong>{routeLabel(route(), selectedDay()!)}</strong> · {TOOLS[tool()].label}: {TOOLS[tool()].hint}
          </span>
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
      )}
    </Show>
  );
}
