import { createMemo, createResource, createSignal, For, Match, Show, Switch } from 'solid-js';
import { createFolder, createTrip, deleteFolder, deleteTrip, duplicateTrip, errorMessage, listFolders, listTrips, moveTrip, renameFolder, renameTrip } from '../api';
import type { Folder, TripSummary } from '../model/trip';
import { listFolderId, setListFolderId } from '../state/library';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { dateText } from '../ui/format';
import { BackIcon, FolderIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { NameDialog } from '../ui/NameDialog';

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** The dialog the library has open: naming a new trip or folder, or a new name for one. */
type LibraryDialog = { kind: 'new-trip' } | { kind: 'new-folder' } | { kind: 'rename-folder'; folder: Folder } | { kind: 'rename-trip'; trip: TripSummary };

/** The user's trips in their folders, one level deep: open one, start one, move, delete; a search across all folders. */
export function Library(props: { onOpen: (id: number) => void; opening: boolean; error: string | undefined }) {
  const [trips, { refetch: refetchTrips }] = createResource(listTrips);
  const [folders, { refetch: refetchFolders }] = createResource(listFolders);

  const [query, setQuery] = createSignal('');
  const [busy, setBusy] = createSignal<string>();
  const [dialog, setDialog] = createSignal<LibraryDialog>();

  /** The open folder; none at the top, where the folders and the trips in no folder are. */
  const folder = () => folders()?.find((f) => f.id === listFolderId());
  const folderId = () => folder()?.id;
  const shownTrips = createMemo(() => (trips() ?? []).filter((t) => t.folderId === (folderId() ?? null)));
  const tripCounts = createMemo(() => {
    const counts = new Map<number | null, number>();
    for (const trip of trips() ?? []) counts.set(trip.folderId, (counts.get(trip.folderId) ?? 0) + 1);
    return counts;
  });
  const tripCount = (id: number) => tripCounts().get(id) ?? 0;
  const tripCountText = (id: number) => (tripCount(id) === 1 ? '1 trip' : `${tripCount(id)} trips`);

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
  const closeDialog = () => setDialog(undefined);
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
    setListFolderId(id);
    setQuery('');
  };
  const renamedFolder = () => {
    const d = dialog();
    return d?.kind === 'rename-folder' ? d.folder : undefined;
  };
  const renamedTrip = () => {
    const d = dialog();
    return d?.kind === 'rename-trip' ? d.trip : undefined;
  };
  const folderItems = (f: Folder): MenuItem[] => [
    { label: 'Rename…', run: () => setDialog({ kind: 'rename-folder', folder: f }) },
    { label: 'Delete', run: () => void removeFolder(f) },
  ];
  const tripItems = (trip: TripSummary): MenuItem[] => [
    { label: 'Rename…', run: () => setDialog({ kind: 'rename-trip', trip }) },
    ...(folders() ?? []).filter((f) => f.id !== trip.folderId).map((f) => ({ label: `Move to ${f.name}`, run: () => void run(() => moveTrip(trip.id, f.id), refetchTrips) })),
    ...(trip.folderId === null ? [] : [{ label: 'Move out of the folder', run: () => void run(() => moveTrip(trip.id, null), refetchTrips) }]),
    { label: 'Duplicate', run: () => void run(() => duplicateTrip(trip.id), refetchTrips) },
    { label: 'Delete', run: () => void removeTrip(trip) },
  ];

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
      {/* Reading a resource that failed throws; its error is shown instead. */}
      <Switch fallback={<p class="muted">Loading…</p>}>
        <Match when={trips.error ?? folders.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Match>
        <Match when={trips() && folders()}>
        <Show
          when={query().trim()}
          fallback={
            <>
              <div class="row new">
                <button class="primary" disabled={props.opening} onClick={() => setDialog({ kind: 'new-trip' })}>
                  New trip…
                </button>
                <Show when={!folder()}>
                  <button onClick={() => setDialog({ kind: 'new-folder' })}>New folder…</button>
                </Show>
              </div>
              <Show when={!folder()}>
                <ul class="folders">
                  <For each={folders()}>{(f) => <FolderCard folder={f} note={tripCountText(f.id)} onOpen={openFolder} items={() => folderItems(f)} />}</For>
                </ul>
              </Show>
              <Show when={shownTrips().length > 0} fallback={<p class="muted">{folder() ? 'No trips in this folder yet.' : folders()!.length > 0 ? 'No trips outside the folders.' : 'No trips yet. Start one with New trip…'}</p>}>
                <ul class="trips">
                  <For each={shownTrips()}>{(trip) => <TripCard trip={trip} onOpen={props.onOpen} disabled={props.opening} items={() => tripItems(trip)} />}</For>
                </ul>
              </Show>
            </>
          }
        >
          {(q) => <SearchResults query={q()} folders={folders()!} trips={trips()!} onOpenFolder={openFolder} onOpenTrip={props.onOpen} disabled={props.opening} folderNote={tripCountText} folderItems={folderItems} tripItems={tripItems} />}
        </Show>
        </Match>
      </Switch>
      <NameDialog
        title="New trip"
        open={dialog()?.kind === 'new-trip'}
        placeholder="Name of the trip"
        submit="Start"
        onClose={closeDialog}
        onSubmit={(name) => void run(async () => props.onOpen((await createTrip(name, folderId() ?? null)).id))}
      />
      <NameDialog
        title="New folder"
        open={dialog()?.kind === 'new-folder'}
        placeholder="Name of the folder"
        submit="Create"
        onClose={closeDialog}
        onSubmit={(name) => void run(() => createFolder(name), () => void refetchFolders())}
      />
      <NameDialog
        title="Rename folder"
        open={renamedFolder() !== undefined}
        placeholder="Name of the folder"
        initial={renamedFolder()?.name}
        onClose={closeDialog}
        onSubmit={(name) => {
          const f = renamedFolder()!;
          if (name !== f.name) void run(() => renameFolder(f.id, name), refetchFolders);
        }}
      />
      <NameDialog
        title="Rename trip"
        open={renamedTrip() !== undefined}
        placeholder="Name of the trip"
        initial={renamedTrip()?.name}
        onClose={closeDialog}
        onSubmit={(name) => {
          const trip = renamedTrip()!;
          if (name !== trip.name) void run(() => renameTrip(trip.id, name), refetchTrips);
        }}
      />
    </section>
  );
}

