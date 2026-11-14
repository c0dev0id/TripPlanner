import { createEffect, For, on, onCleanup, onMount, Show } from 'solid-js';
import { t } from '../i18n/t';
import { PlacesList } from '../map/PlacesList';
import type { TripSummary } from '../model/trip';
import { LIBRARY_TABS, libraryProblem, libraryTab, libraryTrips, query, setQuery, showFolder, showTab, TAB_NAMES, type LibraryTab } from '../state/library';
import { openTrip } from '../state/trip';
import { CollectionPanel } from '../trip/CollectionPanel';
import { SaveState } from '../trip/SaveStatus';
import { TripIcons, TripPanel } from '../trip/TripPanel';
import { IconButton } from '../ui/IconButton';
import { CloseIcon } from '../ui/icons';
import { Library } from './Library';
import { LibraryActions } from './LibraryActions';
import { Rides } from './Rides';

/** The explorer's own name, its heading at the top of the library. */
const EXPLORER = t('Trip Explorer');

/**
 * The library's pane: its switches and search, a tab for each of its views (the
 * collections, the trips, the lists of places and the rides), the open trip's name
 * with the trip's own actions, and what the tab shown holds: a tree of folders and
 * trips, the open trip's days among them, or the rides. A tab only shows its view:
 * what is unfolded, marked and selected in the others stays, and how far each was
 * scrolled.
 */
export function Explorer(props: { onOpen: (id: number, dayId?: string) => void; onLeave: () => Promise<void>; error: string | undefined }) {
  /** Opens a trip and makes its folder the one shown: a trip of the tree or the search, or one just made. */
  const openIn = (trip: TripSummary, dayId?: string) => {
    showFolder(trip.folderId);
    props.onOpen(trip.id, dayId);
  };
  /** Shows a folder the search found, leaving an open trip for it. */
  const openFolder = (id: number) => void props.onLeave().then(() => showFolder(id));
  /** Opens the day a ride is on, in the tree its trip is in. */
  const openDay = (tripId: number, dayId: string) => {
    const trip = libraryTrips()?.find((kept) => kept.id === tripId);
    if (trip) openIn(trip, dayId);
  };
  /** Shows a tab, which ends a search: what it found stood in the tabs' place. */
  const switchTo = (tab: LibraryTab) => {
    showTab(tab);
    setQuery('');
  };
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
      <PlacesList />
      <input class="search" type="search" placeholder={t('Search trips and folders')} aria-label={t('Search trips and folders')} value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
      <div class="row library-tabs" role="tablist" aria-label={t('Library')}>
        <For each={LIBRARY_TABS}>
          {(tab) => (
            <button role="tab" class="grow" data-tab={tab} aria-selected={libraryTab() === tab} onClick={() => switchTo(tab)}>
              {TAB_NAMES[tab]}
            </button>
          )}
        </For>
      </div>
      <div class="row explorer-heading">
        <h2 class="path grow" title={openTrip()?.name ?? EXPLORER}>
          {openTrip()?.name ?? EXPLORER}
        </h2>
        <Show when={openTrip()}>
          {(trip) => (
            <>
              <Show when={trip().kind === 'trip'}>
                <TripIcons />
              </Show>
              <SaveState />
              <IconButton label={t('Close {what}', { what: trip().name })} onClick={() => void props.onLeave()}>
                <CloseIcon />
              </IconButton>
            </>
          )}
        </Show>
      </div>
      <Show when={libraryProblem() ?? props.error}>{(message) => <p class="error">{message()}</p>}</Show>
      <Library onOpen={openIn} onOpenFolder={openFolder} onLeave={props.onLeave}>
        <Show when={openTrip()?.kind === 'collection'} fallback={<TripPanel />}>
          <CollectionPanel />
        </Show>
      </Library>
      <div hidden={libraryTab() !== 'recordings' || query().trim() !== ''}>
        <Rides onOpen={openDay} />
      </div>
    </section>
  );
}
