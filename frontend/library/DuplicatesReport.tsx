import { createMemo, createResource, createSelector, createSignal, For, Match, Show, Switch } from 'solid-js';
import { changeTrip, errorMessage, fetchTrip, listDuplicates, type DuplicateGroup, type DuplicateRoute } from '../api';
import { copiedRoute, removeRoute, type CopiedRoute } from '../routing/dayEdit';
import { copyRoutes } from '../state/clipboard';
import { dayLabel } from '../trip/labels';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { counted, distanceText } from '../ui/format';
import { BackIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { clickSelect, menuSelection, NOTHING_SELECTED, toggled, type Selection } from '../ui/selection';
import { SelectPad } from '../ui/SelectPad';

/** Where a route of the report is: its trip, and its day by number, date and name, or its section. */
function whereText(route: DuplicateRoute): string {
  const day = route.tripKind === 'collection' ? route.dayName : dayLabel({ date: route.date, name: route.dayName }, route.dayIndex);
  return `${route.tripName} › ${day}`;
}

const keyOf = (route: DuplicateRoute): string => `${route.tripId}/${route.routeId}`;
const nameOf = (route: DuplicateRoute): string => route.routeName || 'Unnamed route';

const tripIdsOf = (routes: readonly DuplicateRoute[]): number[] => [...new Set(routes.map((r) => r.tripId))];

/** The routes as copies to paste, with the stops bound to them; a route gone from its trip since the report was made is left out. */
async function copiesOf(routes: readonly DuplicateRoute[]): Promise<CopiedRoute[]> {
  const trips = new Map(await Promise.all(tripIdsOf(routes).map(async (id) => [id, await fetchTrip(id)] as const)));
  return routes.flatMap((r) => {
    const day = trips.get(r.tripId)!.days.find((d) => d.id === r.dayId);
    const route = day?.routes.find((x) => x.id === r.routeId);
    return day && route ? [copiedRoute(day, route)] : [];
  });
}

/** Removes the routes from their trips, each trip changed once, side by side; the stops bound to them stay, free. */
async function removeRoutes(routes: readonly DuplicateRoute[]): Promise<void> {
  await Promise.all(tripIdsOf(routes).map((id) => changeTrip(id, (trip) => routes.filter((r) => r.tripId === id).reduce((t, r) => removeRoute(t, r.dayId, r.routeId), trip))));
}

/**
 * The routes the library keeps more than once, made afresh each time it is shown: exact
 * copies, and the same ride kept from two sources on one day. A click selects a route,
 * with Cmd or Ctrl one more, with Shift a run of them; its pad adds or takes it away. On a
 * touch screen a tap opens the route instead. The menu opens one, and copies or deletes
 * the selected ones.
 */
export function DuplicatesReport(props: { onOpen: (tripId: number, dayId: string) => void; onClose: () => void; disabled: boolean }) {
  const [groups, { refetch }] = createResource(listDuplicates);
  const of = (kind: DuplicateGroup['kind']) => (groups() ?? []).filter((g) => g.kind === kind);
  const [selection, setSelection] = createSignal<Selection<string>>(NOTHING_SELECTED);
  const [note, setNote] = createSignal<{ text: string; error: boolean }>();
  /** The routes in the order shown, by key; a route in a group of each kind is shown twice but listed once. */
  const shown = createMemo(() => new Map([...of('copies'), ...of('same ride')].flatMap((g) => g.routes).map((r) => [keyOf(r), r])));
  const isSelected = createSelector(() => selection().keys, (key: string, keys) => keys.has(key));
  const open = (route: DuplicateRoute) => {
    if (!props.disabled) props.onOpen(route.tripId, route.dayId);
  };
  /** Runs a job that reads and writes trips, saying what it is doing and then what it did or why it failed. */
  const work = async (doing: string, job: () => Promise<string>) => {
    setNote({ text: doing, error: false });
    try {
      setNote({ text: await job(), error: false });
    } catch (error) {
      setNote({ text: errorMessage(error), error: true });
    }
  };
  const copy = (chosen: DuplicateRoute[]) =>
    work('Copying…', async () => {
      const copies = await copiesOf(chosen);
      if (copies.length === 0) return 'Those routes are no longer there.';
      copyRoutes(copies);
      return `Copied ${counted(copies.length, 'route')}: paste from the menu of a day, a trip or a folder.`;
    });
  const remove = async (chosen: DuplicateRoute[]) => {
    const trips = new Set(chosen.map((r) => r.tripId)).size;
    const question = chosen.length === 1 ? `Delete the route “${nameOf(chosen[0]!)}” from ${whereText(chosen[0]!)}?` : `Delete ${chosen.length} routes from ${counted(trips, 'trip')}?`;
    if (!(await askConfirmation(question, 'Delete'))) return;
    await work('Deleting…', async () => {
      await removeRoutes(chosen);
      setSelection(NOTHING_SELECTED);
      void refetch();
      return `Deleted ${counted(chosen.length, 'route')}.`;
    });
  };
  /** The menu of a route: for the selected routes, or for it alone where it is not selected. */
  const items = (route: DuplicateRoute): MenuItem[] => {
    setSelection((s) => menuSelection(s, keyOf(route)));
    const chosen = [...shown().values()].filter((r) => selection().keys.has(keyOf(r)));
    const one = chosen.length === 1 ? chosen[0] : undefined;
    const many = one ? '' : ` ${chosen.length} routes`;
    return [
      ...(one ? [{ label: 'Open', disabled: props.disabled, run: () => open(one) }] : []),
      { label: `Copy${many}`, run: () => void copy(chosen) },
      { label: `Delete${many}`, run: () => void remove(chosen) },
    ];
  };
  const rows = {
    selected: (route: DuplicateRoute) => isSelected(keyOf(route)),
    onClick: (route: DuplicateRoute, e: MouseEvent) => setSelection((s) => clickSelect(s, [...shown().keys()], keyOf(route), e)),
    onToggle: (route: DuplicateRoute) => setSelection((s) => toggled(s, keyOf(route))),
    onOpen: open,
    items,
  };
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
          <p class="muted hint">Click a route or its pad to select it, with Cmd or Ctrl one more, with Shift a run of them; on a touch screen tap the pad. Their menu opens, copies or deletes them.</p>
          <Show when={note()}>{(n) => <p classList={{ error: n().error, muted: !n().error, hint: true }}>{n().text}</p>}</Show>
          <Section title={`Exact copies: ${counted(of('copies').length, 'group')}`} groups={of('copies')} {...rows} />
          <Section title={`The same ride kept twice: ${counted(of('same ride').length, 'group')}`} groups={of('same ride')} {...rows} />
        </Match>
      </Switch>
    </>
  );
}

