import { createMemo, createResource, createSignal, For, Match, Show, Switch } from 'solid-js';
import { createFolder, createTrip, deleteFolder, deleteTrip, duplicateTrip, errorMessage, listFolders, listTrips, moveTrip, renameFolder, renameTrip } from '../api';
import type { Folder, TripSummary } from '../model/trip';
import { listFolderId, setListFolderId, setShowingDuplicates, showingDuplicates } from '../state/library';
import { DuplicatesReport } from './DuplicatesReport';
import { folderPath, heldCounts, heldInAll } from './folders';
import { importFolder, pickedPath, planFolderImport, type PlannedTrip } from './folderImport';
import { ImportDialog } from './ImportDialog';
import { cardMenu } from '../ui/cardMenu';
import { askChoice, askConfirmation } from '../ui/confirm';
import { counted, dateText } from '../ui/format';
import { BackIcon, FolderIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { NameDialog } from '../ui/NameDialog';

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** The dialog the library has open: naming a new trip or folder, or a new name for one. */
type LibraryDialog = { kind: 'new-trip' } | { kind: 'new-folder' } | { kind: 'rename-folder'; folder: Folder } | { kind: 'rename-trip'; trip: TripSummary };

/** The user's trips in folders, which may hold folders: open one, start one, move, delete; a search across all folders; the duplicates report. */
export function Library(props: { onOpen: (id: number, dayId?: string) => void; opening: boolean; error: string | undefined }) {
  const [trips, { refetch: refetchTrips }] = createResource(listTrips);
  const [folders, { refetch: refetchFolders }] = createResource(listFolders);

  const [query, setQuery] = createSignal('');
  const [busy, setBusy] = createSignal<string>();
  const [dialog, setDialog] = createSignal<LibraryDialog>();

  /** The open folder; none at the top, where the folders and the trips in no folder are. */
  const folder = () => folders()?.find((f) => f.id === listFolderId());
  const folderId = () => folder()?.id ?? null;
  const shownFolders = createMemo(() => (folders() ?? []).filter((f) => f.parentId === folderId()));
  const shownTrips = createMemo(() => (trips() ?? []).filter((t) => t.folderId === folderId()));
  const held = createMemo(() => heldCounts(folders() ?? [], trips() ?? []));
  const heldText = (id: number) => {
    const { trips, folders } = held()(id);
    return [folders > 0 && counted(folders, 'folder'), counted(trips, 'trip')].filter(Boolean).join(' · ');
  };
  const pathOf = (id: number | null) => folderPath(folders() ?? [], id);

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
  /** Asks to delete the folder and, when it holds anything, whether that moves up or goes with it; undefined when the user cancels. */
  const askFolderDeletion = async (f: Folder): Promise<'move' | 'delete' | undefined> => {
    const contentsText = ({ folders, trips }: { folders: number; trips: number }) =>
      [folders > 0 && counted(folders, 'folder'), trips > 0 && counted(trips, 'trip')].filter(Boolean).join(' and ');
    const own = contentsText(held()(f.id));
    if (!own) return (await askConfirmation(`Delete the folder “${f.name}”?`, 'Delete')) ? 'move' : undefined;
    const all = contentsText(heldInAll(folders() ?? [], trips() ?? [], f.id));
    const where = f.parentId === null ? 'to the top' : `into “${pathOf(f.parentId)}”`;
    const choice = await askChoice(
      `The folder “${f.name}” holds ${own}${all === own ? '' : ` (${all} in all)`}. Move them ${where} and delete the folder, or delete it with everything in it?`,
      ['Delete all', 'Move contents'],
    );
    return choice && ({ 'Delete all': 'delete', 'Move contents': 'move' } as const)[choice];
  };
  const removeFolder = async (f: Folder) => {
    const contents = await askFolderDeletion(f);
    if (!contents) return;
    await run(() => deleteFolder(f.id, contents), () => {
      void refetchFolders();
      void refetchTrips();
    });
  };
  /** How the last folder import goes or went, and what it could not read or save. */
  const [importNote, setImportNote] = createSignal<{ text: string; errors: string[] }>();
  const [importing, setImporting] = createSignal(false);
  /** The folder tree picked for import, while the dialog asks how it is organized. */
  const [picked, setPicked] = createSignal<{ files: File[]; paths: string[] }>();
  let folderInput!: HTMLInputElement;
  const pick = (list: FileList | null) => {
    const files = [...(list ?? [])];
    folderInput.value = '';
    const paths = files.map(pickedPath);
    if (planFolderImport(paths, 'trip-per-folder').length === 0) setImportNote({ text: 'No GPX files in that folder.', errors: [] });
    else setPicked({ files, paths });
  };
  /** Imports the picked folder tree into the open folder as planned. */
  const importPicked = async (files: File[], plan: PlannedTrip[]) => {
    setImporting(true);
    await run(async () => {
      const result = await importFolder(files, plan, folderId(), (text) => setImportNote({ text, errors: [] }));
      setImportNote({ text: `${counted(result.trips, plan[0]!.kind)} imported.`, errors: result.errors });
    });
    setImporting(false);
    void refetchFolders();
    void refetchTrips();
  };
  const emptyText = () => {
    if (folder()) return shownFolders().length > 0 ? 'No trips in this folder.' : 'Nothing in this folder yet.';
    return (folders() ?? []).length > 0 ? 'No trips outside the folders.' : 'No trips yet. Start one with New trip…';
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
  const tripItems = (trip: TripSummary): MenuItem[] => {
    const moveTo = (folderId: number | null) => () => void run(() => moveTrip(trip.id, folderId), refetchTrips);
    const places: MenuItem[] = [
      ...(trip.folderId === null ? [] : [{ label: 'No folder', run: moveTo(null) }]),
      ...(folders() ?? [])
        .filter((f) => f.id !== trip.folderId)
        .map((f) => ({ label: pathOf(f.id), run: moveTo(f.id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    return [
      { label: 'Rename…', run: () => setDialog({ kind: 'rename-trip', trip }) },
      ...(places.length > 0 ? [{ label: 'Move…', items: places }] : []),
      { label: 'Duplicate', run: () => void run(() => duplicateTrip(trip.id), refetchTrips) },
      { label: 'Delete', run: () => void removeTrip(trip) },
    ];
  };

  return (
    <section class="library">
      <Show
        when={!showingDuplicates()}
        fallback={<DuplicatesReport onOpen={props.onOpen} onClose={() => setShowingDuplicates(false)} disabled={props.opening} />}
      >
        <Show when={folder()} fallback={<h2>Trips</h2>}>
          {(f) => {
            const back = () => (f().parentId === null ? 'Back to all trips' : `Back to ${pathOf(f().parentId)}`);
            return (
              <div class="row">
                <button class="icon" title={back()} aria-label={back()} onClick={() => openFolder(f().parentId ?? undefined)}>
                  <BackIcon />
                </button>
                <h2 class="grow name" title={pathOf(f().id)}>
                  {f().name}
                </h2>
              </div>
            );
          }}
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
                  <button onClick={() => setDialog({ kind: 'new-folder' })}>New folder…</button>
                  <button disabled={importing()} onClick={() => folderInput.click()}>
                    Import folder…
                  </button>
                  <button onClick={() => setShowingDuplicates(true)}>Duplicates…</button>
                  <input
                    ref={(el) => {
                      folderInput = el;
                      el.webkitdirectory = true;
                    }}
                    type="file"
                    hidden
                    onChange={(e) => pick(e.currentTarget.files)}
                  />
                </div>
                <Show when={importNote()}>
                  {(note) => (
                    <>
                      <p class="muted hint">{note().text}</p>
                      <For each={note().errors}>{(error) => <p class="error">{error}</p>}</For>
                    </>
                  )}
                </Show>
                <ul class="folders">
                  <For each={shownFolders()}>{(f) => <FolderCard folder={f} note={heldText(f.id)} onOpen={openFolder} items={() => folderItems(f)} />}</For>
                </ul>
                <Show when={shownTrips().length > 0} fallback={<p class="muted">{emptyText()}</p>}>
                  <ul class="trips">
                    <For each={shownTrips()}>{(trip) => <TripCard trip={trip} onOpen={props.onOpen} disabled={props.opening} items={() => tripItems(trip)} />}</For>
                  </ul>
                </Show>
              </>
            }
          >
            {(q) => (
              <SearchResults
                query={q()}
                folders={folders()!}
                trips={trips()!}
                onOpenFolder={openFolder}
                onOpenTrip={props.onOpen}
                disabled={props.opening}
                folderNote={(f) => [pathOf(f.parentId), heldText(f.id)].filter(Boolean).join(' · ')}
                tripWhere={(trip) => pathOf(trip.folderId) || 'No folder'}
                folderItems={folderItems}
                tripItems={tripItems}
              />
            )}
          </Show>
          </Match>
        </Switch>
      </Show>
      <ImportDialog
        paths={picked()?.paths}
        into={folder() ? pathOf(folderId()) : ''}
        onClose={() => setPicked(undefined)}
        onImport={(plan) => void importPicked(picked()!.files, plan)}
      />
      <NameDialog
        title="New trip"
        open={dialog()?.kind === 'new-trip'}
        placeholder="Name of the trip"
        submit="Start"
        onClose={closeDialog}
        onSubmit={(name) => void run(async () => props.onOpen((await createTrip(name, folderId())).id))}
      />
      <NameDialog
        title="New folder"
        open={dialog()?.kind === 'new-folder'}
        placeholder="Name of the folder"
        submit="Create"
        onClose={closeDialog}
        onSubmit={(name) => void run(() => createFolder(name, folderId()), () => void refetchFolders())}
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
 * A trip as a card: its name over its days, its start and whether it was ridden, or for a
 * collection its sections, after the folder it is in where `where` names it; its menu
 * renames, moves, copies and deletes it.
 */
function TripCard(props: { trip: TripSummary; onOpen: (id: number) => void; disabled: boolean; items: () => MenuItem[]; where?: string }) {
  const meta = () =>
    (props.trip.kind === 'collection'
      ? [props.where, 'Planning material', counted(props.trip.dayCount, 'section')]
      : [props.where, counted(props.trip.dayCount, 'day'), props.trip.startsOn && `from ${dateText(props.trip.startsOn)}`, props.trip.state === 'done' && 'done']
    )
      .filter(Boolean)
      .join(' · ');
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

/** A folder as a card: its name over `note`, what it holds and in search results where it is; its menu renames and deletes it. */
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
  /** What a found folder's card says: where it is and what it holds. */
  folderNote: (f: Folder) => string;
  /** Where a found trip is. */
  tripWhere: (trip: TripSummary) => string;
  folderItems: (f: Folder) => MenuItem[];
  tripItems: (trip: TripSummary) => MenuItem[];
}) {
  const matches = (name: string) => name.toLowerCase().includes(props.query.toLowerCase());
  const found = createMemo(() => ({ folders: props.folders.filter((f) => matches(f.name)), trips: props.trips.filter((t) => matches(t.name)) }));
  const total = () => found().folders.length + found().trips.length;
  const listedTrips = () => found().trips.slice(0, Math.max(0, SEARCH_LIMIT - found().folders.length));
  return (
    <Show when={total() > 0} fallback={<p class="muted">Nothing found.</p>}>
      <ul class="results">
        <For each={found().folders.slice(0, SEARCH_LIMIT)}>
          {(f) => <FolderCard folder={f} note={props.folderNote(f)} onOpen={props.onOpenFolder} items={() => props.folderItems(f)} />}
        </For>
        <For each={listedTrips()}>
          {(trip) => <TripCard trip={trip} onOpen={props.onOpenTrip} disabled={props.disabled} items={() => props.tripItems(trip)} where={props.tripWhere(trip)} />}
        </For>
      </ul>
      <Show when={total() > SEARCH_LIMIT}>
        <p class="muted">{total() - SEARCH_LIMIT} more; narrow the search.</p>
      </Show>
    </Show>
  );
}
