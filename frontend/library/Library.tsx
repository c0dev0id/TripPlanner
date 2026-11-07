import { plural, t } from '../i18n/t';
import { createEffect, createMemo, createSelector, createSignal, For, Match, on, Show, Switch } from 'solid-js';
import { changeTrip, createTrip, deleteFolder, deleteTrip, duplicateTrip, errorMessage, mergeTrips, moveFolder, moveTrip, renameFolder, renameTrip } from '../api';
import { asName, newId, type Folder, type TripSummary } from '../model/trip';
import { pasteIntoTrip, type CopiedRoute } from '../routing/dayEdit';
import { routesPasteItem } from '../state/clipboard';
import { heldOf, importNote, libraryFolders, libraryTrips, query, relistFolders, relistTrips, runLibrary, shownFolderId } from '../state/library';
import { folderPath, heldInAll, heldText } from './folders';
import { cardMenu } from '../ui/cardMenu';
import { askChoice, askConfirmation } from '../ui/confirm';
import { counted, dateText } from '../ui/format';
import { FolderIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { NameDialog } from '../ui/NameDialog';
import { clickSelect, menuSelection, NOTHING_SELECTED, toggled, type Selection } from '../ui/selection';
import { ForById } from '../ui/ForById';
import { Pad } from '../ui/Pad';
import { dragToFolder } from './dragToFolder';

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** The dialog the library has open: a new name for a folder or a trip. */
type LibraryDialog = { kind: 'rename-folder'; folder: Folder } | { kind: 'rename-trip'; trip: TripSummary };

/**
 * The folder the explorer shows, its folders and trips, or what the search found across
 * all folders: open one, move, merge, rename, delete.
 */
export function Library(props: { onOpen: (trip: TripSummary) => void; onOpenFolder: (id: number) => void; opening: boolean }) {
  const [dialog, setDialog] = createSignal<LibraryDialog>();
  const folders = () => libraryFolders() ?? [];
  const trips = () => libraryTrips() ?? [];
  const shownFolders = createMemo(() => folders().filter((f) => f.parentId === shownFolderId()));
  const shownTrips = createMemo(() => trips().filter((t) => t.folderId === shownFolderId()));
  const pathOf = (id: number | null) => folderPath(folders(), id);

  /** Asks to delete the folder and, when it holds anything, whether that moves up or goes with it; undefined when the user cancels. */
  const askFolderDeletion = async (f: Folder): Promise<'move' | 'delete' | undefined> => {
    const contentsText = ({ folders, trips }: { folders: number; trips: number }) =>
      [folders > 0 && counted(folders, 'folder'), trips > 0 && counted(trips, 'trip')].filter(Boolean).join(t(' and '));
    const own = contentsText(heldOf(f.id));
    if (!own) return (await askConfirmation(t('Delete the folder “{name}”?', { name: f.name }), t('Delete'))) ? 'move' : undefined;
    const all = contentsText(heldInAll(folders(), heldOf, f.id));
    const where = f.parentId === null ? t('to the top') : t('into “{path}”', { path: pathOf(f.parentId) });
    const question = t('The folder “{name}” holds {own}{all}. Move them {where} and delete the folder, or delete it with everything in it?', {
      name: f.name,
      own,
      all: all === own ? '' : t(' ({all} in all)', { all }),
      where,
    });
    const choice = await askChoice(question, [t('Delete all'), t('Move contents')]);
    return choice === undefined ? undefined : choice === t('Delete all') ? 'delete' : 'move';
  };
  const removeFolder = async (f: Folder) => {
    const contents = await askFolderDeletion(f);
    if (!contents) return;
    await runLibrary(() => deleteFolder(f.id, contents), () => {
      relistFolders();
      relistTrips();
    });
  };
  const emptyText = () => {
    if (shownFolderId() !== null) return t(shownFolders().length > 0 ? 'No trips in this folder.' : 'Nothing in this folder yet.');
    return t(folders().length > 0 ? 'No trips outside the folders.' : 'No trips yet. Start one with the new trip icon above.');
  };
  /** The trips of the folder selected to be merged, by id, the first selected first; none once another folder is shown. */
  const [selectedTrips, setSelectedTrips] = createSignal<Selection<number>>(NOTHING_SELECTED);
  createEffect(on(shownFolderId, () => setSelectedTrips(NOTHING_SELECTED)));
  const isSelectedTrip = createSelector(() => selectedTrips().keys, (id: number, keys) => keys.has(id));
  const selectedTripList = () => [...selectedTrips().keys].flatMap((id) => trips().find((t) => t.id === id) ?? []);
  /** Lists the trips afresh, none selected: after trips were moved, merged or deleted. */
  const relist = () => {
    setSelectedTrips(NOTHING_SELECTED);
    relistTrips();
  };
  const removeTrips = async (doomed: TripSummary[]) => {
    const question = doomed.length === 1 ? t('Delete the trip “{name}” with all its days?', { name: doomed[0]!.name }) : t('Delete {n} trips with all their days?', { n: doomed.length });
    if (!(await askConfirmation(question, t('Delete')))) return;
    await runLibrary(() => Promise.all(doomed.map((t) => deleteTrip(t.id))), relist);
  };
  const merge = async (into: TripSummary, others: TripSummary[]) => {
    const what = counted(others.length, into.kind);
    const where = t(into.kind === 'collection' ? 'Their sections move into it' : 'Their days and journal move into it, a day onto its day of the same date where it has one');
    const question = plural(others.length, 'Merge {what} into “{name}”? {where}, and the merged one is deleted.|Merge {what} into “{name}”? {where}, and the merged ones are deleted.', { what, name: into.name, where });
    if (!(await askConfirmation(question, t('Merge')))) return;
    await runLibrary(() => mergeTrips(into.id, others.map((t) => t.id)), relist);
  };
  /** Moves trips into a folder, none for the top, those not in it already. */
  const moveTripsInto = (moved: TripSummary[], folderId: number | null) => {
    const going = moved.filter((t) => t.folderId !== folderId);
    if (going.length > 0) void runLibrary(() => Promise.all(going.map((t) => moveTrip(t.id, folderId))), relist);
  };
  /** Moves a folder into another, none for the top; the server refuses one inside itself. */
  const moveFolderInto = (f: Folder, parentId: number | null) => {
    if (parentId !== f.id && parentId !== f.parentId) void runLibrary(() => moveFolder(f.id, parentId), relistFolders);
  };
  /** The trips a press on a trip's pad drags: the selected ones where it is one of them, else it alone. */
  const draggedWith = (trip: TripSummary): TripSummary[] => (isSelectedTrip(trip.id) ? selectedTripList() : [trip]);
  /** The item that moves trips of one folder into another folder or into none, from a submenu; none where there is nowhere to go. */
  const moveItem = (moved: TripSummary[], label: string): MenuItem[] => {
    const from = moved[0]!.folderId;
    const moveTo = (folderId: number | null) => () => moveTripsInto(moved, folderId);
    const places: MenuItem[] = [
      ...(from === null ? [] : [{ label: t('No folder'), run: moveTo(null) }]),
      ...folders()
        .filter((f) => f.id !== from)
        .map((f) => ({ label: pathOf(f.id), run: moveTo(f.id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    return places.length > 0 ? [{ label, items: places }] : [];
  };
  /** The menu of several selected trips: merging the others into the first selected where they are of one kind, moving and deleting them all. */
  const selectionItems = (into: TripSummary, others: TripSummary[]): MenuItem[] => {
    const all = [into, ...others];
    return [
      others.every((t) => t.kind === into.kind)
        ? { label: t('Merge into “{name}”', { name: into.name }), run: () => void merge(into, others) }
        : { label: t('Trips and planning material do not merge'), disabled: true, run: () => undefined },
      ...moveItem(all, t('Move {n} trips…', { n: all.length })),
      { label: t('Delete {n} trips', { n: all.length }), run: () => void removeTrips(all) },
    ];
  };
  const renamedFolder = () => {
    const d = dialog();
    return d?.kind === 'rename-folder' ? d.folder : undefined;
  };
  const renamedTrip = () => {
    const d = dialog();
    return d?.kind === 'rename-trip' ? d.trip : undefined;
  };
  /** Pastes copied routes into the trip where an import would put them, and saves it. */
  const pasteInto = (tripId: number, routes: CopiedRoute[]) => changeTrip(tripId, (trip) => pasteIntoTrip(trip, routes, newId));
  /** A new collection in the folder for pasted routes, named after the first; its id. */
  const collectionFor = async (f: Folder, routes: CopiedRoute[]) => {
    const first = routes[0]!.route.name || t('Pasted routes');
    return (await createTrip(asName(routes.length > 1 ? t('{name} and {n} more', { name: first, n: routes.length - 1 }) : first), f.id, 'collection')).id;
  };
  const folderItems = (f: Folder): MenuItem[] => [
    { label: t('Rename…'), run: () => setDialog({ kind: 'rename-folder', folder: f }) },
    ...routesPasteItem((routes) => void runLibrary(async () => pasteInto(await collectionFor(f, routes), routes), relistTrips)),
    { label: t('Delete'), run: () => void removeFolder(f) },
  ];
  const tripItems = (trip: TripSummary): MenuItem[] => {
    setSelectedTrips((s) => menuSelection(s, trip.id));
    const [first, ...others] = selectedTripList();
    if (first && others.length > 0) return selectionItems(first, others);
    return [
      { label: t('Rename…'), run: () => setDialog({ kind: 'rename-trip', trip }) },
      ...moveItem([trip], t('Move…')),
      { label: t('Duplicate'), run: () => void runLibrary(() => duplicateTrip(trip.id), relistTrips) },
      ...routesPasteItem((routes) => void runLibrary(() => pasteInto(trip.id, routes), relistTrips)),
      { label: t('Delete'), run: () => void removeTrips([trip]) },
    ];
  };

  return (
    <div class="library">
      <Show when={importNote()}>
        {(note) => (
          <>
            <p class="muted hint">{note().text}</p>
            <For each={note().errors}>{(error) => <p class="error">{error}</p>}</For>
          </>
        )}
      </Show>
      {/* Reading a resource that failed throws; its error is shown instead. */}
      <Switch fallback={<p class="muted">{t('Loading…')}</p>}>
        <Match when={libraryTrips.error ?? libraryFolders.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Match>
        <Match when={libraryTrips() && libraryFolders()}>
          <Show
            when={query().trim()}
            fallback={
              <>
                <ul class="folders">
                  <ForById each={shownFolders()}>
                    {(f) => (
                      <FolderCard
                        folder={f()}
                        note={heldText(heldOf(f().id))}
                        onOpen={props.onOpenFolder}
                        items={() => folderItems(f())}
                        onDrag={(e, dragged) => dragToFolder(e, f().name, (into) => moveFolderInto(f(), into), dragged)}
                      />
                    )}
                  </ForById>
                </ul>
                <Show when={shownTrips().length > 0} fallback={<p class="muted">{emptyText()}</p>}>
                  <ul class="trips">
                    <ForById each={shownTrips()}>
                      {(trip) => (
                        <TripCard
                          trip={trip()}
                          onOpen={props.onOpen}
                          disabled={props.opening}
                          items={() => tripItems(trip())}
                          select={{
                            selected: () => isSelectedTrip(trip().id),
                            onToggle: () => setSelectedTrips((s) => toggled(s, trip().id)),
                            onClick: (e) => setSelectedTrips((s) => clickSelect(s, shownTrips().map((t) => t.id), trip().id, e)),
                            onDrag: (e, dragged) => {
                              const moved = draggedWith(trip());
                              dragToFolder(e, moved.length === 1 ? trip().name : counted(moved.length, 'trip'), (into) => moveTripsInto(moved, into), dragged);
                            },
                          }}
                        />
                      )}
                    </ForById>
                  </ul>
                </Show>
              </>
            }
          >
            {(q) => (
              <SearchResults
                query={q()}
                folders={folders()}
                trips={trips()}
                onOpenFolder={props.onOpenFolder}
                onOpenTrip={props.onOpen}
                disabled={props.opening}
                folderNote={(f) => [pathOf(f.parentId), heldText(heldOf(f.id))].filter(Boolean).join(' · ')}
                tripWhere={(trip) => pathOf(trip.folderId) || t('No folder')}
                folderItems={folderItems}
                tripItems={tripItems}
              />
            )}
          </Show>
        </Match>
      </Switch>
      <NameDialog
        title={t('Rename folder')}
        open={renamedFolder() !== undefined}
        placeholder={t('Name of the folder')}
        initial={renamedFolder()?.name}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => {
          const f = renamedFolder()!;
          if (name !== f.name) void runLibrary(() => renameFolder(f.id, name), relistFolders);
        }}
      />
      <NameDialog
        title={t('Rename trip')}
        open={renamedTrip() !== undefined}
        placeholder={t('Name of the trip')}
        initial={renamedTrip()?.name}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => {
          const trip = renamedTrip()!;
          if (name !== trip.name) void runLibrary(() => renameTrip(trip.id, name), relistTrips);
        }}
      />
    </div>
  );
}

/**
 * A trip as a card: its name over its days, its start and whether it was ridden, or for a
 * collection its sections, after the folder it is in where `where` names it; its menu
 * renames, moves, copies and deletes it. A click opens it. Where it can be selected, a tap
 * on its pad selects it, a press drags it, and a click with Cmd, Ctrl or Shift held goes
 * to `select.onClick`.
 */
function TripCard(props: {
  trip: TripSummary;
  onOpen: (trip: TripSummary) => void;
  disabled: boolean;
  items: () => MenuItem[];
  where?: string;
  select?: { selected: () => boolean; onToggle: () => void; onClick: (e: MouseEvent) => void; onDrag: (e: PointerEvent, dragged: () => void) => void };
}) {
  const meta = () =>
    (props.trip.kind === 'collection'
      ? [props.where, t('Planning material'), counted(props.trip.dayCount, 'section')]
      : [props.where, counted(props.trip.dayCount, 'day'), props.trip.startsOn && t('from {date}', { date: dateText(props.trip.startsOn) }), props.trip.state === 'done' && t('done')]
    )
      .filter(Boolean)
      .join(' · ');
  return (
    <li class="card" classList={{ selected: props.select?.selected() }} ref={(el) => cardMenu(el, props.items)}>
      <div class="row">
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.trip.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <button
          class="text grow"
          onClick={(e) => (props.select && (e.metaKey || e.ctrlKey || e.shiftKey) ? props.select.onClick(e) : props.onOpen(props.trip))}
          disabled={props.disabled}
        >
          <span class="lines">
            <span class="name">{props.trip.name}</span>
            <span class="muted detail">{meta()}</span>
          </span>
        </button>
      </div>
    </li>
  );
}

/**
 * A folder as a card: its name over `note`, what it holds and in search results where it
 * is; its menu renames and deletes it. Trips and folders dragged onto it move into it;
 * where `onDrag` is given, its pad drags it into another.
 */
function FolderCard(props: { folder: Folder; note: string; onOpen: (id: number) => void; items: () => MenuItem[]; onDrag?: (e: PointerEvent, dragged: () => void) => void }) {
  return (
    <li class="card" data-drop-folder={String(props.folder.id)} ref={(el) => cardMenu(el, props.items)}>
      <div class="row">
        <Show when={props.onDrag}>{(onDrag) => <Pad label={t('Drag {name} into another folder', { name: props.folder.name })} onPress={onDrag()} />}</Show>
        <button class="text grow" onClick={() => props.onOpen(props.folder.id)}>
          <FolderIcon />
          <span class="lines">
            <span class="name">{props.folder.name}</span>
            <span class="muted detail">{props.note}</span>
          </span>
        </button>
      </div>
    </li>
  );
}

/** Folders and trips whose names contain the query, whatever folder they are in, up to a limit. */
function SearchResults(props: {
  query: string;
  folders: Folder[];
  trips: TripSummary[];
  onOpenFolder: (id: number) => void;
  onOpenTrip: (trip: TripSummary) => void;
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
    <Show when={total() > 0} fallback={<p class="muted">{t('Nothing found.')}</p>}>
      <ul class="results">
        <For each={found().folders.slice(0, SEARCH_LIMIT)}>
          {(f) => <FolderCard folder={f} note={props.folderNote(f)} onOpen={props.onOpenFolder} items={() => props.folderItems(f)} />}
        </For>
        <For each={listedTrips()}>
          {(trip) => <TripCard trip={trip} onOpen={props.onOpenTrip} disabled={props.disabled} items={() => props.tripItems(trip)} where={props.tripWhere(trip)} />}
        </For>
      </ul>
      <Show when={total() > SEARCH_LIMIT}>
        <p class="muted">{t('{n} more; narrow the search.', { n: total() - SEARCH_LIMIT })}</p>
      </Show>
    </Show>
  );
}
