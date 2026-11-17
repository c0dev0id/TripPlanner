import { createEffect, For, on, onCleanup, onMount, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { TripSummary } from '../model/trip';
import { LIBRARY_TABS, TAB_NAMES, TREES, type LibraryTab } from '../model/library';
import { libraryProblem, libraryTab, libraryTrips, query, setQuery, showFolder } from '../state/library';
import { setShowingDuplicates, showingDuplicates } from '../state/pane';
import { folded } from '../state/panel';
import { openTripId, selectDay, takeUpRouteOf } from '../state/trip';
import { CollectionPanel } from '../trip/CollectionPanel';
import { IconButton } from '../ui/IconButton';
import { ActivityIcon, ArchiveIcon, CopyIcon, GearIcon, PinIcon, TripIcon } from '../ui/icons';
import { Settings } from '../settings/Settings';
import { Library } from './Library';
import { Rides } from './Rides';
import type { FoundRoute } from './search';

/** The icon before each tab's name; the settings' tab is its gear alone. */
const TAB_ICONS = { stash: ArchiveIcon, trips: TripIcon, places: PinIcon, recordings: ActivityIcon };

/** What the search says it looks through, in the tab shown. */
const searchText = (tab: Exclude<LibraryTab, 'settings'>): string => (tab === 'recordings' ? t('Search rides') : TREES[tab].search);

/** The library's tabs, one for each of its views and, as a gear, the settings: the head of its pane. */
export function LibraryTabs(props: { onTab: (tab: LibraryTab) => void }) {
  return (
    <div class="row library-tabs" role="tablist" aria-label={t('Library')}>
      <For each={LIBRARY_TABS}>
        {(tab) => (
          <button role="tab" classList={{ grow: tab !== 'settings' }} data-tab={tab} aria-selected={libraryTab() === tab} aria-label={TAB_NAMES[tab]} title={TAB_NAMES[tab]} onClick={() => props.onTab(tab)}>
            <Show
              when={tab === 'settings'}
              fallback={
                <>
                  {TAB_ICONS[tab as keyof typeof TAB_ICONS]()}
                  {TAB_NAMES[tab]}
                </>
              }
            >
              <GearIcon />
            </Show>
          </button>
        )}
      </For>
    </div>
  );
}

/**
 * The library's pane: its switches and search, a tab for each of its views (the
 * collections, the trips, the lists of places, the rides and, as a gear, the settings), the open trip's name
 * with the trip's own actions while its tab is the one shown and nothing in its place otherwise, and what the tab shown holds: a tree of folders and
 * trips, the open list's categories among them, or the rides. A tab only shows its view:
 * what is unfolded, marked and selected in the others stays, and how far each was
 * scrolled.
 */
export function Explorer(props: {
  /** Opens a trip, at a day and with a route of it taken up where they are given, and with `pane` the pane of its days. */
  onOpen: (id: number, dayId?: string, routeId?: string, pane?: boolean) => void;
  onLeave: () => Promise<void>;
  error: string | undefined;
}) {
  /** Opens a trip and makes its folder the one shown: a trip of the tree or the search, or one just made. */
  const openIn = (trip: TripSummary, dayId?: string, pane?: boolean) => {
    showFolder(trip.folderId);
    props.onOpen(trip.id, dayId, undefined, pane);
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
  /** The tab shown where it has a search, which the settings have not. */
  const searched = () => {
    const tab = libraryTab();
    return tab === 'settings' ? undefined : tab;
  };
  // The pane's body scrolls as a whole, so how far it was scrolled is kept for each tab and given back when the tab is shown again, and when the library folded away is brought back: folded, it holds nothing to scroll and stands at its top.
  let section!: HTMLElement;
  const scrolled: Partial<Record<LibraryTab, number>> = {};
  onMount(() => {
    const body = section.closest<HTMLElement>('.pane-body')!;
    const keep = () => {
      if (!folded('library')) scrolled[libraryTab()] = body.scrollTop;
    };
    body.addEventListener('scroll', keep, { passive: true });
    onCleanup(() => body.removeEventListener('scroll', keep));
    createEffect(on(libraryTab, (tab) => (body.scrollTop = scrolled[tab] ?? 0), { defer: true }));
    createEffect(on(() => folded('library'), (is) => !is && (body.scrollTop = scrolled[libraryTab()] ?? 0), { defer: true }));
  });
  return (
    <section class="explorer" ref={section}>
      <Show when={searched()}>
        {(tab) => (
          <div class="row search-row">
            <input class="search grow" type="search" placeholder={searchText(tab())} aria-label={searchText(tab())} value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
            {/* The duplicates report is of the routes of trips, so its switch stands with the trips. */}
            <Show when={tab() === 'trips'}>
              <IconButton label={t('Duplicate routes')} pressed={showingDuplicates()} onClick={() => setShowingDuplicates(!showingDuplicates())}>
                <CopyIcon />
              </IconButton>
            </Show>
          </div>
        )}
      </Show>
      <Show when={libraryProblem() ?? props.error}>{(message) => <p class="error">{message()}</p>}</Show>
      <Library onOpen={openIn} onOpenRoute={openRoute} onOpenFolder={openFolder} onLeave={props.onLeave}>
        <CollectionPanel />
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
