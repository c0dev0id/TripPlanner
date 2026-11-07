import { plural, t } from '../i18n/t';
import { Show } from 'solid-js';
import { failedLegCount, lastError, pendingLegs, retryFailedLegs } from '../state/routing';

/** How the routing is getting on, over the map while legs are still being routed or failed to route. */
export function RoutingBar() {
  return (
    <Show when={pendingLegs() > 0 || failedLegCount() > 0}>
      <div class="routing-bar">
        <Show when={pendingLegs() > 0}>
          <span class="routing">{plural(pendingLegs(), 'Routing {n} leg…|Routing {n} legs…')}</span>
        </Show>
        <Show when={failedLegCount() > 0}>
          <span class="routing failed" title={lastError()}>
            {plural(failedLegCount(), '{n} leg not routed|{n} legs not routed')}
          </span>
          <button onClick={retryFailedLegs}>{t('Retry')}</button>
        </Show>
      </div>
    </Show>
  );
}