/**
 * A trip as a card: its name over its days, its start and whether it was ridden, after the
 * folder it is in where `where` names it; its menu renames, moves, copies and deletes it.
 */
function TripCard(props: { trip: TripSummary; onOpen: (id: number) => void; disabled: boolean; items: () => MenuItem[]; where?: string }) {
  const meta = () =>
    [props.where, `${props.trip.dayCount} ${props.trip.dayCount === 1 ? 'day' : 'days'}`, props.trip.startsOn && `from ${dateText(props.trip.startsOn)}`, props.trip.state === 'done' && 'done'].filter(Boolean).join(' · ');
  return (
    <li class="card" ref={(el) => cardMenu(el, props.items)}>
      <button class="text" onClick={() => props.onOpen(props.trip.id)} disabled={props.disabled}>
        <span class="lines">
          <span class="name">{props.trip.name}</span>
          <span class="muted detail">{meta()}</span>
        </span>
      </button>
    </li>
  );
}

/** A folder as a card: its name over how many trips it holds; its menu renames and deletes it. */
function FolderCard(props: { folder: Folder; note: string; onOpen: (id: number) => void; items: () => MenuItem[] }) {
  return (
    <li class="card" ref={(el) => cardMenu(el, props.items)}>
      <button class="text" onClick={() => props.onOpen(props.folder.id)}>
        <FolderIcon />
        <span class="lines">
          <span class="name">{props.folder.name}</span>
          <span class="muted detail">{props.note}</span>
        </span>
      </button>
    </li>
  );
}

/** Folders and trips whose names contain the query, whatever folder they are in, up to a limit. */
function SearchResults(props: {
  query: string;
  folders: Folder[];
  trips: TripSummary[];
  onOpenFolder: (id: number) => void;
  onOpenTrip: (id: number) => void;
  disabled: boolean;
  folderNote: (id: number) => string;
  folderItems: (f: Folder) => MenuItem[];
  tripItems: (trip: TripSummary) => MenuItem[];
}) {
  const matches = (name: string) => name.toLowerCase().includes(props.query.toLowerCase());
  const found = createMemo(() => ({ folders: props.folders.filter((f) => matches(f.name)), trips: props.trips.filter((t) => matches(t.name)) }));
  const total = () => found().folders.length + found().trips.length;
  const listedTrips = () => found().trips.slice(0, Math.max(0, SEARCH_LIMIT - found().folders.length));
  const folderName = (id: number | null) => props.folders.find((f) => f.id === id)?.name;
  return (
    <Show when={total() > 0} fallback={<p class="muted">Nothing found.</p>}>
      <ul class="results">
        <For each={found().folders.slice(0, SEARCH_LIMIT)}>
          {(f) => <FolderCard folder={f} note={props.folderNote(f.id)} onOpen={props.onOpenFolder} items={() => props.folderItems(f)} />}
        </For>
        <For each={listedTrips()}>
          {(trip) => <TripCard trip={trip} onOpen={props.onOpenTrip} disabled={props.disabled} items={() => props.tripItems(trip)} where={folderName(trip.folderId) ?? 'No folder'} />}
        </For>
      </ul>
      <Show when={total() > SEARCH_LIMIT}>
        <p class="muted">{total() - SEARCH_LIMIT} more; narrow the search.</p>
      </Show>
    </Show>
  );
}
