import { t } from '../i18n/t';
import { createEffect, createMemo, createSelector, createSignal, For, Match, on, onCleanup, onMount, Show, Switch } from 'solid-js';
import { changeTrip, errorMessage, fetchTrip, type DuplicateGroup, type DuplicateRoute } from '../api';
import { copiedRoute, removeRoute, type CopiedRoute } from '../routing/dayEdit';
import { copyRoutes } from '../state/clipboard';
import { comparedColor, DUPLICATES, duplicateGroups, duplicateKey, duplicatesMadeAt, duplicatesStartedAt, forgetDuplicates, refreshDuplicates } from '../state/duplicates';
import { fetchingTrip, libraryTrips, outlineOf, relistTrips, setShowingDuplicates } from '../state/library';
import { openTripId, removeParts, selectedDayId } from '../state/trip';
import { dayLabel } from '../trip/labels';
import { cardMenu } from '../ui/cardMenu';
import { IconButton } from '../ui/IconButton';
import { RefreshIcon } from '../ui/icons';
import { askConfirmation } from '../ui/confirm';
import { clockText, counted, distanceText } from '../ui/format';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { fileVerb } from '../ui/fileVerb';
import { clickRow, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, toggleRow, type Selection } from '../ui/selection';
import { SidePane } from '../ui/SidePane';
import { Pad } from '../ui/Pad';

/** Where a route of the report is: its trip, and its day by number, date and name, or its section. */
function whereText(route: DuplicateRoute): string {
  const day = route.tripKind === 'collection' ? route.dayName : dayLabel({ date: route.date, name: route.dayName }, route.dayIndex);
  return `${route.tripName} › ${day}`;
}

const nameOf = (route: DuplicateRoute): string => route.routeName || t('Unnamed route');

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

/** How far down the report was scrolled when it was last shown, to which it comes back. */
let scrolled = 0;

/**
 * The routes the library keeps more than once, in the pane between the library and the
 * map: exact copies, and the same ride kept from two sources on one day, but for a day's
 * plan beside its own recordings. The report is made once and kept, its heading says
 * when, and the button there makes it afresh. A click or a tap selects
 * a route, with Cmd or Ctrl one more, with Shift a run of them; its pad adds or takes it
 * away. The map draws what is selected, each route in a colour its row shows too, to
 * compare them. The menu opens the place of one, its day, whose pane takes the report's
 * place until the report is shown again, and copies or deletes the selected ones, as
 * Ctrl+C and Delete do. A day picked elsewhere takes the pane for itself.
 */
