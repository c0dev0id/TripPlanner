import { createEffect, For, on, onCleanup, onMount, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { TripSummary } from '../model/trip';
import { LIBRARY_TABS, libraryProblem, libraryTab, libraryTrips, openTree, query, setQuery, showFolder, TAB_NAMES, type LibraryTab } from '../state/library';
import { openTrip, openTripId, selectDay, takeUpRouteOf } from '../state/trip';
import { CollectionPanel } from '../trip/CollectionPanel';
import { SaveState } from '../trip/SaveStatus';
import { TripIcons, TripPanel } from '../trip/TripPanel';
import { IconButton } from '../ui/IconButton';
import { CloseIcon, GearIcon } from '../ui/icons';
import { Settings } from '../settings/Settings';
import { Library, type FoundRoute } from './Library';
import { LibraryActions } from './LibraryActions';
import { Rides } from './Rides';

/** What the search says it looks through, by the tab shown. */
const SEARCHES: Record<Exclude<LibraryTab, 'settings'>, string> = {
  stash: t('Search files, routes and tracks'),
  trips: t('Search trips, routes and tracks'),
  places: t('Search lists of places'),
  recordings: t('Search rides'),
};

/**
 * The library's pane: its switches and search, a tab for each of its views (the
 * collections, the trips, the lists of places, the rides and, as a gear, the settings), the open trip's name
 * with the trip's own actions while its tab is the one shown and nothing in its place otherwise, and what the tab shown holds: a tree of folders and
 * trips, the open trip's days among them, or the rides. A tab only shows its view:
 * what is unfolded, marked and selected in the others stays, and how far each was
 * scrolled.
 */
export function Explorer(props: {
  onOpen: (id: number, dayId?: string, routeId?: string) => void;
  onLeave: () => Promise<void>;
  /** Shows the tab the user picked, with what it had open. */
  onTab: (tab: LibraryTab) => void;
  error: string | undefined;
}) {
  /** Opens a trip and makes its folder the one shown: a trip of the tree or the search, or one just made. */
  const openIn = (trip: TripSummary, dayId?: string) => {
    showFolder(trip.folderId);
    props.onOpen(trip.id, dayId);
  };
  /** Shows a route the search found: its trip at its day, opened where another is open, with the route taken up. */
  const openRoute = (found: FoundRoute) => {
    showFolder(found.within.folderId);
    if (found.within.id === openTripId()) takeUpRouteOf(found.dayId, found.route.id);
    else props.onOpen(found.within.id, found.dayId, found.route.id);
  };
  /** Shows a folder the search found, leaving an open trip for it. */
  const openFolder = (id: number) => void props.onLeave().then(() => showFolder(id));
  /** Opens the day a ride is on, in the tree its trip is in. */
  const openDay = (tripId: number, dayId: string) => {
    const trip = libraryTrips()?.find((kept) => kept.id === tripId);
    if (trip) openIn(trip, dayId);
  };
  /** Shows a day in its pane, opening its trip where another is open, without leaving the tab shown. */
  const showDay = (tripId: number, dayId: string) => (tripId === openTripId() ? selectDay(dayId) : props.onOpen(tripId, dayId));
  /** The open trip where the tab shown is the one it is in, which its name and its actions then stand over; one not listed yet counts as in the tab shown. */
  /** The tab shown where it has a search, which the settings have not. */
  const searched = () => {
    const tab = libraryTab();
    return tab === 'settings' ? undefined : tab;
  };
  const headed = () => ((openTree() ?? libraryTab()) === libraryTab() ? openTrip() : undefined);
  // The panel scrolls as a whole, so how far it was scrolled is kept for each tab and given back when the tab is shown again.
  let section!: HTMLElement;
  const scrolled: Partial<Record<LibraryTab, number>> = {};
  onMount(() => {
    const panel = section.closest<HTMLElement>('.panel')!;
    const keep = () => (scrolled[libraryTab()] = panel.scrollTop);
    panel.addEventListener('scroll', keep, { passive: true });
    onCleanup(() => panel.removeEventListener('scroll', keep));
    createEffect(on(libraryTab, (tab) => (panel.scrollTop = scrolled[tab] ?? 0), { defer: true }));
  });
  return (
    <section class="explorer" ref={section}>
      <LibraryActions />
      <Show when={searched()}>
        {(tab) => <input class="search" type="search" placeholder={SEARCHES[tab()]} aria-label={SEARCHES[tab()]} value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />}
      </Show>
      <div class="row library-tabs" role="tablist" aria-label={t('Library')}>
        <For each={LIBRARY_TABS}>
          {(tab) => (
            <button role="tab" classList={{ grow: tab !== 'settings' }} data-tab={tab} aria-selected={libraryTab() === tab} aria-label={TAB_NAMES[tab]} title={TAB_NAMES[tab]} onClick={() => props.onTab(tab)}>
              <Show when={tab === 'settings'} fallback={TAB_NAMES[tab]}>
                <GearIcon />
              </Show>
            </button>
          )}
        </For>
      </div>
      <Show when={headed()}>
        {(trip) => (
          <div class="row explorer-heading">
            <h2 class="path grow" title={trip().name}>
              {trip().name}
            </h2>
            <Show when={trip().kind === 'trip'}>
              <TripIcons />
            </Show>
            <SaveState />
            <IconButton label={t('Close {what}', { what: trip().name })} onClick={() => void props.onLeave()}>
              <CloseIcon />
            </IconButton>
          </div>
        )}
      </Show>
      <Show when={libraryProblem() ?? props.error}>{(message) => <p class="error">{message()}</p>}</Show>
      <Library onOpen={openIn} onOpenRoute={openRoute} onOpenFolder={openFolder} onLeave={props.onLeave}>
        <Show when={openTrip()?.kind === 'collection'} fallback={<TripPanel />}>
          <CollectionPanel />
        </Show>
      </Library>
      <div hidden={libraryTab() !== 'recordings'}>
        <Rides onOpen={openDay} onShow={showDay} />
      </div>
      <Show when={libraryTab() === 'settings'}>
        <Settings />
      </Show>
    </section>
  );
}
