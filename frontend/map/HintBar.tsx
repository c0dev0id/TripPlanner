import { Show } from 'solid-js';
import { tool, TOOLS } from '../state/drawing';
import { failedLegCount, lastError, pendingLegs, retryFailedLegs } from '../state/routing';
import { selectedDay } from '../state/trip';

/** What the current tool does on the selected day, and how the routing is getting on. */
export function HintBar() {
  return (
    <Show when={selectedDay()}>
      <div class="hint-bar">
        <span>
          <strong>{TOOLS[tool()].label}</strong>: {TOOLS[tool()].hint}
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
    </Show>
  );
}