export function DuplicatesReport(props: { onOpen: (tripId: number, dayId: string) => void }) {
  const groups = duplicateGroups;
  /** The groups of the report; none where it failed, since reading a resource that failed throws. */
  const found = () => (groups.error ? undefined : groups());
  /** How many routes the library holds, which is how many the report compares. */
  const routeCount = () => (libraryTrips() ?? []).reduce((sum, trip) => sum + (outlineOf(trip.id) ?? []).reduce((routes, day) => routes + day.routes, 0), 0);
  /** The seconds the report has been in the making: the server answers only once it is done, so this is all there is to tell meanwhile. */
  const [now, setNow] = createSignal(Date.now());
  createEffect(() => {
    if (!groups.loading) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(timer));
  });
  const seconds = () => Math.max(0, Math.round((now() - duplicatesStartedAt()) / 1000));
  const of = (kind: DuplicateGroup['kind']) => (found() ?? []).filter((g) => g.kind === kind);
  const selection = () => selectionOf(DUPLICATES);
  const setSelection = (rows: Selection<string>) => selectIn(DUPLICATES, rows);
  onCleanup(() => setSelection(NOTHING_SELECTED));
  const [note, setNote] = createSignal<{ text: string; error: boolean }>();
  /** The routes in the order shown, by key; a route in a group of each kind is shown twice but listed once. */
  const shown = createMemo(() => new Map([...of('copies'), ...of('same ride')].flatMap((g) => g.routes).map((r) => [duplicateKey(r), r])));
  const isSelected = createSelector(selection, (key: string, keys) => keys.has(key));
  /** The selected routes, in the order shown. */
  const selectedRoutes = () => [...shown().values()].filter((r) => selection().has(duplicateKey(r)));
  /** Opens the trip of a route at the route's day, whose pane takes the report's place; the report is kept as it stands. */
  const openLocation = (route: DuplicateRoute) => {
    setShowingDuplicates(false);
    props.onOpen(route.tripId, route.dayId);
  };
  // A day picked elsewhere takes the pane too.
  createEffect(on(selectedDayId, (id) => id && setShowingDuplicates(false), { defer: true }));
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
    work(t('Copying…'), async () => {
      const copies = await copiesOf(chosen);
      if (copies.length === 0) return t('Those routes are no longer there.');
      copyRoutes(copies);
      return t('Copied {what}: paste from the menu of a day, a trip or a folder.', { what: counted(copies.length, 'route') });
    });
  const remove = async (chosen: DuplicateRoute[]) => {
    const trips = tripIdsOf(chosen).length;
    const question =
      chosen.length === 1
        ? t('Delete the route “{name}” from {where}?', { name: nameOf(chosen[0]!), where: whereText(chosen[0]!) })
        : t('Delete {n} routes from {trips}?', { n: chosen.length, trips: counted(trips, 'trip') });
    if (!(await askConfirmation(question, t('Delete')))) return;
    await work(t('Deleting…'), async () => {
      // The open trip loses its routes as an edit of it, saved with it and undone like any other; the other trips on the server.
      const inOpenTrip = chosen.filter((r) => r.tripId === openTripId());
      const elsewhere = chosen.filter((r) => r.tripId !== openTripId());
      if (inOpenTrip.length > 0) removeParts('route', inOpenTrip.map((r) => r.routeId));
      if (elsewhere.length > 0) {
        await removeRoutes(elsewhere);
        relistTrips();
      }
      setSelection(NOTHING_SELECTED);
      forgetDuplicates(chosen);
      return t('Deleted {what}.', { what: counted(chosen.length, 'route') });
    });
  };
  /** The menu of a route: for the selected routes, or for it alone where it is not selected. */
  const items = (route: DuplicateRoute): MenuItem[] => {
    setSelection(menuSelection(selection(), duplicateKey(route)));
    const chosen = selectedRoutes();
    const one = chosen.length === 1 ? chosen[0] : undefined;
    const n = chosen.length;
    return [
      ...(one ? [{ label: t('Open location'), disabled: fetchingTrip(), run: () => openLocation(one) }] : []),
      { label: one ? t('Copy') : t('Copy {n} routes', { n }), run: () => void copy(chosen) },
      { label: one ? t('Delete') : t('Delete {n} routes', { n }), run: () => void remove(chosen) },
    ];
  };
  const onKey = (e: KeyboardEvent) => {
    const verb = selection().size > 0 ? fileVerb(e) : undefined;
    if (verb !== 'copy' && verb !== 'delete') return;
    e.preventDefault();
    void (verb === 'copy' ? copy(selectedRoutes()) : remove(selectedRoutes()));
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));
  let details!: HTMLDivElement;
  // The pane comes back to where it was scrolled to, and keeps track of where it is.
  onMount(() => {
    const pane = details.closest<HTMLElement>('.side-pane')!;
    pane.scrollTop = scrolled;
    pane.addEventListener('scroll', () => (scrolled = pane.scrollTop));
  });
  const rows = {
    selected: (route: DuplicateRoute) => isSelected(duplicateKey(route)),
    // A click that does not select with a key held selects the route alone: that is what draws it on the map.
    onClick: (route: DuplicateRoute, e: MouseEvent) => clickRow(DUPLICATES, [...shown().keys()], duplicateKey(route), e) || setSelection(new Set([duplicateKey(route)])),
    onToggle: (route: DuplicateRoute) => toggleRow(DUPLICATES, duplicateKey(route)),
    items,
  };
  return (
    <SidePane
      label={t('Routes kept more than once')}
      onClose={() => setShowingDuplicates(false)}
      heading={
        <>
          <span class="lines grow">
            <span class="name">{t('Routes kept more than once')}</span>
            <Show when={found()}>
              {(made) => (
                <span class="muted detail">
                  {counted(made().length, 'group')} · {clockText(duplicatesMadeAt()!)}
                </span>
              )}
            </Show>
          </span>
          <IconButton label={t('Make the report afresh')} disabled={groups.loading} onClick={refreshDuplicates}>
            <RefreshIcon />
          </IconButton>
        </>
      }
    >
      <div class="day-details" ref={details}>
        <Switch>
          <Match when={groups.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Match>
          <Match when={groups.loading || !groups()}>
            <p class="muted row">
              <span class="spinner" />
              {t('Comparing {routes} with each other… {seconds} s', { routes: counted(routeCount(), 'route'), seconds: seconds() })}
            </p>
          </Match>
          <Match when={groups()?.length === 0}>
            <p class="muted">{t('No route is kept more than once.')}</p>
          </Match>
          <Match when={groups()}>
            <Show when={note()}>{(n) => <p classList={{ error: n().error, muted: !n().error, hint: true }}>{n().text}</p>}</Show>
            <Section title={t('Exact copies: {what}', { what: counted(of('copies').length, 'group') })} groups={of('copies')} {...rows} />
            <Section title={t('The same ride kept twice: {what}', { what: counted(of('same ride').length, 'group') })} groups={of('same ride')} {...rows} />
          </Match>
        </Switch>
      </div>
    </SidePane>
  );
}

/** Groups of duplicates under a heading, a card each, a row per route; none, no heading. */
function Section(props: {
  title: string;
  groups: DuplicateGroup[];
  selected: (route: DuplicateRoute) => boolean;
  onClick: (route: DuplicateRoute, e: MouseEvent) => void;
  onToggle: (route: DuplicateRoute) => void;
  items: (route: DuplicateRoute) => MenuItem[];
}) {
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
                        <Pad label={t('Select {name}', { name: nameOf(route) })} selected={props.selected(route)} onToggle={() => props.onToggle(route)} />
                        <button class="text grow" onClick={(e) => props.onClick(route, e)}>
                          <Show when={comparedColor(route)}>{(color) => <span class="swatch" style={{ background: color() }} />}</Show>
                          <span class="lines">
                            <span class="name">
                              {nameOf(route)} · {distanceText(route.distanceM)}
                            </span>
                            <span class="muted detail">{whereText(route)}</span>
                          </span>
                        </button>
                        <MenuButton of={nameOf(route)} items={() => props.items(route)} />
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