/** Groups of duplicates under a heading, a card each, a row per route; none, no heading. */
function Section(props: {
  title: string;
  groups: DuplicateGroup[];
  selected: (route: DuplicateRoute) => boolean;
  onClick: (route: DuplicateRoute, e: MouseEvent) => void;
  onToggle: (route: DuplicateRoute) => void;
  onOpen: (route: DuplicateRoute) => void;
  items: (route: DuplicateRoute) => MenuItem[];
}) {
  /** What pressed a row last: a mouse click selects, a tap opens. */
  let pointer = 'mouse';
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
                    <li classList={{ selected: props.selected(route) }} ref={(el) => cardMenu(el, () => props.items(route))}>
                      <div class="row">
                        <SelectPad selected={props.selected(route)} name={nameOf(route)} onToggle={() => props.onToggle(route)} />
                        <button
                          class="text grow"
                          onPointerDown={(e) => (pointer = e.pointerType)}
                          onClick={(e) => (pointer === 'mouse' ? props.onClick(route, e) : props.onOpen(route))}
                        >
                          <span class="lines">
                            <span class="name">
                              {nameOf(route)} · {distanceText(route.distanceM)}
                            </span>
                            <span class="muted detail">{whereText(route)}</span>
                          </span>
                        </button>
                      </div>
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
