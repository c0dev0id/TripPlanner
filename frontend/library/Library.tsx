import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { createFolder, createTrip, deleteFolder, deleteTrip, duplicateTrip, errorMessage, listFolders, listTrips, moveTrip, renameFolder } from '../api';
import type { Folder, TripSummary } from '../model/trip';
import { askConfirmation } from '../ui/confirm';
import { EditableName } from '../ui/EditableName';
import { dateText } from '../ui/format';
import { BackIcon, DeleteIcon, FolderIcon } from '../ui/icons';
import { MoreMenu } from '../ui/MoreMenu';
import { NameForm } from '../ui/NameForm';

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** The user's trips in their folders, one level deep: open one, start one, move, delete; a search across all folders. */
export function Library(props: { onOpen: (id: number) => void; opening: boolean; error: string | undefined }) {
  const [trips, { refetch: refetchTrips }] = createResource(listTrips);
  const [folders, { refetch: refetchFolders }] = createResource(listFolders);
  /** The open folder; none at the top, where the folders and the trips in no folder are. */
  const [folderId, setFolderId] = createSignal<number>();
  const [query, setQuery] = createSignal('');
  const [busy, setBusy] = createSignal<string>();

  const folder = () => folders()?.find((f) => f.id === folderId());
  const shownTrips = createMemo(() => (trips() ?? []).filter((t) => t.folderId === (folderId() ?? null)));
  const tripCounts = createMemo(() => {
    const counts = new Map<number | null, number>();
    for (const trip of trips() ?? []) counts.set(trip.folderId, (counts.get(trip.folderId) ?? 0) + 1);
    return counts;
  });
  const tripCount = (id: number) => tripCounts().get(id) ?? 0;

  /** Runs a request; its error is shown, and `then` runs after success. */
  const run = async (work: () => Promise<unknown>, then?: () => void) => {
    setBusy(undefined);
    try {
      await work();
      then?.();
    } catch (error) {
      setBusy(errorMessage(error));
    }
  };
  const removeTrip = async (trip: TripSummary) => {
    if (!(await askConfirmation(`Delete the trip “${trip.name}” with all its days?`, 'Delete'))) return;
    await run(() => deleteTrip(trip.id), refetchTrips);
  };
  const removeFolder = async (f: Folder) => {
    const count = tripCount(f.id);
    const trips = count === 0 ? '' : count === 1 ? ' Its trip stays, in no folder.' : ` Its ${count} trips stay, in no folder.`;
    if (!(await askConfirmation(`Delete the folder “${f.name}”?${trips}`, 'Delete'))) return;
    await run(() => deleteFolder(f.id), () => {
      void refetchFolders();
      void refetchTrips();
    });
  };
  const openFolder = (id: number | undefined) => {
    setFolderId(id);
    setQuery('');
  };

  return (
    <section class="library">
      <Show when={folder()} fallback={<h2>Trips</h2>}>
        {(f) => (
          <div class="row">
            <button class="icon" title="Back to all trips" aria-label="Back to all trips" onClick={() => openFolder(undefined)}>
              <BackIcon />
            </button>
            <h2 class="grow name" title={f().name}>
              {f().name}
            </h2>
          </div>
        )}
      </Show>
      <input class="search" type="search" placeholder="Search trips and folders" aria-label="Search trips and folders" value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
      <Show when={busy() ?? props.error}>{(message) => <p class="error">{message()}</p>}</Show>
      <Show when={trips.error ?? folders.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Show>
      <Show when={trips() && folders()} fallback={<p class="muted">Loading…</p>}>
        <Show
          when={query().trim()}
          fallback={
            <>
              <NameForm placeholder="Name of a new trip" button="New trip" primary disabled={props.opening} onSubmit={(name) => run(async () => props.onOpen((await createTrip(name, folderId() ?? null)).id))} />
              <Show when={!folder()}>
                <NameForm placeholder="Name of a new folder" button="New folder" onSubmit={(name) => run(() => createFolder(name), () => void refetchFolders())} />
                <ul class="folders">
                  <For each={folders()}>
                    {(f) => (
                      <li class="row">
                        <FolderButton folder={f} note={tripCount(f.id) === 1 ? '1 trip' : `${tripCount(f.id)} trips`} onOpen={openFolder} />
                        <EditableName value={f.name} label="folder" onRename={(name) => void run(() => renameFolder(f.id, name), refetchFolders)}>
                          <span />
                        </EditableName>
                        <button class="icon" title="Delete folder" aria-label={`Delete the folder ${f.name}`} onClick={() => void removeFolder(f)}>
                          <DeleteIcon />
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <Show when={shownTrips().length > 0} fallback={<p class="muted">{folder() ? 'No trips in this folder yet.' : folders()!.length > 0 ? 'No trips outside the folders.' : 'No trips yet. Name one above to start planning.'}</p>}>
                <ul class="trips">
                  <For each={shownTrips()}>
                    {(trip) => (
                      <li class="row">
                        <TripButton trip={trip} onOpen={props.onOpen} disabled={props.opening} />
                        <select aria-label={`Folder of ${trip.name}`} value={trip.folderId ?? ''} onChange={(e) => void run(() => moveTrip(trip.id, e.currentTarget.value === '' ? null : Number(e.currentTarget.value)), refetchTrips)}>
                          <option value="">No folder</option>
                          <For each={folders()}>{(f) => <option value={f.id}>{f.name}</option>}</For>
                        </select>
                        <MoreMenu
                          label={`More for ${trip.name}`}
                          items={() => [
                            { label: 'Duplicate', run: () => void run(() => duplicateTrip(trip.id), refetchTrips) },
                            { label: 'Delete', run: () => void removeTrip(trip) },
                          ]}
                        />
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </>
          }
        >
          {(q) => <SearchResults query={q()} folders={folders()!} trips={trips()!} onOpenFolder={openFolder} onOpenTrip={props.onOpen} disabled={props.opening} />}
        </Show>
      </Show>
    </section>
  );
}

function TripButton(props: { trip: TripSummary; onOpen: (id: number) => void; disabled: boolean; note?: string }) {
  return (
    <button class="text grow" onClick={() => props.onOpen(props.trip.id)} disabled={props.disabled}>
      <span class="name">{props.trip.name}</span>
      <span class="muted">
        {props.note ?? `${props.trip.dayCount} ${props.trip.dayCount === 1 ? 'day' : 'days'}${props.trip.startsOn ? ` · from ${dateText(props.trip.startsOn)}` : ''}`}
      </span>
    </button>
  );
}

function FolderButton(props: { folder: Folder; note: string; onOpen: (id: number) => void }) {
  return (
    <button class="text grow" onClick={() => props.onOpen(props.folder.id)}>
      <span class="row">
        <FolderIcon />
        <span class="name">{props.folder.name}</span>
      </span>
      <span class="muted">{props.note}</span>
    </button>
  );
}

/** Folders and trips whose names contain the query, whatever folder they are in, up to a limit. */
function SearchResults(props: { query: string; folders: Folder[]; trips: TripSummary[]; onOpenFolder: (id: number) => void; onOpenTrip: (id: number) => void; disabled: boolean }) {
  const matches = (name: string) => name.toLowerCase().includes(props.query.toLowerCase());
  const found = createMemo(() => ({ folders: props.folders.filter((f) => matches(f.name)), trips: props.trips.filter((t) => matches(t.name)) }));
  const total = () => found().folders.length + found().trips.length;
  const listedTrips = () => found().trips.slice(0, Math.max(0, SEARCH_LIMIT - found().folders.length));
  const folderName = (id: number | null) => props.folders.find((f) => f.id === id)?.name;
  return (
    <Show when={total() > 0} fallback={<p class="muted">Nothing found.</p>}>
      <ul class="results">
        <For each={found().folders.slice(0, SEARCH_LIMIT)}>
          {(f) => (
            <li class="row">
              <FolderButton folder={f} note="folder" onOpen={props.onOpenFolder} />
            </li>
          )}
        </For>
        <For each={listedTrips()}>
          {(trip) => (
            <li class="row">
              <TripButton trip={trip} onOpen={props.onOpenTrip} disabled={props.disabled} note={folderName(trip.folderId) ?? 'no folder'} />
            </li>
          )}
        </For>
      </ul>
      <Show when={total() > SEARCH_LIMIT}>
        <p class="muted">{total() - SEARCH_LIMIT} more; narrow the search.</p>
      </Show>
    </Show>
  );
}
