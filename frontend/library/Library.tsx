import { plural, t } from '../i18n/t';
import { createEffect, createMemo, createSelector, createSignal, For, Match, on, onCleanup, Show, Switch, type JSX } from 'solid-js';
import { changeTrip, keepStashRides, removeStashItems, renameStashItem, type NamedRoute, createFolder, createTrip, deleteFolder, deleteStashFile, deleteTrip, moveStashFile, renameStashFile, duplicateTrip, errorMessage, mergeTrips, moveFolder, moveTrip, renameFolder, renameTrip, tripArchiveUrl } from '../api';
import type { StashFile, StashItem } from '../model/stash';
import { newId, type Folder, type TripSummary } from '../model/trip';
import { addDay as withDayAdded, pasteDays, pasteIntoTrip, type CopiedRoute } from '../routing/dayEdit';
import { clearClip, copyLibraryItems, libraryClip, libraryPasteItem, type LibraryClip, copyRoutes, copyStops } from '../state/clipboard';
import { fetchingTrip, heldOf, importNote, isOpening, isPlaceList, libraryFolders, libraryTab, libraryTrips, markedFolderOf, deleteRoutes, opening, openTree, outlineOf, query, relistFolders, relistStash, searchedFor, relistTrips, stashFiles, rootOf, TAB_NAMES, treeOf, TREE_TABS, type TreeTab, runLibrary, setImportNote, showFolder, shownFolderId } from '../state/library';
import { withImportedDay } from './folderImport';
import { countsText, folderPath, heldInAll, heldText, kindAround } from './folders';
import { flushSave } from '../state/autosave';
import { showInStash, shownInStash, stashEdited, stashProblem } from '../state/stash';
import { ridesChanged } from '../state/rides';
import { setEditTarget } from '../state/drawing';
import { addDay, addSection, isMarkInTrip, isTripMarked, markFolder, markTrip, openTrip, openTripId, selectDay, selectedDayId } from '../state/trip';
import { dayDetail, dayHeading } from '../trip/labels';
import { readPreference, writePreference } from '../ui/preferences';
import { cardMenu } from '../ui/cardMenu';
import { askChoice, askConfirmation } from '../ui/confirm';
import { counted, dateText, openingText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CollectionIcon, FoldIcon, FolderIcon, TripIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { clickRow, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, toggleRow, type Selection } from '../ui/selection';
import { fileVerb } from '../ui/fileVerb';
import { ForById } from '../ui/ForById';
import { Pad } from '../ui/Pad';
import { dragToFolder } from './dragToFolder';
import { libraryImports } from './importActions';
import { StashFileCard, StashItemRow, stashItemName } from './StashFileCard';
import { stashCopies, stashStops, type Picked } from './stashOut';
import { keptText } from './dropImport';
import { TripShape } from './TripShape';

/** A folder, a trip or a file of the Stash, as what is selected, moved and deleted together. */
type Item = { folder: Folder } | { trip: TripSummary } | { file: StashFile };

/** The top of the trips, as a place to paste into. */
const ALL_TRIPS = TAB_NAMES.trips;

/** What a tree says while it holds nothing. */
const EMPTY: Record<TreeTab, string> = {
  stash: t('The Stash is empty. Drop GPX files and folders here, or add them from the menu above.'),
  trips: t('No trips yet. Start one from the menu above, or drop GPX files here.'),
  places: t('No lists of places yet. Start one from the menu above, or drop GPX files of waypoints here.'),
};

/** The list that holds the selection of a tree's folders and trips. */
const ownerOf = (tree: TreeTab): string => `library:${tree}`;

/** A route or a track the search found by its name: its trip, its day and what the day is called there. */
export interface FoundRoute {
  within: TripSummary;
  dayId: string;
  day: string;
  route: NamedRoute;
}
const routeKey = (found: FoundRoute): string => `route:${found.route.id}`;

/** A route or a track of a file of the Stash, with its file. */
interface FileItem {
  file: StashFile;
  item: StashItem;
}
const itemKey = ({ file, item }: FileItem): string => `item:${file.id}:${item.kind}:${item.position}`;

const keyOf = (item: Item): string => ('folder' in item ? `folder:${item.folder.id}` : 'trip' in item ? `trip:${item.trip.id}` : `file:${item.file.id}`);
const nameOf = (item: Item): string => ('folder' in item ? item.folder : 'trip' in item ? item.trip : item.file).name;
const itemOfFolder = (folder: Folder | undefined): Item | undefined => folder && { folder };
const itemOfTrip = (trip: TripSummary | undefined): Item | undefined => trip && { trip };
const foldersOf = (items: readonly Item[]): Folder[] => items.flatMap((item) => ('folder' in item ? [item.folder] : []));
const tripsOf = (items: readonly Item[]): TripSummary[] => items.flatMap((item) => ('trip' in item ? [item.trip] : []));
const filesOf = (items: readonly Item[]): StashFile[] => items.flatMap((item) => ('file' in item ? [item.file] : []));

/** How a card takes part in the selection: whether it is selected or cut, what its pad does, and what a click does to the selection. */
export interface CardSelect {
  selected: () => boolean;
  cut: () => boolean;
  onToggle: () => void;
  /** Whether the click selected, and so opens nothing. */
  onClick: (e: MouseEvent) => boolean;
  onDrag: (e: PointerEvent, dragged: () => void) => void;
}

/** How a row that stays where it is is selected, a route the search found or a route or track of a file: as a card is, but it is neither cut nor dragged. */
export type RowSelect = Pick<CardSelect, 'selected' | 'onToggle' | 'onClick'>;

/** How a card unfolds in the tree, whether it holds the tree's one mark, and of a trip whether it is the open one. */
export interface CardFold {
  unfolded: () => boolean;
  current: () => boolean;
  open?: () => boolean;
}

/** The browser's preference that keeps what is unfolded in the tree. */
const UNFOLDED = 'libraryUnfolded';

/**
 * The days of a trip that is not open, as the library knows them, drawn as the open trip
 * draws its own: a click opens the trip at the day. What needs the trip's document (the
 * grip that reorders, the journal, the recordings) comes with opening it.
 */
function TripDays(props: { trip: TripSummary; onOpen: (dayId: string) => void }) {
  const collection = () => props.trip.kind === 'collection';
  const days = () => outlineOf(props.trip.id) ?? [];
  const places = createMemo(() => kindAround(libraryFolders() ?? [], props.trip.folderId) === 'places');
  return (
    <ol class="days">
      <ForById each={days()}>
        {(day, index) => (
          <li class="day card">
            <div class="row">
              <Show when={!collection()}>
                <span class="grip-space" />
              </Show>
              <button class="text grow" onClick={() => props.onOpen(day().id)}>
                <span class="lines">
                  <span class="name">{dayHeading(props.trip.kind, index(), day().name)}</span>
                  <span class="muted detail">{dayDetail(props.trip.kind, day(), places())}</span>
                </span>
              </button>
            </div>
          </li>
        )}
      </ForById>
      <Show when={days().length === 0}>
        <li class="muted no-days">{t(collection() ? 'No sections yet.' : 'No days yet.')}</li>
      </Show>
    </ol>
  );
}

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** What a folder's menu makes new in it. */
type NewKind = 'folder' | 'trip' | 'list' | 'kind';

/** How the dialog that names a new folder, trip, list of places or kind of place reads. */
const NEW_DIALOG: Record<NewKind, { title: string; placeholder: string; submit: string }> = {
  folder: { title: t('New folder'), placeholder: t('Name of the folder'), submit: t('Create') },
  trip: { title: t('New trip'), placeholder: t('Name of the trip'), submit: t('Start') },
  list: { title: t('New list of places'), placeholder: t('Name of the list'), submit: t('Start') },
  kind: { title: t('New kind of place'), placeholder: t('Name of the kind'), submit: t('Create') },
};

/** The dialog the library has open: a new name for a folder, a trip or a file, or the name of a new one in a folder, null for the top; of a new kind of place, in the list `into`. */
type LibraryDialog = { kind: 'rename-folder'; folder: Folder } | { kind: 'rename-trip'; trip: TripSummary } | { kind: 'rename-file'; file: StashFile } | { kind: 'rename-item'; at: FileItem } | { kind: 'new'; what: NewKind; into: number | null };

/**
 * The library as a tree: folders and trips unfolding in place, the open trip's days among
 * them, or what the search found across all folders. Its rows are opened, selected, cut,
 * copied, pasted into, moved, merged, renamed, exported and deleted.
 */
export function Library(props: {
  onOpen: (trip: TripSummary, dayId?: string) => void;
  /** Opens a route the search found, in its trip and day. */
  onOpenRoute: (found: FoundRoute) => void;
  onOpenFolder: (id: number) => void;
  /** Leaves the open trip, saved: before the library changes it behind its back. */
  onLeave: () => Promise<void>;
  /** What stands under the open trip in the tree: its days, or a collection's sections. */
  children: JSX.Element;
}) {
  const [dialog, setDialog] = createSignal<LibraryDialog>();
  const imports = libraryImports(props.onLeave);
  const folders = () => libraryFolders() ?? [];
  const trips = () => libraryTrips() ?? [];
  const files = () => (stashFiles.error ? [] : (stashFiles() ?? []));
  const pathOf = (id: number | null) => folderPath(folders(), id);

  /** The folders and trips unfolded in the tree, by key; this browser keeps them. */
  const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>(new Set(JSON.parse(readPreference(UNFOLDED) ?? '[]') as string[]));
  const isUnfolded = (item: Item): boolean => unfolded().has(keyOf(item));
  const fold = (keys: readonly string[], unfold: boolean) => {
    const next = new Set(unfolded());
    for (const key of keys) {
      if (unfold) next.add(key);
      else next.delete(key);
    }
    setUnfolded(next);
    writePreference(UNFOLDED, JSON.stringify([...next]));
  };
  /** The keys of the folders a folder lies in, itself first; none for the top. */
  const keysAround = (folderId: number | null): string[] => {
    const keys: string[] = [];
    for (let f = folders().find((folder) => folder.id === folderId); f; f = folders().find((folder) => folder.id === f!.parentId)) keys.push(keyOf({ folder: f }));
    return keys;
  };
  // The folders a trip lies in unfold when it opens, so that it is in view, and the trip itself once a day of it is shown, wherever that was asked for: the day's row is then in view as if it had been clicked.
  createEffect(
    on([openTripId, selectedDayId], ([id, dayId], before) => {
      // A day that closes leaves the tree as it is: it may have closed because its folder was folded.
      if (dayId === undefined && before?.[0] === id) return;
      const trip = trips().find((candidate) => candidate.id === id);
      const keys = [...(trip && dayId !== undefined ? [keyOf({ trip })] : []), ...(trip ? keysAround(trip.folderId) : [])];
      if (keys.some((key) => !unfolded().has(key))) fold(keys, true);
    }),
  );
  /** The folders in a folder, null for the top of the trips; the special folders are in none, each the top of its own tree. */
  const childFolders = (parent: number | null) => folders().filter((f) => f.parentId === parent && f.kind === 'folder');
  const childTrips = (parent: number | null) => trips().filter((trip) => trip.folderId === parent);
  const childFiles = (parent: number | null) => files().filter((file) => file.folderId === parent);
  /** Whether the folder, null for the top of the trips, holds its tree's one mark: it is the folder marked there, and the mark is not on the open trip or its day. */
  const isMarkedFolder = (id: number | null): boolean => markedFolderOf(treeOf(id)) === id && !(isMarkInTrip() && openTree() === treeOf(id));
  /** Gives its tree's mark to a folder, null for the top of the trips, which makes it the one shown; the mark on the open trip in another tree stays. */
  const markFolderShown = (id: number | null) => {
    showFolder(id);
    if (openTree() === treeOf(id)) markFolder();
  };
  /** The keys of all a folder holds, at any depth; null is the top of the trips. */
  const keysWithin = (id: number | null): string[] => [
    ...childFolders(id).flatMap((f) => [keyOf({ folder: f }), ...keysWithin(f.id)]),
    ...childTrips(id).map((trip) => keyOf({ trip })),
    ...childFiles(id).map((file) => keyOf({ file })),
  ];
  /**
   * A click on a folder marks it, which makes it the one that takes what is pasted with the keys,
   * and unfolds it; marked and unfolded already, it folds. A folder that folds takes all it holds with it:
   * its folders and trips fold too, and the day shown of an open trip among them closes.
   */
  const clickFolder = (f: Folder) => {
    const key = keyOf({ folder: f });
    if (unfolded().has(key) && isMarkedFolder(f.id)) {
      fold([key, ...keysWithin(f.id)], false);
      if (holdsOpen([{ folder: f }])) selectDay(undefined);
    } else fold([key], true);
    markFolderShown(f.id);
  };
  /** Folds away every folder and trip of a tree, by its top, which closes the day shown with its trip where that is among them. */
  const foldAll = (root: number | null) => {
    fold(keysWithin(root), false);
    if (openTree() === treeOf(root)) selectDay(undefined);
  };
  /** Whether the trip is the open one and holds the mark, rather than the day of it that is shown. */
  const isMarkedTrip = (trip: TripSummary): boolean => trip.id === openTripId() && isTripMarked();
  /**
   * A click on a trip, which is a folder of days. It marks the trip and unfolds it: one
   * that is not open opens, and the open one closes its day that is shown. Marked
   * already, the trip folds, and unfolds again at the next click.
   */
  const clickTrip = (trip: TripSummary) => {
    const key = keyOf({ trip });
    if (isMarkedTrip(trip)) return fold([key], !unfolded().has(key));
    fold([key], true);
    if (trip.id === openTripId()) markTrip();
    else props.onOpen(trip);
  };
  /** A click on a file unfolds it and shows it whole on the map; shown whole already, it folds and leaves the map. */
  const clickFile = (file: StashFile) => {
    const key = keyOf({ file });
    const whole = shownInStash()?.fileId === file.id && !shownInStash()!.item;
    fold([key], !(whole && unfolded().has(key)));
    showInStash(whole && unfolded().has(key) ? undefined : { fileId: file.id });
  };
  /** A click on a route or a track of a file shows it alone on the map; shown alone already, it gives way to its file whole. */
  const showItem = (file: StashFile, item: StashItem) =>
    showInStash(shownInStash()?.fileId === file.id && shownInStash()!.item?.kind === item.kind && shownInStash()!.item?.position === item.position ? { fileId: file.id } : { fileId: file.id, item });
  /** Shows a file the search found where it is in the tree, unfolded, and on the map: whole, or the one route or track of it. */
  const revealFile = (file: StashFile, item?: StashItem) => {
    fold([keyOf({ file }), ...keysAround(file.folderId)], true);
    showFolder(file.folderId);
    showInStash({ fileId: file.id, item });
  };
  /** Whether what is acted on holds the open trip, which the library must not change behind its back. */
  const holdsOpen = (items: readonly Item[]): boolean => tripsWithin(items).some((trip) => trip.id === openTripId());

  /** Asks to delete the folder and, when it holds anything, whether that moves up or goes with it; undefined when the user cancels. */
  const askFolderDeletion = async (f: Folder): Promise<'move' | 'delete' | undefined> => {
    const contentsText = (held: { folders: number; trips: number }) => countsText(held.folders, held.trips, heldNoun(f.id));
    const own = contentsText(heldOf(f.id));
    if (!own) return (await askConfirmation(t('Delete the folder “{name}”?', { name: f.name }), t('Delete'))) ? 'move' : undefined;
    const all = contentsText(heldInAll(folders(), heldOf, f.id));
    const where = f.parentId === null ? t('to the top') : t('into “{path}”', { path: pathOf(f.parentId) });
    const question = t(
      all === own
        ? 'The folder “{name}” holds {own}. Move them {where} and delete the folder, or delete it with everything in it?'
        : 'The folder “{name}” holds {own} ({all} in all). Move them {where} and delete the folder, or delete it with everything in it?',
      { name: f.name, own, all, where },
    );
    const deleteAll = t('Delete all');
    const choice = await askChoice(question, [deleteAll, t('Move contents')]);
    return choice === undefined ? undefined : choice === deleteAll ? 'delete' : 'move';
  };
  const removeFolder = async (f: Folder) => {
    const contents = await askFolderDeletion(f);
    if (!contents) return;
    await runLibrary(() => deleteFolder(f.id, contents), () => {
      relistFolders();
      relistTrips();
      relistStash();
    });
  };
  /** The tree shown; none while the rides are. */
  const shownTree = (): TreeTab | undefined => TREE_TABS.find((tree) => tree === libraryTab());
  /**
   * The folders and trips selected in the tree shown to be acted on together, by key, the
   * first selected first. A tree keeps its selection while another is shown, where the
   * keys do not reach it, and lets go of it once another of its folders is marked.
   */
  const selected = (): Selection<string> => {
    const tree = shownTree();
    return tree ? selectionOf(ownerOf(tree)) : NOTHING_SELECTED;
  };
  const setSelected = (rows: Selection<string>) => {
    const tree = shownTree();
    if (tree) selectIn(ownerOf(tree), rows);
  };
  for (const tree of TREE_TABS) createEffect(on(() => markedFolderOf(tree), () => selectIn(ownerOf(tree), NOTHING_SELECTED), { defer: true }));
  // What a search lists is not what was listed before: nothing stays selected out of view.
  createEffect(on(query, () => TREE_TABS.forEach((tree) => selectIn(ownerOf(tree), NOTHING_SELECTED)), { defer: true }));
  const isSelected = createSelector(selected, (key: string, keys) => keys.has(key));
  /** Every folder, trip and file there is, by key; none for the key of a route. */
  const itemOf = (key: string): Item | undefined => {
    const id = Number(key.slice(key.indexOf(':') + 1));
    if (key.startsWith('folder:')) return itemOfFolder(folders().find((f) => f.id === id));
    if (key.startsWith('file:')) return files().flatMap((file) => (file.id === id ? [{ file }] : []))[0];
    return key.startsWith('trip:') ? itemOfTrip(trips().find((t) => t.id === id)) : undefined;
  };
  /** A trip's days with their routes: the open trip's as it is edited, another's with those that have a name, as its outline lists them. */
  const routeDaysOf = (trip: TripSummary): readonly { id: string; name: string; routes: readonly NamedRoute[] }[] =>
    trip.id === openTripId() ? openTrip()!.days : (outlineOf(trip.id) ?? []).map((day) => ({ id: day.id, name: day.name, routes: day.namedRoutes }));
  /** What the search finds in the tree shown: its folders, trips and files by name, whatever folder they are in, and the routes and tracks of its trips and files by theirs. */
  const found = createMemo(() => {
    const text = searchedFor();
    const tree = shownTree();
    if (!text || !tree) return { folders: [], trips: [], files: [], routes: [], items: [] };
    const isFound = (named: { name: string }) => named.name.toLowerCase().includes(text);
    const inTree = trips().filter((trip) => treeOf(trip.folderId) === tree);
    const inStash = tree === 'stash' ? files() : [];
    return {
      files: inStash.filter(isFound),
      items: inStash.flatMap((file) => file.items.filter(isFound).map((item) => ({ file, item }))),
      folders: folders().filter((f) => f.kind === 'folder' && treeOf(f.id) === tree && isFound(f)),
      trips: inTree.filter(isFound),
      routes: inTree.flatMap((trip) =>
        routeDaysOf(trip).flatMap((day, index) => day.routes.filter(isFound).map((route): FoundRoute => ({ within: trip, dayId: day.id, day: dayHeading(trip.kind, index, day.name), route }))),
      ),
    };
  });
  /** Of what the search found, what is listed: folders first, then trips and files, then their routes and tracks, up to the limit. */
  const listed = createMemo(() => {
    let left = SEARCH_LIMIT;
    const upTo = <Row,>(rows: Row[]): Row[] => rows.slice(0, left).map((row) => (left--, row));
    return { folders: upTo(found().folders), trips: upTo(found().trips), files: upTo(found().files), routes: upTo(found().routes), items: upTo(found().items) };
  });
  /** The rows the search lists that are selected, top to bottom, by key. */
  const listedKeys = (): string[] => [
    ...listed().folders.map((folder) => keyOf({ folder })),
    ...listed().trips.map((trip) => keyOf({ trip })),
    ...listed().files.map((file) => keyOf({ file })),
    ...listed().routes.map(routeKey),
    ...listed().items.map(itemKey),
  ];
  /** The routes and tracks of files among the rows selected. */
  const itemsIn = (keys: Selection<string>): FileItem[] =>
    [...keys].some((key) => key.startsWith('item:')) ? files().flatMap((file) => file.items.map((item) => ({ file, item })).filter((at) => keys.has(itemKey(at)))) : [];
  /** The routes among the rows selected, as the search found them. */
  const routesIn = (keys: Selection<string>): FoundRoute[] => found().routes.filter((route) => keys.has(routeKey(route)));
  /** The rows in view under a folder, top to bottom: its folders with those of every unfolded folder in it, its trips, and its files with the routes and tracks of every unfolded one. */
  const shownKeys = (parent: number | null): string[] => [
    ...childFolders(parent).flatMap((f) => [keyOf({ folder: f }), ...(isUnfolded({ folder: f }) ? shownKeys(f.id) : [])]),
    ...childTrips(parent).map((trip) => keyOf({ trip })),
    ...childFiles(parent).flatMap((file) => [keyOf({ file }), ...(isUnfolded({ file }) ? file.items.map((item) => itemKey({ file, item })) : [])]),
  ];
  /** What a card's menu, or a press on its pad, acts on: the selection where it holds the card, else the card alone. */
  const chosenWith = (item: Item, selection: Selection<string> = selected()): Item[] => (selection.has(keyOf(item)) ? [...selection].flatMap((key) => itemOf(key) ?? []) : [item]);
  /** How a folder's or a trip's card is selected, among the rows of the tree or, found by the search, among those it lists. */
  const select = (item: Item, order: () => string[] = () => shownKeys(rootOf(shownTree()!))): CardSelect => ({
    selected: () => isSelected(keyOf(item)),
    cut: () => isCut(item),
    // A card is clicked in the tree shown, which is its own.
    onToggle: () => toggleRow(ownerOf(shownTree()!), keyOf(item)),
    onClick: (e: MouseEvent) => clickRow(ownerOf(shownTree()!), order(), keyOf(item), e),
    onDrag: (e: PointerEvent, dragged: () => void) => {
      const moved = chosenWith(item);
      dragToFolder(e, moved.length === 1 ? nameOf(item) : countText(moved), (into) => moveInto(moved, into), dragged);
    },
  });
  /** How a route or a track of a file is selected, among the rows of the tree or those the search lists. */
  const selectItem = (at: FileItem, order: () => string[] = () => shownKeys(rootOf(shownTree()!))): RowSelect => ({
    selected: () => isSelected(itemKey(at)),
    onToggle: () => toggleRow(ownerOf(shownTree()!), itemKey(at)),
    onClick: (e: MouseEvent) => clickRow(ownerOf(shownTree()!), order(), itemKey(at), e),
  });
  /** How a route the search found is selected, among the rows it lists. */
  const selectRoute = (route: FoundRoute): RowSelect => ({
    selected: () => isSelected(routeKey(route)),
    onToggle: () => toggleRow(ownerOf(shownTree()!), routeKey(route)),
    onClick: (e: MouseEvent) => clickRow(ownerOf(shownTree()!), listedKeys(), routeKey(route), e),
  });
  const isCut = (item: Item): boolean => {
    const cut = libraryClip();
    return cut !== undefined && cut.move && ('folder' in item ? cut.folderIds.includes(item.folder.id) : 'trip' in item && cut.tripIds.includes(item.trip.id));
  };
  /** How many folders, trips and files: 2 folders and 3 trips. */
  const countText = (items: readonly Item[]): string => {
    const parts = ([[foldersOf(items).length, 'folder'], [tripsOf(items).length, 'trip'], [filesOf(items).length, 'file']] as const).flatMap(([n, noun]) => (n > 0 ? [counted(n, noun)] : []));
    return parts.length > 1 ? t('{a} and {b}', { a: parts.slice(0, -1).join(', '), b: parts.at(-1)! }) : (parts[0] ?? '');
  };
  /** Lists the library afresh, nothing selected: after folders or trips were moved, merged, pasted or deleted. */
  const relist = () => {
    setSelected(NOTHING_SELECTED);
    relistFolders();
    relistTrips();
    relistStash();
  };
  /** The trips among the items and those in their folders, at any depth. */
  const tripsWithin = (items: readonly Item[]): TripSummary[] => {
    const inside = new Set(foldersOf(items).map((f) => f.id));
    for (let grown = true; grown; ) {
      grown = false;
      for (const f of folders()) if (f.parentId !== null && inside.has(f.parentId) && !inside.has(f.id)) grown = inside.add(f.id).size > 0;
    }
    return [...tripsOf(items), ...trips().filter((trip) => trip.folderId !== null && inside.has(trip.folderId))];
  };
  const remove = async (doomed: readonly Item[]) => {
    const [only] = doomed;
    if (doomed.length === 1 && 'folder' in only!) return removeFolder(only.folder);
    const one = doomed.length === 1 && ('trip' in only! ? t('Delete the trip “{name}” with all its days?', { name: only.trip.name }) : t('Delete the file “{name}”?', { name: nameOf(only!) }));
    const all = foldersOf(doomed).length > 0 ? 'Delete {what} with everything in them?' : tripsOf(doomed).length > 0 ? 'Delete {what} with all their days?' : 'Delete {what}?';
    if (!(await askConfirmation(one || t(all, { what: countText(doomed) }), t('Delete')))) return;
    if (holdsOpen(doomed)) await props.onLeave();
    if (filesOf(doomed).some((file) => file.id === shownInStash()?.fileId)) showInStash(undefined);
    await runLibrary(
      () => Promise.all([...tripsOf(doomed).map((trip) => deleteTrip(trip.id)), ...foldersOf(doomed).map((f) => deleteFolder(f.id, 'delete')), ...filesOf(doomed).map((file) => deleteStashFile(file.id))]),
      relist,
    );
  };
  /** Deletes routes the search found from their trips, once that is confirmed. */
  const removeRoutes = async (doomed: readonly FoundRoute[]) => {
    const [only] = doomed;
    const question =
      doomed.length === 1
        ? t('Delete the route “{name}” from {where}?', { name: only!.route.name, where: `${only!.within.name} › ${only!.day}` })
        : t('Delete {n} routes from {trips}?', { n: doomed.length, trips: counted(new Set(doomed.map((route) => route.within.id)).size, 'trip') });
    if (!(await askConfirmation(question, t('Delete')))) return;
    await runLibrary(() => deleteRoutes(doomed.map((route) => ({ tripId: route.within.id, routeId: route.route.id }))), () => setSelected(NOTHING_SELECTED));
  };
  /**
   * The menu of what is selected once routes the search found are among it: it deletes
   * them, and where folders or trips are selected besides, says that they are not
   * deleted together.
   */
  const routesMenu = (selection: Selection<string>): MenuItem[] => {
    const routes = routesIn(selection);
    const others = [...selection].flatMap((key) => itemOf(key) ?? []);
    const what = [others.length > 0 && countText(others), counted(routes.length, 'route')].filter(Boolean).join(', ');
    const nothing = () => undefined;
    return [
      ...(selection.size > 1 ? [{ label: t('{what} selected', { what }), disabled: true, run: nothing }] : []),
      others.length > 0 ? { label: t('Routes are not deleted together with folders and trips'), disabled: true, run: nothing } : { label: t('Delete'), run: () => void removeRoutes(routes) },
    ];
  };
  /** The menu of a route the search found: for the selected rows, or for it alone where it is not selected. */
  const routeMenu = (route: FoundRoute): MenuItem[] => {
    const selection = menuSelection(selected(), routeKey(route));
    setSelected(selection.size > 1 ? selection : NOTHING_SELECTED);
    return routesMenu(selection);
  };
  const merge = async (into: TripSummary, others: TripSummary[]) => {
    const what = counted(others.length, into.kind);
    const where = t(into.kind === 'collection' ? 'Their sections move into it' : 'Their days and journal move into it, a day onto its day of the same date where it has one');
    const question = plural(others.length, 'Merge {what} into “{name}”? {where}, and the merged one is deleted.|Merge {what} into “{name}”? {where}, and the merged ones are deleted.', { what, name: into.name, where });
    if (!(await askConfirmation(question, t('Merge')))) return;
    if (holdsOpen([{ trip: into }, ...others.map((trip) => ({ trip }))])) await props.onLeave();
    await runLibrary(() => mergeTrips(into.id, others.map((t) => t.id)), relist);
  };
  /** What a folder holds besides folders, as it is counted: trips, in the Stash files or, among the places, lists. */
  const heldNoun = (id: number | null) => ({ folder: 'trip', collections: 'file', places: 'list' } as const)[kindAround(folders(), id)];
  /** Says of a folder, null for the top, whether it takes the items: lists of places go among the Places, trips into the other folders, and files into the Stash alone. */
  const takerOf = (items: readonly Item[]) => {
    const within = tripsWithin(items);
    const files = filesOf(items).length > 0;
    return (into: number | null): boolean => {
      const around = kindAround(folders(), into);
      return within.every((trip) => (trip.kind === 'collection' ? 'places' : 'folder') === around) && (!files || around === 'collections');
    };
  };
  /** Refuses, as the server would, to put the items into a folder that does not hold their kind. */
  const assertFits = (items: readonly Item[], into: number | null) => {
    if (!takerOf(items)(into)) throw new Error(t('Lists of places are kept among the Places, files in the Stash, trips in the other folders.'));
  };
  /** Moves folders, trips and files into a folder, none for the top, those not in it already; the server refuses a folder inside itself. */
  const moveInto = (moved: readonly Item[], into: number | null) => {
    const goingTrips = tripsOf(moved).filter((trip) => trip.folderId !== into);
    const goingFolders = foldersOf(moved).filter((f) => f.id !== into && f.parentId !== into);
    const goingFiles = filesOf(moved).filter((file) => file.folderId !== into);
    if (goingTrips.length + goingFolders.length + goingFiles.length === 0) return;
    void runLibrary(async () => {
      assertFits(moved, into);
      await Promise.all([...goingTrips.map((trip) => moveTrip(trip.id, into)), ...goingFolders.map((f) => moveFolder(f.id, into)), ...goingFiles.map((file) => moveStashFile(file.id, into!))]);
    }, relist);
  };
  /** Move… with the folders that take what is moved as its submenu, and none for the top; none where there is nowhere to go. */
  const moveItem = (moved: readonly Item[]): MenuItem[] => {
    const [first] = moved;
    const from = 'folder' in first! ? first.folder.parentId : ('trip' in first! ? first.trip : first!.file).folderId;
    const movedFolders = new Set(foldersOf(moved).map((f) => f.id));
    const takes = takerOf(moved);
    const places: MenuItem[] = [
      ...(from === null || !takes(null) ? [] : [{ label: t('No folder'), run: () => moveInto(moved, null) }]),
      ...folders()
        .filter((f) => f.id !== from && !movedFolders.has(f.id) && takes(f.id))
        .map((f) => ({ label: pathOf(f.id), run: () => moveInto(moved, f.id) }))
        .sort((x, y) => x.label.localeCompare(y.label)),
    ];
    return places.length > 0 ? [{ label: t('Move…'), items: places }] : [];
  };
  /** What the clipboard holds of the library, by number: 2 folders and 3 trips. */
  const clipText = (copied: LibraryClip): string => countsText(copied.folderIds.length, copied.tripIds.length);
  /** The folders and trips on the clipboard, those still there. */
  const clipItems = (copied: LibraryClip): Item[] => [...folders().filter((f) => copied.folderIds.includes(f.id)).map((folder) => ({ folder })), ...trips().filter((trip) => copied.tripIds.includes(trip.id)).map((trip) => ({ trip }))];
  /** Pastes the folders and trips on the clipboard into a folder, which empties it: cut, they move there; copied, each trip gets a copy there. */
  const pasteLibrary = (into: number | null) => {
    const copied = libraryClip();
    if (!copied) return;
    const items = clipItems(copied);
    // A paste the folder refuses leaves the clipboard as it was.
    if (takerOf(items)(into)) clearClip();
    if (copied.move) return moveInto(items, into);
    void runLibrary(async () => {
      assertFits(items, into);
      await Promise.all(copied.tripIds.map(async (id) => moveTrip((await duplicateTrip(id)).id, into)));
    }, relist);
  };
  const renamedFolder = () => {
    const d = dialog();
    return d?.kind === 'rename-folder' ? d.folder : undefined;
  };
  const renamedTrip = () => {
    const d = dialog();
    return d?.kind === 'rename-trip' ? d.trip : undefined;
  };
  const renamedFile = () => {
    const d = dialog();
    return d?.kind === 'rename-file' ? d.file : undefined;
  };
  const renamedItem = () => {
    const d = dialog();
    return d?.kind === 'rename-item' ? d.at : undefined;
  };
  const newIn = () => {
    const d = dialog();
    return d?.kind === 'new' ? d : undefined;
  };
  /** How the dialog for something new reads; a folder's while it is closed. */
  const newTexts = () => NEW_DIALOG[newIn()?.what ?? 'folder'];
  /** Export, which downloads the trips as a zip once the open one is saved. */
  const exportItem = (of: readonly TripSummary[]): MenuItem => ({ label: t('Export'), disabled: of.length === 0, run: () => void flushSave().then(() => window.location.assign(tripArchiveUrl(of.map((trip) => trip.id)))) });
  /** Makes a folder, or a trip or collection, which is opened, in a folder, null for the top; the folder unfolds so that what is new is in view. A kind of place is a section of the list `into`. */
  const createNew = (what: NewKind, into: number | null, name: string) => {
    if (what === 'kind') return addSectionTo(into!, name);
    const parent = folders().find((f) => f.id === into);
    if (parent) fold([keyOf({ folder: parent })], true);
    if (what === 'folder') void runLibrary(() => createFolder(name, into), relistFolders);
    else void runLibrary(async () => props.onOpen(await createTrip(name, into, what === 'trip' ? 'trip' : 'collection')), relistTrips);
  };
  /** A new section of the name in the collection: in the open one as an edit, in another on the server. */
  const addSectionTo = (tripId: number, name: string) =>
    tripId === openTripId() ? addSection(name) : void runLibrary(() => changeTrip(tripId, (loaded) => withImportedDay(loaded, { name, date: null }, [])), relistTrips);
  /** New, with what the folder, null for the top, takes as its submenu: a folder, and a trip or, where it holds them, a collection or a list of places. */
  const newItem = (into: number | null): MenuItem => {
    const what = heldNoun(into);
    return {
      label: t('New'),
      items: [
        { label: t('Folder…'), run: () => setDialog({ kind: 'new', what: 'folder', into }) },
        // The Stash holds what is imported into it; nothing is started there.
        ...(what === 'file' ? [] : [{ label: t(what === 'trip' ? 'Trip…' : 'List of places…'), run: () => setDialog({ kind: 'new', what, into }) }]),
      ],
    };
  };
  /** Add, with what is picked from the computer and imported into the folder, null for the top, as its submenu. */
  const addItem = (into: number | null): MenuItem => ({
    label: t('Add'),
    items: [
      { label: t('Files…'), run: () => void imports.addFiles(into) },
      { label: t('Folder…'), run: () => void imports.addFolder(into) },
    ],
  });
  /** Pastes copied routes into the trip where an import would put them, and saves it. */
  const pasteInto = (tripId: number, routes: CopiedRoute[]) => changeTrip(tripId, (trip) => pasteIntoTrip(trip, routes, newId));
  /** What is pasted into the one folder or trip: folders and trips into a folder, routes and days into a trip. Nothing is pasted into the Stash. */
  const pasteItems = (item: Item): MenuItem[] => {
    if ('folder' in item) {
      const f = item.folder;
      const copied = libraryClip();
      return copied && takerOf(clipItems(copied))(f.id) ? [{ label: t('Paste'), run: () => pasteLibrary(f.id) }] : [];
    }
    if ('file' in item) return [];
    const id = item.trip.id;
    /** The open trip is left, saved, before it is changed on the server. */
    const left = async (paste: () => Promise<unknown>) => {
      if (holdsOpen([item])) await props.onLeave();
      await runLibrary(paste, relistTrips);
    };
    return libraryPasteItem({
      routes: (routes) => left(() => pasteInto(id, routes)),
      days: (days) => left(() => changeTrip(id, (trip) => pasteDays(trip, days, undefined, newId))),
    });
  };
  /** Puts folders and trips on the clipboard: cut, to be moved where they are pasted; copied, which only trips are. */
  const clip = (chosen: readonly Item[], move: boolean) => copyLibraryItems({ tripIds: tripsOf(chosen).map((trip) => trip.id), folderIds: foldersOf(chosen).map((f) => f.id), move });
  /**
   * The keys that cut, copy and delete the selected folders and trips, and paste those on
   * the clipboard into the folder shown, as the menu does; none while the rides are
   * shown. With routes the search found selected, or routes and tracks of files,
   * Delete deletes them where nothing else is selected, and the other keys do nothing.
   */
  const onKey = (e: KeyboardEvent) => {
    const verb = fileVerb(e);
    if (!verb) return;
    const chosen = [...selected()].flatMap((key) => itemOf(key) ?? []);
    const routes = routesIn(selected());
    const parts = itemsIn(selected());
    if (routes.length + parts.length > 0) {
      if (verb !== 'delete' || chosen.length > 0) return;
      e.preventDefault();
      return void (routes.length > 0 ? removeRoutes(routes) : removeItems(parts));
    }
    if (!shownTree() || (verb === 'paste' ? !libraryClip() : chosen.length === 0) || (verb === 'copy' && foldersOf(chosen).length > 0)) return;
    e.preventDefault();
    if (verb === 'paste') pasteLibrary(shownFolderId());
    else if (verb === 'delete') void remove(chosen);
    else clip(chosen, verb === 'cut');
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));

  /** Adds a day at the end of a trip: of the open one as an edit that can be undone, which shows the day; of another on the server. */
  const addDayTo = (trip: TripSummary) => (trip.id === openTripId() ? addDay() : void runLibrary(() => changeTrip(trip.id, (loaded) => withDayAdded(loaded, newId())), relistTrips));

  /** Takes something out of the Stash and says, where the imports say what they did, what came of it. */
  const takeOut = (work: () => Promise<string>) => void runLibrary(async () => setImportNote({ text: await work(), errors: [] }));
  /** Copies routes and tracks of the Stash, to be pasted into a day. */
  const copyOut = (picked: readonly Picked[]) =>
    takeOut(async () => {
      const copies = await stashCopies(picked);
      if (copies.length === 0) return t('No routes or tracks in there.');
      copyRoutes(copies);
      return t('Copied {what}: paste from the menu of a day or a trip.', { what: counted(copies.length, 'route') });
    });
  /** Copies the waypoints of files of the Stash, to be pasted as stops or as places. */
  const copyWaypoints = (of: readonly StashFile[]) =>
    takeOut(async () => {
      const stops = await stashStops(of);
      copyStops(stops);
      return t('Copied {what}: paste from the menu of a day, or of a kind in a list of places.', { what: counted(stops.length, 'waypoint') });
    });
  /** Keeps tracks of the Stash as rides, which the rides then list. */
  const keepRides = (picked: readonly Picked[]) =>
    takeOut(async () => {
      let [kept, known] = [0, 0];
      for (const { file, items } of picked) {
        const count = await keepStashRides(file.id, items?.map((item) => item.position));
        kept += count.kept;
        known += count.known;
      }
      ridesChanged();
      return keptText(kept, known, 'ride', t('No tracks in there.'));
    });
  /**
   * The menu of what is selected once files of the Stash are among it. Files alone are
   * taken out of the Stash: their routes and tracks copied, their waypoints copied,
   * their tracks kept as rides. One file is renamed, and files, with the folders
   * selected beside them, are moved and deleted.
   */
  const filesMenu = (chosen: readonly Item[]): MenuItem[] => {
    const several = chosen.length > 1;
    const chosenFiles = filesOf(chosen);
    const onlyFiles = chosenFiles.length === chosen.length;
    const whole = chosenFiles.map((file) => ({ file }));
    return [
      ...(several ? [{ label: t('{what} selected', { what: countText(chosen) }), disabled: true, run: () => undefined }] : []),
      { label: t('Copy routes and tracks'), disabled: !onlyFiles || chosenFiles.every((file) => file.items.length === 0), run: () => copyOut(whole) },
      { label: t('Copy waypoints'), disabled: !onlyFiles || chosenFiles.every((file) => file.waypoints === 0), run: () => copyWaypoints(chosenFiles) },
      { label: t('Keep tracks as rides'), disabled: !onlyFiles || !chosenFiles.some((file) => file.items.some((item) => item.kind === 'track')), run: () => keepRides(whole) },
      { label: t('Rename…'), disabled: several, run: () => setDialog({ kind: 'rename-file', file: chosenFiles[0]! }) },
      ...moveItem(chosen),
      { label: t('Delete'), run: () => void remove(chosen) },
    ];
  };
  /** Routes and tracks by their files, as what is taken of each. */
  const pickedOf = (parts: readonly FileItem[]): Picked[] => [...new Set(parts.map((at) => at.file))].map((file) => ({ file, items: parts.filter((at) => at.file === file).map((at) => at.item) }));
  /** Deletes routes and tracks from their files, once that is confirmed, which rewrites the files; one of them shown alone on the map gives way to its file. */
  const removeItems = async (doomed: readonly FileItem[]) => {
    const [only] = doomed;
    const picked = pickedOf(doomed);
    const question =
      doomed.length === 1
        ? t('Delete “{name}” from the file “{file}”?', { name: stashItemName(only!.item), file: only!.file.name })
        : t('Delete {n} routes and tracks from {files}?', { n: doomed.length, files: counted(picked.length, 'file') });
    if (!(await askConfirmation(question, t('Delete')))) return;
    await runLibrary(() => Promise.all(picked.map(({ file, items }) => removeStashItems(file.id, items!))), () => {
      const shown = shownInStash();
      if (shown?.item && picked.some(({ file }) => file.id === shown.fileId)) showInStash({ fileId: shown.fileId });
      stashEdited();
      relist();
    });
  };
  /**
   * The menu of what is selected once routes and tracks of files are among it. They
   * are copied to be pasted into a day, the tracks kept as rides, one renamed, and
   * deleted from their files. With anything else selected besides, it says that they
   * are not acted on together.
   */
  const itemsMenu = (selection: Selection<string>): MenuItem[] => {
    const parts = itemsIn(selection);
    const nothing = () => undefined;
    if (parts.length < selection.size) return [{ label: t('Routes and tracks of files are not acted on together with files and folders'), disabled: true, run: nothing }];
    const one = parts.length === 1 ? parts[0]! : undefined;
    const tracks = parts.filter((at) => at.item.kind === 'track');
    return [
      ...(one ? [] : [{ label: t('{what} selected', { what: t('{n} routes and tracks', { n: parts.length }) }), disabled: true, run: nothing }]),
      { label: t('Copy'), run: () => copyOut(pickedOf(parts)) },
      { label: t(one ? 'Keep as ride' : 'Keep tracks as rides'), disabled: tracks.length === 0, run: () => keepRides(pickedOf(tracks)) },
      { label: t('Rename…'), disabled: !one, run: () => setDialog({ kind: 'rename-item', at: one! }) },
      { label: t('Delete'), run: () => void removeItems(parts) },
    ];
  };
  /** The menu of a route or a track of a file: for the selected rows, or for it alone where it is not selected. */
  const stashItemMenu = (at: FileItem): MenuItem[] => {
    const selection = menuSelection(selected(), itemKey(at));
    setSelected(selection.size > 1 ? selection : NOTHING_SELECTED);
    return itemsMenu(selection);
  };

  /**
   * The menu of a folder or a trip, the same for both: what is new in it and what is added
   * to it from the computer, rename, duplicate, cut, copy, paste into it, move, merge,
   * for planning material the trip made from it, export, delete. New in a folder is a folder and a trip, a collection or a list of places, in a trip a day, in a list of places a kind;
   * added to a folder are files or a folder, to a trip or a collection files. Opened on a
   * card of the selection it acts on all of it; what does not apply to what is selected is
   * greyed out, and new and add are left out.
   */
  const itemMenu = (item: Item): MenuItem[] => {
    const selection = menuSelection(selected(), keyOf(item));
    setSelected(selection.size > 1 ? selection : NOTHING_SELECTED);
    if (routesIn(selection).length > 0) return routesMenu(selection);
    if (itemsIn(selection).length > 0) return itemsMenu(selection);
    const chosen = chosenWith(item, selection);
    const several = chosen.length > 1;
    if ('file' in item || filesOf(chosen).length > 0) return filesMenu(chosen);
    const chosenTrips = tripsOf(chosen);
    const onlyTrips = chosenTrips.length === chosen.length;
    const [first, ...others] = chosenTrips;
    const paste = several ? [] : pasteItems(item);
    const within = tripsWithin(chosen);
    const nothing = () => undefined;
    const pasteEntries = paste.length > 0 ? paste : [{ label: t('Paste'), disabled: true, run: nothing }];
    const exportEntry = exportItem(within);
    const fresh: MenuItem[] = several
      ? []
      : 'folder' in item
        ? [newItem(item.folder.id), addItem(item.folder.id)]
        : [
            ...(item.trip.kind === 'trip' ? [{ label: t('New'), items: [{ label: t('Day'), run: () => addDayTo(item.trip) }] }] : []),
            ...(isPlaceList(item.trip.id) ? [{ label: t('New'), items: [{ label: t('Kind of place…'), run: () => setDialog({ kind: 'new', what: 'kind' as const, into: item.trip.id }) }] }] : []),
            { label: t('Add'), items: [{ label: t('Files…'), run: () => void imports.addToTrip(item.trip) }] },
          ];
    // A special folder stays as it is: it takes what is new, added and pasted, and exports what it holds.
    if ('folder' in item && item.folder.kind !== 'folder') return [...fresh, ...pasteEntries, exportEntry];
    return [
      ...(several ? [{ label: t('{what} selected', { what: countText(chosen) }), disabled: true, run: nothing }] : []),
      ...fresh,
      // The open trip is renamed as it is edited; the others on the server.
      { label: t('Rename…'), disabled: several, run: () => ('folder' in item ? setDialog({ kind: 'rename-folder', folder: item.folder }) : item.trip.id === openTripId() ? setEditTarget({ kind: 'trip' }) : setDialog({ kind: 'rename-trip', trip: item.trip })) },
      { label: t('Duplicate'), disabled: !onlyTrips, run: () => void flushSave().then(() => runLibrary(() => Promise.all(chosenTrips.map((trip) => duplicateTrip(trip.id))), relist)) },
      { label: t('Cut'), run: () => clip(chosen, true) },
      { label: t('Copy'), disabled: !onlyTrips, run: () => clip(chosen, false) },
      ...pasteEntries,
      ...moveItem(chosen),
      ...(onlyTrips && several
        ? [
            others.every((trip) => trip.kind === first!.kind)
              ? { label: t('Merge into “{name}”', { name: first!.name }), run: () => void merge(first!, others) }
              : { label: t('Trips and planning material do not merge'), disabled: true, run: nothing },
          ]
        : []),
      exportEntry,
      { label: t('Delete'), run: () => void remove(chosen) },
    ];
  };

  /** The menu of the top of the library: what is new there and added to it, what is pasted, and the export of every trip. */
  const topMenu = (): MenuItem[] => {
    const copied = libraryClip();
    return [
      newItem(null),
      addItem(null),
      { label: t('Paste'), disabled: !copied || !takerOf(clipItems(copied))(null), run: () => pasteLibrary(null) },
      exportItem(trips()),
    ];
  };

  /** The folders and trips of a folder, each unfolding to what it holds: folders to theirs, a trip to its days. */
  const Branch = (branch: { parent: number | null }): JSX.Element => (
    <>
      <ForById each={childFolders(branch.parent)}>
        {(f) => (
          <FolderCard
            folder={f()}
            note={heldText(heldOf(f().id), heldNoun(f().id))}
            onOpen={() => clickFolder(f())}
            items={() => itemMenu({ folder: f() })}
            select={select({ folder: f() })}
            fold={{ unfolded: () => isUnfolded({ folder: f() }), current: () => isMarkedFolder(f().id) }}
          >
            <Branch parent={f().id} />
          </FolderCard>
        )}
      </ForById>
      <ForById each={childTrips(branch.parent)}>
        {(trip) => (
          <TripCard
            trip={trip()}
            onOpen={clickTrip}
            items={() => itemMenu({ trip: trip() })}
            select={select({ trip: trip() })}
            fold={{ unfolded: () => isUnfolded({ trip: trip() }), current: () => isMarkedTrip(trip()), open: () => openTripId() === trip().id }}
          >
            <Show when={openTripId() === trip().id} fallback={<TripDays trip={trip()} onOpen={(dayId) => props.onOpen(trip(), dayId)} />}>
              {props.children}
            </Show>
          </TripCard>
        )}
      </ForById>
      <ForById each={childFiles(branch.parent)}>
        {(file) => (
          <StashFileCard
            file={file()}
            onOpen={clickFile}
            onShow={(item) => showItem(file(), item)}
            items={() => itemMenu({ file: file() })}
            itemItems={(item) => stashItemMenu({ file: file(), item })}
            itemSelect={(item) => selectItem({ file: file(), item })}
            select={select({ file: file() })}
            unfolded={isUnfolded({ file: file() })}
          />
        )}
      </ForById>
    </>
  );

  /**
   * The tree of a tab, there while another is shown: a line that says what the tree holds
   * at its top, which a click marks, with the button that folds the tree away and the
   * menu of its top, over its folders and trips.
   */
  const Tree = (tree: { tab: TreeTab }): JSX.Element => {
    const root = () => rootOf(tree.tab);
    const held = () => heldOf(root());
    const menu = (): MenuItem[] => {
      const top = folders().find((f) => f.id === root());
      return top ? itemMenu({ folder: top }) : topMenu();
    };
    return (
      <div hidden={libraryTab() !== tree.tab}>
        <div class="row tab-summary" classList={{ current: isMarkedFolder(root()) }} ref={(el) => cardMenu(el, menu)}>
          <button class="text grow" onClick={() => markFolderShown(root())}>
            <span class="muted detail">{heldText(held(), heldNoun(root()))}</span>
          </button>
          <IconButton label={t('Fold all folders and trips away')} disabled={!keysWithin(root()).some((key) => unfolded().has(key))} onClick={() => foldAll(root())}>
            <FoldIcon />
          </IconButton>
          <MenuButton of={pathOf(root()) || ALL_TRIPS} items={menu} />
        </div>
        <Show when={tree.tab === 'stash' && stashProblem()}>{(problem) => <p class="error">{errorMessage(problem())}</p>}</Show>
        <ul class="tree">
          <Branch parent={root()} />
        </ul>
        <Show when={held().folders + held().trips === 0}>
          <p class="muted">{EMPTY[tree.tab]}</p>
        </Show>
      </div>
    );
  };

  /**
   * What the search found in the tree shown, up to the limit, in the tree's place: cards
   * that are selected and have their menus as the tree's have, a folder's and a trip's
   * with where it is.
   */
  const Results = (): JSX.Element => {
    const total = () => found().folders.length + found().trips.length + found().files.length + found().routes.length + found().items.length;
    return (
      <Show when={total() > 0} fallback={<p class="muted">{t('Nothing found.')}</p>}>
        <ul class="results">
          <For each={listed().folders}>
            {(f) => (
              <FolderCard
                folder={f}
                note={[pathOf(f.parentId), heldText(heldOf(f.id), heldNoun(f.id))].filter(Boolean).join(' · ')}
                onOpen={props.onOpenFolder}
                items={() => itemMenu({ folder: f })}
                select={select({ folder: f }, listedKeys)}
              />
            )}
          </For>
          <For each={listed().trips}>
            {(trip) => <TripCard trip={trip} onOpen={props.onOpen} items={() => itemMenu({ trip })} where={pathOf(trip.folderId) || t('No folder')} select={select({ trip }, listedKeys)} />}
          </For>
          <For each={listed().files}>
            {(file) => (
              <StashFileCard file={file} where={pathOf(file.folderId)} onOpen={revealFile} onShow={(item) => revealFile(file, item)} items={() => itemMenu({ file })} itemItems={(item) => stashItemMenu({ file, item })} itemSelect={(item) => selectItem({ file, item }, listedKeys)} select={select({ file }, listedKeys)} />
            )}
          </For>
          <For each={listed().routes}>{(route) => <RouteCard found={route} onOpen={props.onOpenRoute} items={() => routeMenu(route)} select={selectRoute(route)} />}</For>
          <For each={listed().items}>{(at) => <StashItemRow file={at.file} item={at.item} where={at.file.name} onShow={(item) => revealFile(at.file, item)} items={() => stashItemMenu(at)} select={selectItem(at, listedKeys)} />}</For>
        </ul>
        <Show when={total() > SEARCH_LIMIT}>
          <p class="muted">{t('{n} more; narrow the search.', { n: total() - SEARCH_LIMIT })}</p>
        </Show>
      </Show>
    );
  };

  return (
    <div class="library" hidden={!shownTree()}>
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
        <Match when={libraryTrips.error ?? libraryFolders.error ?? stashFiles.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Match>
        <Match when={libraryTrips() && libraryFolders()}>
          <Show
            when={searchedFor()}
            fallback={
              <>
                <Show when={libraryClip()}>
                  {(copied) => (
                    <button class="paste-here" onClick={() => pasteLibrary(shownFolderId())}>
                      {t(copied().move ? 'Move {what} to “{where}”' : 'Paste a copy of {what} into “{where}”', { what: clipText(copied()), where: pathOf(shownFolderId()) || ALL_TRIPS })}
                    </button>
                  )}
                </Show>
                <For each={TREE_TABS}>{(tree) => <Tree tab={tree} />}</For>
              </>
            }
          >
            <Results />
          </Show>
        </Match>
      </Switch>
      <NameDialog
        title={newTexts().title}
        open={newIn() !== undefined}
        placeholder={newTexts().placeholder}
        submit={newTexts().submit}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => createNew(newIn()!.what, newIn()!.into, name)}
      />
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
        title={t('Rename file')}
        open={renamedFile() !== undefined}
        placeholder={t('Name of the file')}
        initial={renamedFile()?.name}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => {
          const file = renamedFile()!;
          if (name !== file.name) void runLibrary(() => renameStashFile(file.id, name), relistStash);
        }}
      />
      <NameDialog
        title={renamedItem()?.item.kind === 'track' ? t('Rename track') : t('Rename route')}
        open={renamedItem() !== undefined}
        placeholder={t('Name')}
        initial={renamedItem()?.item.name}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => {
          const { file, item } = renamedItem()!;
          if (name !== item.name) void runLibrary(() => renameStashItem(file.id, item, name), () => (stashEdited(), relistStash()));
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
 * collection its sections, after the folder it is in where `where` names it, or, while it
 * is being opened, over how far its document has come, beside a spinner; its menu
 * renames, moves, copies and deletes it. A click opens it. Where it can be selected, a tap
 * on its pad selects it, a press drags it, and a click with Cmd, Ctrl or Shift held
 * selects instead of opening, which `select.onClick` says.
 */
function TripCard(props: {
  trip: TripSummary;
  onOpen: (trip: TripSummary) => void;
  items: () => MenuItem[];
  where?: string;
  select?: CardSelect;
  fold?: CardFold;
  children?: JSX.Element;
}) {
  const shape = createMemo(() => outlineOf(props.trip.id)?.map((day) => day.lines).filter((lines) => lines.length > 0));
  /** How far the opening of the trip has come, while it is being opened. */
  const loading = () => (isOpening(props.trip.id) ? opening()?.progress : undefined);
  const folderKind = createMemo(() => kindAround(libraryFolders() ?? [], props.trip.folderId));
  /** What a collection is: the places it holds in the folder for them, planning material elsewhere. */
  const held = createMemo(() => counted((outlineOf(props.trip.id) ?? []).reduce((sum, day) => sum + day.stops, 0), 'place'));
  const meta = () =>
    (props.trip.kind === 'collection'
      ? [props.where, held(), counted(props.trip.dayCount, folderKind() === 'places' ? 'kind' : 'section')]
      : [props.where, counted(props.trip.dayCount, 'day'), props.trip.startsOn && t('from {date}', { date: dateText(props.trip.startsOn) }), props.trip.state === 'done' && t('done')]
    )
      .filter(Boolean)
      .join(' · ');
  return (
    <li class="card" classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current(), open: props.fold?.open?.(), opening: loading() !== undefined }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.trip.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <button
          class="text grow"
          aria-expanded={props.fold?.unfolded()}
          onClick={(e) => props.select?.onClick(e) || props.onOpen(props.trip)}
          disabled={fetchingTrip()}
        >
          <Show when={!loading()} fallback={<span class="spinner" />}>
            <Show when={props.trip.kind === 'collection'} fallback={<TripIcon />}>
              <CollectionIcon />
            </Show>
          </Show>
          <span class="lines">
            <span class="name">{props.trip.name}</span>
            <span class="muted detail">
              <Show when={loading()} fallback={meta()}>
                {openingText(loading()!)}
              </Show>
            </span>
          </span>
          <Show when={shape()?.length ? shape() : undefined}>{(days) => <TripShape days={days()} />}</Show>
        </button>
        <MenuButton of={props.trip.name} items={props.items} />
      </div>
      <Show when={props.fold?.unfolded()}>
        <div class="tree-children">{props.children}</div>
      </Show>
    </li>
  );
}

/**
 * A folder as a card: its name over `note`, what it holds and in search results where it
 * is; its menu is the library's. Trips and folders dragged onto it move into it; with
 * `select`, its pad selects it or drags it into another.
 */
function FolderCard(props: { folder: Folder; note: string; onOpen: (id: number) => void; items: () => MenuItem[]; select?: CardSelect; fold?: CardFold; children?: JSX.Element }) {
  return (
    <li class="card" classList={{ selected: props.select?.selected(), cut: props.select?.cut(), current: props.fold?.current() }} data-drop-folder={String(props.folder.id)}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Show when={props.select}>
          {(select) => (
            <Pad label={t('Select {name}, or drag it into a folder', { name: props.folder.name })} selected={select().selected()} onToggle={select().onToggle} onPress={select().onDrag} />
          )}
        </Show>
        <button class="text grow" aria-expanded={props.fold?.unfolded()} onClick={(e) => props.select?.onClick(e) || props.onOpen(props.folder.id)}>
          <FolderIcon />
          <span class="lines">
            <span class="name">{props.folder.name}</span>
            <span class="muted detail">{props.note}</span>
          </span>
        </button>
        <MenuButton of={props.folder.name} items={props.items} />
      </div>
      <Show when={props.fold?.unfolded()}>
        <ul class="tree-children">{props.children}</ul>
      </Show>
    </li>
  );
}

/** A route or a track the search found, as a card: its name over what it is and where, its trip and day; a click opens it there. */
function RouteCard(props: { found: FoundRoute; onOpen: (found: FoundRoute) => void; items: () => MenuItem[]; select: RowSelect }) {
  return (
    <li class="card" classList={{ selected: props.select.selected() }}>
      <div class="row" ref={(el) => cardMenu(el, props.items)}>
        <Pad label={t('Select {name}', { name: props.found.route.name })} selected={props.select.selected()} onToggle={props.select.onToggle} />
        <button class="text grow" disabled={fetchingTrip()} onClick={(e) => props.select.onClick(e) || props.onOpen(props.found)}>
          <span class="lines">
            <span class="name">{props.found.route.name}</span>
            <span class="muted detail">{[props.found.route.kind === 'track' ? t('Track') : t('Route'), props.found.within.name, props.found.day].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
        <MenuButton of={props.found.route.name} items={props.items} />
      </div>
    </li>
  );
}
