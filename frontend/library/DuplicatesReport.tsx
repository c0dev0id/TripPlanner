import { createResource, For, Match, Show, Switch } from 'solid-js';
import { errorMessage, listDuplicates, type DuplicateGroup, type DuplicateRoute } from '../api';
import { dayLabel } from '../trip/labels';
import { counted, distanceText } from '../ui/format';
import { BackIcon } from '../ui/icons';

/** Where a route of the report is: its trip, and its day by number, date and name, or its section. */
function whereText(route: DuplicateRoute): string {
  const day = route.tripKind === 'collection' ? route.dayName : dayLabel({ date: route.date, name: route.dayName }, route.dayIndex);
  return `${route.tripName} › ${day}`;
}

/**
 * The routes the library keeps more than once, made afresh each time it is shown: exact
 * copies, and the same ride kept from two sources on one day. A route opens its trip at
 * its day, where it can be removed.
 */
export function DuplicatesReport(props: { onOpen: (tripId: number, dayId: string) => void; onClose: () => void; disabled: boolean }) {
  const [groups] = createResource(listDuplicates);
  const of = (kind: DuplicateGroup['kind']) => (groups() ?? []).filter((g) => g.kind === kind);
  return (
    <>
      <div class="row">
        <button class="icon" title="Back to the trips" aria-label="Back to the trips" onClick={props.onClose}>
          <BackIcon />
        </button>
        <h2 class="grow">Duplicates</h2>
      </div>
      <Switch fallback={<p class="muted">Looking for routes kept more than once…</p>}>
        <Match when={groups.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Match>
        <Match when={groups()?.length === 0}>
          <p class="muted">No route is kept more than once.</p>
        </Match>
        <Match when={groups()}>
          <p class="muted hint">Open a route to remove the ones you do not need; the report is made afresh when you come back.</p>
          <Section title={`Exact copies: ${counted(of('copies').length, 'group')}`} groups={of('copies')} onOpen={props.onOpen} disabled={props.disabled} />
          <Section title={`The same ride kept twice: ${counted(of('same ride').length, 'group')}`} groups={of('same ride')} onOpen={props.onOpen} disabled={props.disabled} />
        </Match>
      </Switch>
    </>
  );
}

/** Groups of duplicates under a heading, a card each, a row per route; none, no heading. */
function Section(props: { title: string; groups: DuplicateGroup[]; onOpen: (tripId: number, dayId: string) => void; disabled: boolean }) {
  return (
    <Show when={props.groups.length > 0}>
      <h3>{props.title}</h3>
      <ul class="duplicates">
        <For each={props.groups}>
          {(group) => (
            <li class="card">
              <ul>
                <For each={group.routes}>
                  {(route) => (
                    <li>
                      <button class="text" disabled={props.disabled} onClick={() => props.onOpen(route.tripId, route.dayId)}>
                        <span class="lines">
                          <span class="name">
                            {route.routeName || 'Unnamed route'} · {distanceText(route.distanceM)}
                          </span>
                          <span class="muted detail">{whereText(route)}</span>
                        </span>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
