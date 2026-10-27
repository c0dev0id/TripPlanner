import { Show } from 'solid-js';
import { tool, type Tool } from '../state/drawing';
import { failedLegCount, lastError, pendingLegs, retryFailedLegs } from '../state/routing';
import { selectedDay } from '../state/trip';

const HINTS: Record<Tool, string> = {
  stop: 'tap the map to add a stop at the end of the day, or tap a route to add one there; drag stops and points to move them.',
  point: 'tap a route to insert a point there.',
  delete: 'tap a stop or a point to delete it.',
};

/** What the current tool does on the selected day, and how the routing is getting on. */
export function HintBar() {
  return (
    <Show when={selectedDay()}>
      <div class="hint-bar">
        <span>
          <strong>{tool() === 'stop' ? 'Stop' : tool() === 'point' ? 'Point' : 'Delete'}</strong>: {HINTS[tool()]}
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
