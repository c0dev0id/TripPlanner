import { Show } from 'solid-js';
import { t } from '../i18n/t';
import { PlacesList } from '../map/PlacesList';
import type { TripSummary } from '../model/trip';
import { libraryProblem, query, setQuery, showFolder } from '../state/library';
import { openTrip } from '../state/trip';
import { CollectionPanel } from '../trip/CollectionPanel';
import { SaveState } from '../trip/SaveStatus';
import { TripIcons, TripPanel } from '../trip/TripPanel';
import { IconButton } from '../ui/IconButton';
import { CloseIcon } from '../ui/icons';
import { Library } from './Library';
import { LibraryActions } from './LibraryActions';

/** The explorer's own name, its heading at the top of the library. */
const EXPLORER = t('Trip Explorer');

/**
 * The library's pane: its switches and search, the open trip's name with the trip's own
 * actions, and the tree of folders and trips, the open trip's days among them.
 */
export function Explorer(props: { onOpen: (id: number, dayId?: string) => void; onLeave: () => Promise<void>; error: string | undefined }) {
  /** Opens a trip and makes its folder the one shown: a trip of the tree or the search, or one just made. */
  const openIn = (trip: TripSummary, dayId?: string) => {
    showFolder(trip.folderId);
    props.onOpen(trip.id, dayId);
  };
  /** Shows a folder the search found, leaving an open trip for it. */
  const openFolder = (id: number) => void props.onLeave().then(() => showFolder(id));
  return (
    <section class="explorer">
      <LibraryActions />
      <PlacesList />
      <input class="search" type="search" placeholder={t('Search trips and folders')} aria-label={t('Search trips and folders')} value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
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
    </section>
  );
}
