import { createMemo, For, Match, Show, Switch } from 'solid-js';
import { heldOf, libraryFolders, libraryProblem, query, setQuery, showFolder, shownFolderId, showingDuplicates } from '../state/library';
import { openTrip, selectDay, selectedDay } from '../state/trip';
import { CollectionPanel } from '../trip/CollectionPanel';
import { SaveProblem, SaveState } from '../trip/SaveStatus';
import { TripIcons, TripPanel } from '../trip/TripPanel';
import { counted } from '../ui/format';
import { BackIcon, HomeIcon } from '../ui/icons';
import { DuplicatesReport } from './DuplicatesReport';
import { heldText } from './folders';
import { Library } from './Library';
import { LibraryActions } from './LibraryActions';
import { ALL_TRIPS, pathOf, upName, type Place } from './place';

/** The explorer's own name, its heading at the top of the library. */
const EXPLORER = 'Trip Explorer';

/** The way one level up: its name and what is there, where a click goes, and for a folder the one an item dropped on it moves into, as the card's `data-drop-folder`. */
interface Up {
  name: string;
  detail: string;
  go: () => void;
  dropFolder?: string;
}

/**
 * The panel's explorer, the same from the top of the library down to a trip's day: the
 * library's actions and search, the path to where it is with the trip's own actions, the
 * card that leads one level up, always in the same place, and what is there.
 */
export function Explorer(props: { onOpen: (id: number, dayId?: string) => void; onLeave: () => Promise<void>; onReload: () => void; opening: boolean; error: string | undefined }) {
  const folders = () => libraryFolders() ?? [];
  const place = createMemo((): Place => {
    const trip = openTrip();
    const day = selectedDay();
    return { folderId: shownFolderId(), duplicates: showingDuplicates(), trip, day: trip && day ? { day, index: trip.days.indexOf(day) } : undefined };
  });
  const path = createMemo(() => pathOf(place(), folders()));
  const up = createMemo((): Up | undefined => {
    const p = place();
    if (path().length === 0) return undefined;
    const name = upName(path());
    if (p.trip && p.day) return { name, detail: counted(p.trip.days.length, p.trip.kind === 'collection' ? 'section' : 'day'), go: () => selectDay(undefined) };
    if (p.trip) return { name, detail: p.duplicates ? 'Routes kept more than once' : heldText(heldOf(p.folderId)), go: () => void props.onLeave() };
    if (p.duplicates) return { name, detail: heldText(heldOf(p.folderId)), go: () => showFolder(p.folderId) };
    const parent = folders().find((f) => f.id === p.folderId)?.parentId ?? null;
    return { name, detail: heldText(heldOf(parent)), go: () => showFolder(parent), dropFolder: parent === null ? 'top' : String(parent) };
  });
  /** Opens a trip in its folder, which the explorer goes to: one found by the list or the search, or one just made in the folder shown. */
  const openIn = (id: number, folderId: number | null) => {
    showFolder(folderId);
    props.onOpen(id);
  };
  /** Shows a folder from the list or the search, leaving an open trip for it. */
  const openFolder = (id: number) => void props.onLeave().then(() => showFolder(id));
  return (
    <section class="explorer">
      <LibraryActions onOpen={(id) => openIn(id, shownFolderId())} onLeave={props.onLeave} opening={props.opening} />
      <input class="search" type="search" placeholder="Search trips and folders" aria-label="Search trips and folders" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
      <div class="row explorer-heading">
        <h2 class="path grow" title={path().join(' › ') || EXPLORER}>
          <Show when={path().length > 0} fallback={<span class="here">{EXPLORER}</span>}>
            <For each={path()}>
              {(name, i) => (
                <>
                  <Show when={i() > 0}>
                    <span class="sep" aria-hidden="true">
                      ›
                    </span>
                  </Show>
                  <span classList={{ here: i() === path().length - 1 }}>{name}</span>
                </>
              )}
            </For>
          </Show>
        </h2>
        <Show when={openTrip()}>
          {(trip) => (
            <>
              <Show when={trip().kind === 'trip'}>
                <TripIcons />
              </Show>
              <SaveState />
            </>
          )}
        </Show>
      </div>
      <Show
        when={up()}
        fallback={
          <div class="card up-card">
            <div class="row">
              <HomeIcon />
              <span class="lines">
                <span class="name">{ALL_TRIPS}</span>
                <span class="muted detail">{heldText(heldOf(null))}</span>
              </span>
            </div>
          </div>
        }
      >
        {(u) => (
          <div class="card up-card" data-drop-folder={u().dropFolder}>
            <button class="text" title={`Back to ${u().name}`} onClick={() => u().go()}>
              <BackIcon />
              <span class="lines">
                <span class="name">{u().name}</span>
                <span class="muted detail">{u().detail}</span>
              </span>
            </button>
          </div>
        )}
      </Show>
      <Show when={libraryProblem() ?? props.error}>{(message) => <p class="error">{message()}</p>}</Show>
      <Show when={openTrip()}>
        <SaveProblem onReload={props.onReload} />
      </Show>
      <Switch fallback={<TripPanel />}>
        <Match when={query().trim() || (!openTrip() && !showingDuplicates())}>
          <Library onOpen={(trip) => openIn(trip.id, trip.folderId)} onOpenFolder={openFolder} opening={props.opening} />
        </Match>
        <Match when={!openTrip()}>
          <DuplicatesReport onOpen={props.onOpen} disabled={props.opening} />
        </Match>
        <Match when={openTrip()?.kind === 'collection'}>
          <CollectionPanel />
        </Match>
      </Switch>
    </section>
  );
}
