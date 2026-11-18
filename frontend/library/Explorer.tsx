import { createEffect, For, on, onCleanup, onMount, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { TripSummary } from '../model/trip';
import { LIBRARY_TABS, TAB_NAMES, TREES, type LibraryTab } from '../model/library';
import { TagFilter } from './TagChips';
import { libraryProblem, libraryTab, libraryTrips, query, setQuery, showFolder } from '../state/library';
import { setShowingDuplicates, showingDuplicates } from '../state/pane';
import { folded } from '../state/panel';
import { lookAt, openTrip, openTripId, takeUpRouteOf, type OpenAt } from '../state/trip';
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
 * What the library's pane holds under its tabs (`LibraryTabs`, in the pane's head): the
 * search of the tab shown and what that tab holds, a tree of folders and trips, the open
 * list's categories among them, the rides or the settings. A tab only shows its view:
 * what is unfolded, marked and selected in the others stays, and how far each was
 * scrolled.
 */
export function Explorer(props: {
  /** Opens a trip, at the days and with the route `at` names. */
  onOpen: (id: number, at?: OpenAt) => void;
  /** Looks at a trip, or at a day of it, without opening it. */
  onLook: (id: number, dayId?: string) => void;
  /** Leaves the open trip, saved, with `look` kept on the map; false where its save failed. */
  onLeave: (look?: boolean) => Promise<boolean>;
  error: string | undefined;
}) {
  /** Opens a trip and makes its folder the one shown: a trip of the tree or the search, or one just made. */
  const openIn = (trip: TripSummary, at?: OpenAt) => {
    showFolder(trip.folderId);
    props.onOpen(trip.id, at);
  };
  /** Looks at a trip of the tree or the search, whose folder becomes the one shown. */
  const lookIn = (trip: TripSummary) => {
    showFolder(trip.folderId);
    props.onLook(trip.id);
  };
  /** Shows a route the search found: taken up where its trip is the open one, its day of a trip looked at otherwise; a list of places opens, as its row does. */
  const openRoute = (found: FoundRoute) => {
    showFolder(found.within.folderId);
    if (found.within.id === openTripId()) takeUpRouteOf(found.dayId, found.route.id);
    else if (found.within.kind === 'trip') props.onLook(found.within.id, found.dayId);
    else props.onOpen(found.within.id, { dayId: found.dayId, routeId: found.route.id });
  };
  /** Opens the day a ride is on, in the tree its trip is in. */
  const openDay = (tripId: number, dayId: string) => {
    const trip = libraryTrips()?.find((kept) => kept.id === tripId);
    if (trip) openIn(trip, { dayId });
  };
  /** Shows a day on the map beside the rides, without leaving their tab or opening its trip: a look at it, of the open trip as it stands. */
  const showDay = (tripId: number, dayId: string) => (tripId === openTripId() ? lookAt(openTrip()!, dayId) : props.onLook(tripId, dayId));
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
      <Show when={libraryTab() === 'trips'}>
        <TagFilter />
      </Show>
      <Show when={libraryProblem() ?? props.error}>{(message) => <p class="error">{message()}</p>}</Show>
      <Library onOpen={openIn} onLook={lookIn} onOpenRoute={openRoute} onLeave={props.onLeave}>
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
