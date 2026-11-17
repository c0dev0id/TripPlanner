import { plural, t } from '../i18n/t';
import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, type JSX } from 'solid-js';
import { changeTrip, createFolder, createTrip, deleteFolder, deleteStashFile, deleteTrip, moveStashFile, duplicateTrip, errorMessage, mergeTrips, moveFolder, moveTrip, renameFolder, renameTrip, tripArchiveUrl } from '../api';
import { TAB_NAMES, TREE_TABS, TREES, type TreeTab } from '../model/library';
import type { CopiedFolder, StashFile, StashItem, StashPart } from '../model/stash';
import { newId, type Folder, type TripSummary } from '../model/trip';
import { addDay as withDayAdded, pasteDays, pasteIntoTrip, type CopiedRoute } from '../routing/dayEdit';
import { bringWithDays, clearClip, copyLibraryItems, copyStashFiles, copyStashParts, dropsOnRow, libraryClip, libraryPasteItem, pasteItems as pasteIntoPart, stashFilesClip, type LibraryClip, type PasteInto, type PasteItem } from '../state/clipboard';
import { heldOf, importNote, isPlaceList, paneShown, libraryFolders, libraryTab, libraryTrips, markedFolderOf, deleteRoutes, openTree, outlineOf, query, relistFolders, searchedFor, relistTrips, rootOf, treeOf, runLibrary, setImportNote, showFolder, shownFolderId } from '../state/library';
import { withImportedDay } from './folderImport';
import { countsText, folderPath, heldInAll, heldText, moveTargets } from '../model/folders';
import { flushSave } from '../state/autosave';
import { isShownItem, isShownWaypoints, isShownWhole, relistStash, showInStash, shownInStash, stashFiles, stashProblem, type ShownStash } from '../state/stash';
import { GroupDialog, type Grouping } from './GroupDialog';
import { groupFiles } from './grouping';
import { setEditTarget, setExportScope, setShareOpen } from '../state/drawing';
import { setWorkspaceOpen } from '../state/journal';
import { unpinTrips } from '../state/pins';
import { addDay, addSection, isMarkInTrip, isTripMarked, markedLookId, markFolder, markInOpenTrip, markTrip, openTrip, openTripId, selectDay, selectedDayId, type OpenAt } from '../state/trip';
import { reveal } from '../state/panel';
import { readPreference, writePreference } from '../ui/preferences';
import { cardMenu, spaceMenu } from '../ui/cardMenu';
import { askChoice, askConfirmation } from '../ui/confirm';
import { counted } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { FoldIcon } from '../ui/icons';
import { dropTarget, type Drop } from '../ui/carry';
import { menuNote, type MenuItem } from '../ui/menu';
import { Said } from '../ui/Said';
import type { Place } from '../model/paste';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { menuRows, NOTHING_SELECTED, rowSelect, selectIn, selectionOf, type RowSelect, type Selection } from '../ui/selection';
import { fileVerb } from '../ui/fileVerb';
import { ForById } from '../ui/ForById';
import { FolderCard, loneDay, RouteCard, TripCard, TripDays, type CardPane, type CardSelect } from './cards';
import { countText, fileItemsOf, filesOf, folderOf, foldersOf, itemKey, itemsOf, keyOf, mediaKey, nameOf, partsOf, waypointsKey, takerOf as takerAmong, tripsOf, tripsWithin as tripsAmong, type FileItem, type Item, type Listed } from './items';
import { libraryImports } from './importActions';
import { StashFileCard, StashItemRow } from './StashFileCard';
import { addPartsTo, applyGroups, filesMenu, partsMenu, removeItems, takeOut, type StashMenuHost } from './stashMenu';
import { stashCopies, stashPlaces } from './stashOut';
import { StandardPlaces } from '../map/PlaceKinds';
import { keepPlaces, keptText, type KindedPlace } from './dropImport';
import { firstFound, foundCount, foundKeys, routeKey, searchLibrary, type FoundRoute, type RouteDays } from './search';

/** The top of the trips, as a place to paste into. */
const ALL_TRIPS = TAB_NAMES.trips;

/** The list that holds the selection of a tree's folders and trips. */
const ownerOf = (tree: TreeTab): string => `library:${tree}`;

/** The browser's preference that keeps what is unfolded in the tree. */
const UNFOLDED = 'libraryUnfolded';

/** At most this many search results are listed. */
const SEARCH_LIMIT = 20;

/** What a folder's menu makes new in it. */
type NewKind = 'folder' | 'trip' | 'list' | 'kind';

/** How the dialog that names a new folder, trip, list of places or kind of place reads. */
const NEW_DIALOG: Record<NewKind, { title: string; placeholder: string; submit: string }> = {
  folder: { title: t('New folder'), placeholder: t('Folder name'), submit: t('Create') },
  trip: { title: t('New trip'), placeholder: t('Trip name'), submit: t('Start') },
  list: { title: t('New place list'), placeholder: t('List name'), submit: t('Start') },
  kind: { title: t('New place category'), placeholder: t('Category name'), submit: t('Create') },
};

/** The dialog the library has open: a new name for something of it, with how the dialog reads and what saves the name, or the name of a new one in a folder, null for the top; of a new kind of place, in the list `into`. */
type LibraryDialog = { kind: 'rename'; title: string; placeholder: string; name: string; save: (name: string) => Promise<unknown>; saved: () => void } | { kind: 'new'; what: NewKind; into: number | null };

/** The kind folders, trips and files of the library are carried as when they are dragged (see `ui/carry.ts`). */
const ITEMS = 'items';

/**
 * The library as a tree: folders and trips unfolding in place, the open trip's days among
 * them, or what the search found across all folders. Its rows are opened, selected, cut,
 * copied, pasted into, moved, merged, renamed, exported and deleted.
 */
export function Library(props: {
  /** Opens a trip or a list, at the days or categories `at` names. */
  onOpen: (trip: TripSummary, at?: OpenAt) => void;
  /** Looks at a trip: shows it on the map without opening it. */
  onLook: (trip: TripSummary) => void;
  /** Opens a route the search found, in its trip and day. */
  onOpenRoute: (found: FoundRoute) => void;
  /** Leaves the open trip, saved: before the library changes it behind its back, or with `look`, as its pad closes it, which keeps it on the map. Answers false where the save failed and the trip stays open. */
  onLeave: (look?: boolean) => Promise<boolean>;
  /** What stands under the open trip in the tree: its days, or a collection's sections. */
  children: JSX.Element;
}) {
  const [dialog, setDialog] = createSignal<LibraryDialog>();
  const [grouping, setGrouping] = createSignal<Grouping>();
  const imports = libraryImports(props.onLeave);
  const folders = () => libraryFolders() ?? [];
  const trips = () => libraryTrips() ?? [];
  const files = () => (stashFiles.error ? [] : (stashFiles() ?? []));
  /** Every folder, trip and file there is. */
  const all = (): Listed => ({ folders: folders(), trips: trips(), files: files() });
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
  // The folders a trip lies in unfold when it opens, so that it is in view, and a list itself once a category of it is shown, wherever that was asked for: the category's row is then in view as if it had been clicked.
  createEffect(
    on([openTripId, selectedDayId], ([id, dayId], before) => {
      // A day that closes leaves the tree as it is: it may have closed because its folder was folded.
      if (dayId === undefined && before?.[0] === id) return;
      const trip = trips().find((candidate) => candidate.id === id);
      const keys = [...(trip?.kind === 'collection' && dayId !== undefined ? [keyOf({ trip })] : []), ...(trip ? keysAround(trip.folderId) : [])];
      if (keys.some((key) => !unfolded().has(key))) fold(keys, true);
    }),
  );
  /** The folders in a folder, null for the top of the trips; the special folders are in none, each the top of its own tree. */
  const childFolders = (parent: number | null) => folders().filter((f) => f.parentId === parent && f.kind === 'folder');
  const childTrips = (parent: number | null) => trips().filter((trip) => trip.folderId === parent);
  /** The Stash's files by the folder they are in, and by their id. */
  const filesIn = createMemo(() => {
    const by = new Map<number | null, StashFile[]>();
    for (const file of files()) (by.get(file.folderId) ?? by.set(file.folderId, []).get(file.folderId)!).push(file);
    return by;
  });
  const childFiles = (parent: number | null) => filesIn().get(parent) ?? [];
  /** Whether the Stash's mark is on what the map shows of it, a file or a part of one, and not on a folder: from when that is picked until a folder is. */
  const [markInFile, setMarkInFile] = createSignal(false);
  /** Whether the tree's mark is on a trip of it: the open one or its day, or among the trips the one looked at. */
  const markOnTrip = (tree: TreeTab): boolean => (isMarkInTrip() && openTree() === tree) || (tree === 'trips' && markedLookId() !== undefined);
  /** Whether the folder, null for the top of the trips, holds its tree's one mark: it is the folder marked there, and the mark is not on a trip, nor on what is shown of the Stash. */
  const isMarkedFolder = (id: number | null): boolean => markedFolderOf(treeOf(id)) === id && !markOnTrip(treeOf(id)) && !(treeOf(id) === 'stash' && markInFile() && shownInStash() !== undefined);
  /** Gives its tree's mark to a folder, null for the top of the trips, which makes it the one shown; the mark on the open trip in another tree stays, and so does what is on the map. */
  const markFolderShown = (id: number | null) => {
    showFolder(id);
    if (treeOf(id) === 'stash') setMarkInFile(false);
    if (markOnTrip(treeOf(id))) markFolder();
  };
  /** Shows a file of the Stash, or a part of it, on the map and gives it the Stash's mark; its folder is then the one shown, which takes what is pasted. */
  const showOfFile = (file: StashFile, to: ShownStash) => {
    showFolder(file.folderId);
    setMarkInFile(true);
    showInStash(to);
  };
  /** The keys of all a folder holds that unfolds, at any depth: folders, lists of places and files; null is the top of the trips. */
  const keysWithin = (id: number | null): string[] => [
    ...childFolders(id).flatMap((f) => [keyOf({ folder: f }), ...keysWithin(f.id)]),
    ...childTrips(id).flatMap((trip) => (trip.kind === 'collection' ? [keyOf({ trip })] : [])),
    ...childFiles(id).map((file) => keyOf({ file })),
  ];
  /** Closes the category shown of the open list, whose row folds away; a trip's days are not in the tree and stay as they are. */
  const closeListCategory = () => {
    if (openTrip()?.kind === 'collection') selectDay(undefined);
  };
  /**
   * A click on a folder marks it, which makes it the one that takes what is pasted with the keys,
   * and unfolds it; marked and unfolded already, it folds. A folder that folds takes all it holds with it:
   * its folders and lists fold too, and the category shown of an open list among them closes.
   */
  const clickFolder = (f: Folder) => {
    const key = keyOf({ folder: f });
    if (unfolded().has(key) && isMarkedFolder(f.id)) {
      fold([key, ...keysWithin(f.id)], false);
      if (holdsOpen([{ folder: f }])) closeListCategory();
    } else fold([key], true);
    markFolderShown(f.id);
  };
  /** Folds away every folder and list of a tree, by its top, which closes the category shown with its list where that is among them. */
  const foldAll = (root: number | null) => {
    fold(keysWithin(root), false);
    if (openTree() === treeOf(root)) closeListCategory();
  };
  /** Whether the trip holds the tree's mark: a trip looked at, or the open one while the mark is in it, on itself or on a day in its pane; a list itself, rather than its category shown under it. */
  const isMarkedTrip = (trip: TripSummary): boolean => trip.id === markedLookId() || (trip.id === openTripId() && (trip.kind === 'trip' ? isMarkInTrip() : isTripMarked()));
  /**
   * A click on a trip shows it whole on the map and marks it, and opens nothing: the
   * open trip gives the map back to all its days, another is looked at. A list of
   * places is a folder of categories: a click marks it and unfolds it, one that is not
   * open opens, and the open one closes its category that is shown; marked already, it
   * folds, and unfolds again at the next click.
   */
  const clickTrip = (trip: TripSummary) => {
    if (trip.kind === 'trip') return trip.id === openTripId() ? markTrip() : props.onLook(trip);
    const key = keyOf({ trip });
    if (isMarkedTrip(trip)) return fold([key], !unfolded().has(key));
    fold([key], true);
    if (trip.id === openTripId()) markTrip();
    else props.onOpen(trip);
  };
  /** The pad on a trip's row: it opens the trip, whose pane then stands beside the library, unfolded and in the place of a report, and closes the trip that is open. */
  const paneOf = (trip: TripSummary): CardPane => {
    const open = () => trip.id === openTripId() && paneShown();
    return {
      open,
      onToggle: () => {
        if (open()) return void props.onLeave(true);
        reveal('second');
        if (trip.id === openTripId()) markInOpenTrip();
        else props.onOpen(trip);
      },
    };
  };
  /** A click on a file unfolds it and shows it whole on the map; shown whole already, it folds and leaves the map. */
  const clickFile = (file: StashFile) => {
    const key = keyOf({ file });
    const folds = isShownWhole(file.id) && unfolded().has(key);
    fold([key], !folds);
    if (folds) showInStash(undefined);
    else showOfFile(file, { fileId: file.id });
  };
  /** A click on a route or a track of a file shows it alone on the map; shown alone already, it gives way to its file whole. */
  const showItem = (file: StashFile, item: StashItem) => showOfFile(file, isShownItem(file.id, item) ? { fileId: file.id } : { fileId: file.id, item });
  /** A click on a file's waypoints shows them alone on the map; shown alone already, they give way to the file whole. */
  const showWaypoints = (file: StashFile) => showOfFile(file, isShownWaypoints(file.id) ? { fileId: file.id } : { fileId: file.id, waypoints: true });
  /** Shows a file the search found where it is in the tree, unfolded, and on the map: whole, or the one route or track of it. */
  const revealFile = (file: StashFile, item?: StashItem) => {
    fold([keyOf({ file }), ...keysAround(file.folderId)], true);
    showOfFile(file, { fileId: file.id, item });
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
        ? 'The folder “{name}” contains {own}. Move them {where} and delete the folder, or delete the folder with everything in it?'
        : 'The folder “{name}” contains {own} ({all} in total). Move them {where} and delete the folder, or delete the folder with everything in it?',
      { name: f.name, own, all, where },
    );
    const deleteAll = t('Delete all');
    const choice = await askChoice(question, [deleteAll, t('Move contents')]);
    return choice === undefined ? undefined : choice === deleteAll ? 'delete' : 'move';
  };
  const removeFolder = async (f: Folder) => {
    const contents = await askFolderDeletion(f);
    if (!contents) return;
    const gone = contents === 'delete' ? tripsWithin([{ folder: f }]).map((trip) => trip.id) : [];
    await runLibrary(
      () => deleteFolder(f.id, contents),
      () => {
        unpinTrips(gone);
        relist();
      },
    );
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
  /** The rows a row's menu acts on, in the tree shown: the selection where it holds the row, else the row alone. */
  const menuRowsOf = (key: string): Selection<string> => new Set(menuRows(ownerOf(shownTree()!), key));
  const setSelected = (rows: Selection<string>) => {
    const tree = shownTree();
    if (tree) selectIn(ownerOf(tree), rows);
  };
  for (const tree of TREE_TABS) createEffect(on(() => markedFolderOf(tree), () => selectIn(ownerOf(tree), NOTHING_SELECTED), { defer: true }));
  // What a search lists is not what was listed before: nothing stays selected out of view.
  createEffect(on(query, () => TREE_TABS.forEach((tree) => selectIn(ownerOf(tree), NOTHING_SELECTED)), { defer: true }));
  /** A trip's days with their routes: the open trip's as it is edited, another's with those that have a name, as its outline lists them. */
  const routeDaysOf = (trip: TripSummary): RouteDays => (trip.id === openTripId() ? openTrip()!.days : (outlineOf(trip.id) ?? []).map((day) => ({ id: day.id, name: day.name, routes: day.namedRoutes })));
  /** What the search finds in the tree shown; nothing while the rides are. */
  const found = createMemo(() => {
    const tree = shownTree();
    return searchLibrary(all(), tree ? searchedFor() : '', (folderId) => treeOf(folderId) === tree, routeDaysOf);
  });
  /** Of what the search found, what is listed. */
  const listed = createMemo(() => firstFound(found(), SEARCH_LIMIT));
  /** The rows the search lists that can be selected, top to bottom, by key. */
  const listedKeys = () => foundKeys(listed());
  const itemsIn = (keys: Selection<string>): FileItem[] => fileItemsOf(files(), keys);
  /** What the rows selected take of files: their routes and tracks, their waypoints and their media. */
  const partsIn = (keys: Selection<string>): StashPart[] => partsOf(files(), keys);
  /** The routes among the rows selected, as the search found them. */
  const routesIn = (keys: Selection<string>): FoundRoute[] => found().routes.filter((route) => keys.has(routeKey(route)));
  /** The rows in view under a folder, top to bottom: its folders with those of every unfolded folder in it, its trips, and its files with the routes and tracks of every unfolded one. */
  const shownKeys = (parent: number | null): string[] => [
    ...childFolders(parent).flatMap((f) => [keyOf({ folder: f }), ...(isUnfolded({ folder: f }) ? shownKeys(f.id) : [])]),
    ...childTrips(parent).map((trip) => keyOf({ trip })),
    ...childFiles(parent).flatMap((file) => [keyOf({ file }), ...(isUnfolded({ file }) ? [...file.items.map((item) => itemKey({ file, item })), ...(file.waypoints > 0 ? [waypointsKey(file)] : []), ...(file.media.length > 0 ? [mediaKey(file)] : [])] : [])]),
  ];
  /** What a card's menu, or a press on its pad, acts on: the selection where it holds the card, else the card alone. */
  const chosenWith = (item: Item, selection: Selection<string> = selected()): Item[] => (selection.has(keyOf(item)) ? itemsOf(all(), selection) : [item]);
  /** How a row of a tree is selected by its key, among the rows of the tree or, with `order`, among those the search lists. */
  const selectRow = (tree: TreeTab, key: string, order: () => string[] = () => shownKeys(rootOf(tree))): RowSelect => rowSelect(ownerOf(tree), key, order);
  /** How a folder's, a trip's or a file's card is selected, cut and dragged into a folder, and what a drop on it does: into a folder go the folders, trips and files dragged, onto a trip or a list what was dragged out of the open one. */
  const select = (tree: TreeTab, item: Item, order?: () => string[]): CardSelect => ({
    ...selectRow(tree, keyOf(item), order),
    cut: () => isCut(item),
    carries: () => {
      const moved = chosenWith(item);
      return { kind: ITEMS, what: moved.length === 1 ? nameOf(item) : countText(moved), carried: moved };
    },
    place: (el) => {
      if ('folder' in item) dropTarget<Item[]>(el, ITEMS, (items) => dropInto(items, item.folder.id));
      else if ('trip' in item) dropsOnRow(el, () => item.trip.id, () => rowOf(item.trip));
    },
  });
  const isCut = (item: Item): boolean => {
    const cut = libraryClip();
    return cut !== undefined && cut.move && ('folder' in item ? cut.folderIds.includes(item.folder.id) : 'trip' in item ? cut.tripIds.includes(item.trip.id) : cut.fileIds.includes(item.file.id));
  };
  /** Lists the library afresh, nothing selected: after folders or trips were moved, merged, pasted or deleted. */
  const relist = () => {
    setSelected(NOTHING_SELECTED);
    relistFolders();
    // What is changed lies in the tree shown: the trips and lists are listed afresh for theirs, the files for the Stash.
    if (shownTree() === 'stash') relistStash();
    else relistTrips();
  };
  const tripsWithin = (items: readonly Item[]) => tripsAmong(all(), items);
  const remove = async (doomed: readonly Item[]) => {
    const [only] = doomed;
    if (doomed.length === 1 && 'folder' in only!) return removeFolder(only.folder);
    const one = doomed.length === 1 && ('trip' in only! ? t('Delete the trip “{name}” and all its days?', { name: only.trip.name }) : t('Delete the file “{name}”?', { name: nameOf(only!) }));
    const all = foldersOf(doomed).length > 0 ? 'Delete {what} and everything in them?' : tripsOf(doomed).length > 0 ? 'Delete {what} with all their days?' : 'Delete {what}?';
    if (!(await askConfirmation(one || t(all, { what: countText(doomed) }), t('Delete')))) return;
    if (holdsOpen(doomed) && !(await props.onLeave())) return;
    const gone = tripsWithin(doomed).map((trip) => trip.id);
    await runLibrary(
      () => Promise.all([...tripsOf(doomed).map((trip) => deleteTrip(trip.id)), ...foldersOf(doomed).map((f) => deleteFolder(f.id, 'delete')), ...filesOf(doomed).map((file) => deleteStashFile(file.id))]),
      () => {
        unpinTrips(gone);
        relist();
      },
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
    const others = itemsOf(all(), selection);
    const what = [others.length > 0 && countText(others), counted(routes.length, 'route')].filter(Boolean).join(', ');
    return [
      ...(selection.size > 1 ? [menuNote(t('{what} selected', { what }))] : []),
      others.length > 0 ? menuNote(t('Routes cannot be deleted together with folders and trips')) : { label: t('Delete'), run: () => void removeRoutes(routes) },
    ];
  };
  /** The menu of a route the search found: for the selected rows, or for it alone where it is not selected. */
  const routeMenu = (route: FoundRoute): MenuItem[] => {
    const selection = menuRowsOf(routeKey(route));
    return routesMenu(selection);
  };
  const merge = async (into: TripSummary, others: TripSummary[]) => {
    const what = counted(others.length, into.kind);
    const where = t(into.kind === 'collection' ? 'Their sections are moved into it' : 'Their days and journal are moved into it; a day is combined with the day of the same date, if there is one');
    const question = plural(others.length, 'Merge {what} into “{name}”? {where}, and the merged one is deleted.|Merge {what} into “{name}”? {where}, and the merged ones are deleted.', { what, name: into.name, where });
    if (!(await askConfirmation(question, t('Merge')))) return;
    if (holdsOpen([{ trip: into }, ...others.map((trip) => ({ trip }))]) && !(await props.onLeave())) return;
    const merged = others.map((trip) => trip.id);
    await runLibrary(
      () => mergeTrips(into.id, merged),
      () => {
        unpinTrips(merged);
        relist();
      },
    );
  };
  /** What a folder holds besides folders, as it is counted: trips, in the Stash files or, among the places, lists. */
  const heldNoun = (id: number | null) => TREES[treeOf(id)].holds;
  const takerOf = (items: readonly Item[]) => takerAmong(all(), items);
  /** Those of the items that a move into the folder, null for the top, would move: not the folder itself, and not what is in it already. */
  const goingInto = (moved: readonly Item[], into: number | null): Item[] => moved.filter((item) => folderOf(item) !== into && !('folder' in item && item.folder.id === into));
  /** Moves folders, trips and files into a folder, none for the top, those not in it already; the server refuses a folder inside itself. */
  const moveInto = (moved: readonly Item[], into: number | null) => {
    const going = goingInto(moved, into);
    if (going.length === 0) return;
    void runLibrary(() => Promise.all([...tripsOf(going).map((trip) => moveTrip(trip.id, into)), ...foldersOf(going).map((f) => moveFolder(f.id, into)), ...filesOf(going).map((file) => moveStashFile(file.id, into!))]), relist);
  };
  /** What a drop of dragged folders, trips and files into the folder, null for the top, does: moves them there; refused where the folder does not take them or holds them all. */
  const dropInto = (items: Item[], into: number | null): Drop => (takerOf(items)(into) && goingInto(items, into).length > 0 ? () => moveInto(items, into) : null);
  /**
   * Move… with where what is moved can go from where the first of it is, as its submenu:
   * the top of its tree as "/", the folder around its own as "..", the folders beside
   * that one as "../name" and the folders in it. Anything further off is reached in
   * steps, or by dragging. None where there is nowhere to go.
   */
  const moveItem = (moved: readonly Item[]): MenuItem[] => {
    const [first] = moved;
    const from = folderOf(first!);
    const movedFolders = new Set(foldersOf(moved).map((f) => f.id));
    const places = moveTargets(folders(), from, rootOf(treeOf(from)), movedFolders, takerOf(moved)).map(({ label, into }) => ({ label, run: () => moveInto(moved, into) }));
    return places.length > 0 ? [{ label: t('Move…'), items: places }] : [];
  };
  /** What the clipboard holds of the library, by number and as the tree shown calls it: 2 folders and 3 trips, 1 list. */
  const clipText = (copied: LibraryClip): string => countsText(copied.folderIds.length, copied.tripIds.length + copied.fileIds.length, heldNoun(shownFolderId()));
  /** The folders, trips and files on the clipboard, those still there. */
  const clipItems = (copied: LibraryClip): Item[] => itemsOf(all(), [...copied.folderIds.map((id) => `folder:${id}`), ...copied.tripIds.map((id) => `trip:${id}`), ...copied.fileIds.map((id) => `file:${id}`)]);
  /** Pastes the folders, trips and files on the clipboard into a folder that takes them (see `takesClip`), which empties it: cut, they move there; copied, each trip gets a copy there. */
  const pasteLibrary = (into: number | null) => {
    const copied = libraryClip();
    if (!copied) return;
    clearClip();
    if (copied.move) return moveInto(clipItems(copied), into);
    void runLibrary(() => Promise.all(copied.tripIds.map(async (id) => moveTrip((await duplicateTrip(id)).id, into))), relist);
  };
  const renamed = () => {
    const d = dialog();
    return d?.kind === 'rename' ? d : undefined;
  };
  const newIn = () => {
    const d = dialog();
    return d?.kind === 'new' ? d : undefined;
  };
  /** How the dialog for something new reads; a folder's while it is closed. */
  const newTexts = () => NEW_DIALOG[newIn()?.what ?? 'folder'];
  /** Export, which downloads the trips as a zip once the open one is saved. */
  const exportItem = (of: readonly TripSummary[]): MenuItem => ({ label: t('Export'), disabled: of.length === 0, run: () => void flushSave().then(() => window.location.assign(tripArchiveUrl(of.map((trip) => trip.id)))) });
  /** Makes a folder, or a trip with its first day or a list of places, which is opened, in a folder, null for the top; the folder unfolds so that what is new is in view. A kind of place is a section of the list `into`. */
  const createNew = (what: NewKind, into: number | null, name: string) => {
    if (what === 'kind') return addSectionTo(into!, name);
    const parent = folders().find((f) => f.id === into);
    if (parent) fold([keyOf({ folder: parent })], true);
    if (what === 'folder') void runLibrary(() => createFolder(name, into), relistFolders);
    else if (what === 'list') void runLibrary(async () => props.onOpen(await createTrip(name, into, 'collection')), relistTrips);
    else void runLibrary(() => startTrip(name, into), relistTrips);
  };
  /** Makes a trip with its first day, since a trip is planned by its days, and opens it at that day. */
  const startTrip = async (name: string, into: number | null) => {
    const trip = await createTrip(name, into, 'trip');
    const dayId = newId();
    await changeTrip(trip.id, (made) => withDayAdded(made, dayId));
    reveal('second');
    props.onOpen(trip, { dayId });
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
        ...(what === 'file' ? [] : [{ label: t(what === 'trip' ? 'Trip…' : 'Place list…'), run: () => setDialog({ kind: 'new', what, into }) }]),
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
  /** The item that imports what was copied of the Stash into a folder, null for the top of the trips: among the trips files and folders, as trips; among the places files, as lists. None for a folder of the Stash, where they are. */
  const pasteFilesItem = (into: number | null): PasteItem[] => {
    const tree = treeOf(into);
    if (tree === 'trips') return libraryPasteItem('tripsFolder', { files: (files, copied) => imports.pasteAsTrips(into, files, copied) });
    return tree === 'places' ? libraryPasteItem('placesFolder', { files: (files) => imports.pasteFiles(into, files) }) : [];
  };
  /** Whether the folder, null for the top, takes the trips, lists and folders on the clipboard. */
  const takesClip = (into: number | null): boolean => {
    const copied = libraryClip();
    return copied !== undefined && takerOf(clipItems(copied))(into);
  };
  /** What is pasted into the one folder or trip: into a folder the folders, trips and lists of its tree, and files of the Stash, which are imported there; into a trip and a list of places what `model/paste.ts` says each takes. Nothing is pasted into the Stash but what is moved within it. */
  const pasteItems = (item: Item): MenuItem[] => {
    if ('folder' in item) return takesClip(item.folder.id) ? [{ label: t('Paste'), run: () => pasteLibrary(item.folder.id) }] : pasteFilesItem(item.folder.id);
    if ('file' in item) return [];
    const { place, into } = rowOf(item.trip);
    const onRow = libraryPasteItem(place, into, item.trip.id);
    // The row of the open trip stands for its one day as well: what only a day takes is pasted into that.
    const lone = item.trip.id === openTripId() ? loneDay(item.trip) : undefined;
    return onRow.length > 0 || !lone ? onRow : pasteIntoPart('day', lone.id);
  };
  /** How the row of a trip or of a list of places takes what is pasted or dropped onto it: its kind of place, and what it does with each kind of thing. */
  const rowOf = (of: TripSummary): { place: Place; into: PasteInto } => {
    const id = of.id;
    /** The open trip is left, saved, before it is changed on the server. */
    const left = async (paste: () => Promise<unknown>) => {
      if (holdsOpen([{ trip: of }]) && !(await props.onLeave())) return;
      await runLibrary(paste, relistTrips);
    };
    if (!isPlaceList(id)) {
      return {
        place: 'trip',
        into: {
          routes: (routes) => left(() => pasteInto(id, routes)),
          days: (days, from) =>
            left(async () => {
              let made: string[] = [];
              await changeTrip(id, (trip) => {
                const pasted = pasteDays(trip, days, undefined, newId);
                made = pasted.days.slice(trip.days.length).map((day) => day.id);
                return pasted;
              });
              await bringWithDays(from.tripId, days, made, from.cut);
            }),
          files: (files, copied) => imports.pasteAsDays(of, files, copied),
          parts: (parts) => left(async () => pasteInto(id, await stashCopies(parts))),
        },
      };
    }
    /** Keeps places in the list, each under its kind, and says how many it took and how many it had. */
    const keep = (places: () => Promise<KindedPlace[]> | KindedPlace[]) =>
      left(async () => {
        const { kept, known } = await keepPlaces(id, await places());
        setImportNote({ text: keptText(kept, known, 'place', t('No places found.')), errors: [] });
      });
    return {
      place: 'list',
      into: {
        places: (stops, kinds) => keep(() => stops.map((stop, i) => ({ kind: kinds[i] ?? t('Places'), stop: { ...stop, id: newId(), pointId: null } }))),
        files: (files) => imports.pasteFilesIntoList(of, files),
        parts: (parts) => keep(() => stashPlaces(parts)),
      },
    };
  };
  /** Puts folders, trips and files of the Stash on the clipboard: cut, to be moved where they are pasted; copied, which only trips are. */
  const clip = (chosen: readonly Item[], move: boolean) =>
    copyLibraryItems({ tripIds: tripsOf(chosen).map((trip) => trip.id), folderIds: foldersOf(chosen).map((f) => f.id), fileIds: filesOf(chosen).map((file) => file.id), move });
  /** A folder of the Stash as it is copied: with the files it holds and the folders in it, as they are now. */
  const copiedFolder = (folder: Folder): CopiedFolder => ({ name: folder.name, files: childFiles(folder.id), folders: childFolders(folder.id).map(copiedFolder) });
  /** Copies files and folders of the Stash, to be made trips of where they are pasted. */
  const copyStash = (chosen: readonly Item[]) => copyStashFiles(filesOf(chosen), foldersOf(chosen).map(copiedFolder));
  /**
   * The keys that cut, copy and delete the selected folders and trips, and paste those on
   * the clipboard into the folder shown, as the menu does; none while the rides are
   * shown. Files of the Stash are copied, and pasted into the folder shown of another
   * tree, which imports them there. With routes the search found selected, or routes and tracks of files,
   * Delete deletes them where nothing else is selected, and the other keys do nothing.
   */
  const onKey = (e: KeyboardEvent) => {
    const verb = fileVerb(e);
    if (!verb) return;
    const chosen = itemsOf(all(), selected());
    const routes = routesIn(selected());
    const parts = itemsIn(selected());
    const taken = partsIn(selected());
    if (routes.length + taken.length > 0) {
      // Routes, tracks, waypoints and media of files are copied where nothing else is selected with them; the key deletes neither the waypoints nor the media of a file.
      const alone = chosen.length + routes.length === 0;
      if (verb === 'copy' && alone) {
        e.preventDefault();
        return copyStashParts(taken);
      }
      if (verb !== 'delete' || chosen.length > 0 || taken.some((part) => part.waypoints || part.media)) return;
      e.preventDefault();
      return void (routes.length > 0 ? removeRoutes(routes) : removeItems(parts, relist));
    }
    // Files and folders of the Stash are copied, to be imported where they are pasted; cut, they move within the Stash.
    const pasteFiles = verb === 'paste' && shownTree() ? pasteFilesItem(shownFolderId())[0] : undefined;
    if (pasteFiles) {
      e.preventDefault();
      return pasteFiles.run();
    }
    if (verb === 'copy' && shownTree() === 'stash' && chosen.length > 0) {
      e.preventDefault();
      return copyStash(chosen);
    }
    if (!shownTree() || (verb === 'paste' ? !takesClip(shownFolderId()) : chosen.length === 0) || (verb === 'copy' && foldersOf(chosen).length > 0)) return;
    e.preventDefault();
    if (verb === 'paste') pasteLibrary(shownFolderId());
    else if (verb === 'delete') void remove(chosen);
    else clip(chosen, verb === 'cut');
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));
  let root!: HTMLDivElement;
  // The panel around the tree is the top of the tree shown: what is dragged there and lies deeper moves up to it, and its menu is the top's.
  onMount(() => {
    const panel = root.closest<HTMLElement>('.library-panel');
    if (!panel) return;
    dropTarget<Item[]>(panel, ITEMS, (items) => (shownTree() ? dropInto(items, rootOf(shownTree()!)) : null));
    // Its free space answers as the line over the tree does.
    spaceMenu(panel, () => (shownTree() ? treeMenu(shownTree()!) : []));
  });

  /** Adds a day at the end of a trip: of the open one as an edit that can be undone, which shows the day; of another on the server. */
  const addDayTo = (trip: TripSummary) => (trip.id === openTripId() ? addDay() : void runLibrary(() => changeTrip(trip.id, (loaded) => withDayAdded(loaded, newId())), relistTrips));

  /** Asks for a new name for something of the library, which `save` then gives it; `saved` lists afresh what it is among. */
  const rename = (title: string, placeholder: string, name: string, save: (name: string) => Promise<unknown>, saved: () => void) =>
    setDialog({ kind: 'rename', title, placeholder, name, save, saved });
  /** The item that adds the copied routes, tracks, waypoints and media of other files to a file of the Stash. */
  const pasteIntoFile = (file: StashFile): MenuItem[] => libraryPasteItem('stashFile', { parts: (parts) => runLibrary(() => addPartsTo(file, parts), relistStash) });
  /** What the Stash's menus ask of the library around them. */
  const stashHost: StashMenuHost = { rename, cut: (chosen) => clip(chosen, true), copy: copyStash, moveItem, pasteInto: pasteIntoFile, remove: (chosen) => void remove(chosen), relist };
  /** The menu of a route or a track of a file, or of a file's waypoints or media, by the row's key: for the selected rows, or for it alone where it is not selected. */
  const stashPartMenu = (key: string): MenuItem[] => {
    const selection = menuRowsOf(key);
    return partsMenu(partsIn(selection), selection.size, stashHost);
  };
  const stashItemMenu = (at: FileItem): MenuItem[] => stashPartMenu(itemKey(at));

  /**
   * The menu of a folder or a trip, the same for both: what is new in it and what is added
   * to it from the computer, rename, duplicate, cut, copy, paste into it, move, merge,
   * export, delete. New in a folder is a folder and a trip or, among the Places, a list;
   * in a trip a day, in a list of places a kind. Added to a folder are files or a
   * folder, to a trip files. Opened on a card of the selection it acts on all of it,
   * and holds only what can be done with what is selected: what takes one alone, or
   * trips alone, is left out otherwise. With files of the Stash, or routes and tracks, among what is selected, the menu
   * is theirs.
   */
  const itemMenu = (item: Item): MenuItem[] => {
    const selection = menuRowsOf(keyOf(item));
    if (routesIn(selection).length > 0) return routesMenu(selection);
    if (partsIn(selection).length > 0) return partsMenu(partsIn(selection), selection.size, stashHost);
    const chosen = chosenWith(item, selection);
    const several = chosen.length > 1;
    if ('file' in item || filesOf(chosen).length > 0) return filesMenu(chosen, stashHost);
    const chosenTrips = tripsOf(chosen);
    const onlyTrips = chosenTrips.length === chosen.length;
    const [first, ...others] = chosenTrips;
    const within = tripsWithin(chosen);
    // One folder or trip takes a paste, greyed out while the clipboard holds nothing for it; several take none.
    const paste = several ? [] : pasteItems(item);
    const pasteEntries = several ? [] : paste.length > 0 ? paste : [menuNote(t('Paste'))];
    // The export is of trips, which the Stash has none of: its folders have no such entry.
    const exportEntries = 'folder' in item && treeOf(item.folder.id) === 'stash' ? [] : [exportItem(within)];
    // A folder of the Stash with files of its own offers to sort them into folders.
    const groupEntries = !several && 'folder' in item && treeOf(item.folder.id) === 'stash' && childFiles(item.folder.id).length > 1 ? [{ label: t('Group files…'), run: () => proposeGroups(item.folder.id) }] : [];
    const fresh: MenuItem[] = several
      ? []
      : 'folder' in item
        ? [newItem(item.folder.id), addItem(item.folder.id)]
        : [
            ...(item.trip.kind === 'trip' ? [{ label: t('New'), items: [{ label: t('Day'), run: () => addDayTo(item.trip) }] }] : []),
            ...(isPlaceList(item.trip.id) ? [{ label: t('New'), items: [{ label: t('Place category…'), run: () => setDialog({ kind: 'new', what: 'kind' as const, into: item.trip.id }) }] }] : []),
            { label: t('Add'), items: [{ label: t('Files…'), run: () => void imports.addToTrip(item.trip) }] },
          ];
    // A special folder stays as it is: it takes what is new, added and pasted, and exports what it holds.
    if ('folder' in item && item.folder.kind !== 'folder') return [...fresh, ...pasteEntries, ...groupEntries, ...exportEntries];
    return [
      ...(several ? [menuNote(t('{what} selected', { what: countText(chosen) }))] : []),
      ...fresh,
      // One is renamed. The open trip is edited in its dialog, its name with the rest; the others are renamed on the server.
      ...(several
        ? []
        : [
            {
              label: 'trip' in item && item.trip.id === openTripId() ? t('Edit…') : t('Rename…'),
              run: () =>
                'folder' in item
                  ? rename(t('Rename folder'), t('Folder name'), item.folder.name, (name) => renameFolder(item.folder.id, name), relistFolders)
                  : item.trip.id === openTripId()
                    ? setEditTarget({ kind: 'trip' })
                    : rename(t('Rename trip'), t('Trip name'), item.trip.name, (name) => renameTrip(item.trip.id, name), relistTrips),
            },
          ]),
      // Only trips are duplicated and copied: with a folder among what is selected, as on a folder and anywhere in the Stash, the two are left out.
      ...(onlyTrips ? [{ label: t('Duplicate'), run: () => void flushSave().then(() => runLibrary(() => Promise.all(chosenTrips.map((trip) => duplicateTrip(trip.id))), relist)) }] : []),
      { label: t('Cut'), run: () => clip(chosen, true) },
      ...(onlyTrips ? [{ label: t('Copy'), run: () => clip(chosen, false) }] : []),
      // Folders of the Stash are copied with what they hold, to be made trips of among the trips.
      ...('folder' in item && treeOf(item.folder.id) === 'stash' ? [{ label: t('Copy'), run: () => copyStash(chosen) }] : []),
      ...pasteEntries,
      ...moveItem(chosen),
      ...(onlyTrips && several
        ? [{ label: t('Merge into “{name}”', { name: first!.name }), run: () => void merge(first!, others) }]
        : []),
      ...groupEntries,
      ...exportEntries,
      ...(!several && 'trip' in item && item.trip.id === openTripId() ? openTripItems(item.trip) : []),
      { label: t('Delete'), run: () => void remove(chosen) },
    ];
  };

  /** Proposes which of the files a folder of the Stash holds itself belong together, or says that none do. */
  const proposeGroups = (folderId: number) => {
    const groups = groupFiles(childFiles(folderId), files().filter((file) => file.folderId !== folderId));
    if (groups.length > 0) setGrouping({ id: folderId, groups });
    else setImportNote({ text: t('Found no files that belong together.'), errors: [] });
  };

  /** What the open trip's menu has besides: its GPX export, its journal, printing and sharing a trip, and closing it, saved. */
  const openTripItems = (trip: TripSummary): MenuItem[] => [
    ...(trip.kind === 'trip'
      ? [
          { label: t('Export GPX…'), run: () => setExportScope({ kind: 'trip' }) },
          { label: t('Journal…'), run: () => setWorkspaceOpen(true) },
          { label: t('Print, share…'), run: () => setShareOpen(true) },
        ]
      : []),
    { label: t('Close'), run: () => void props.onLeave(true) },
  ];
  /** The menu of the top of the library: what is new there and added to it, what is pasted, and the export of every trip. */
  const topMenu = (): MenuItem[] => {
    const files = pasteFilesItem(null);
    return [
      newItem(null),
      addItem(null),
      ...(files.length > 0 ? files : [{ label: t('Paste'), disabled: !takesClip(null), run: () => pasteLibrary(null) }]),
      exportItem(trips()),
    ];
  };

  /** The menu of a tree's top: of the Stash and the Places their folder's, of the trips the library's. */
  const treeMenu = (tab: TreeTab): MenuItem[] => {
    const top = folders().find((f) => f.id === rootOf(tab));
    return top ? itemMenu({ folder: top }) : topMenu();
  };

  /** The folders and trips of a folder, each unfolding to what it holds: folders to theirs, a trip to its days. */
  const Branch = (branch: { tree: TreeTab; parent: number | null }): JSX.Element => (
    <>
      <ForById each={childFolders(branch.parent)}>
        {(f) => (
          <FolderCard
            folder={f()}
            note={heldText(heldOf(f().id), heldNoun(f().id))}
            onOpen={() => clickFolder(f())}
            items={() => itemMenu({ folder: f() })}
            select={select(branch.tree, { folder: f() })}
            fold={{ unfolded: () => isUnfolded({ folder: f() }), current: () => isMarkedFolder(f().id) }}
          >
            <Branch tree={branch.tree} parent={f().id} />
          </FolderCard>
        )}
      </ForById>
      <ForById each={childTrips(branch.parent)}>
        {(trip) => (
          <TripCard
            trip={trip()}
            onOpen={clickTrip}
            items={() => itemMenu({ trip: trip() })}
            select={select(branch.tree, { trip: trip() })}
            fold={{ unfolded: () => trip().kind === 'collection' && isUnfolded({ trip: trip() }), current: () => isMarkedTrip(trip()), open: () => openTripId() === trip().id }}
            pane={trip().kind === 'trip' ? paneOf(trip()) : undefined}
          >
            <Show when={openTripId() === trip().id} fallback={<TripDays
                  trip={trip()}
                  onOpen={(dayId, pane) => {
                    if (pane) reveal('second');
                    props.onOpen(trip(), pane ? { dayId, detailDayId: dayId } : { dayId });
                  }}
                />}>
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
            items={() => itemMenu({ file: file() })}
            select={select(branch.tree, { file: file() })}
            unfolded={isUnfolded({ file: file() })}
            waypoints={{ onShow: () => showWaypoints(file()), items: () => stashPartMenu(waypointsKey(file())), select: selectRow(branch.tree, waypointsKey(file())) }}
            media={{ items: () => stashPartMenu(mediaKey(file())), select: selectRow(branch.tree, mediaKey(file())) }}
          >
            <For each={file().items}>
              {(item) => {
                const at = { file: file(), item };
                return <StashItemRow file={at.file} item={item} onShow={(shown) => showItem(at.file, shown)} items={() => stashItemMenu(at)} select={selectRow(branch.tree, itemKey(at))} />;
              }}
            </For>
          </StashFileCard>
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
    const menu = () => treeMenu(tree.tab);
    return (
      <div hidden={libraryTab() !== tree.tab}>
        <Show when={tree.tab === 'places'}>
          <StandardPlaces />
        </Show>
        <div class="row tab-summary" classList={{ current: isMarkedFolder(root()) }} ref={(el) => cardMenu(el, menu)}>
          <button class="text grow" onClick={() => markFolderShown(root())}>
            <span class="muted detail">{heldText(held(), heldNoun(root()))}</span>
          </button>
          <IconButton label={t('Collapse all')} disabled={!keysWithin(root()).some((key) => unfolded().has(key))} onClick={() => foldAll(root())}>
            <FoldIcon />
          </IconButton>
          <MenuButton of={pathOf(root()) || ALL_TRIPS} items={menu} />
        </div>
        <Show when={tree.tab === 'stash' && stashProblem()}>{(problem) => <p class="error">{errorMessage(problem())}</p>}</Show>
        <ul class="tree" classList={{ 'mark-in-file': tree.tab === 'stash' && markInFile() }}>
          <Branch tree={tree.tab} parent={root()} />
        </ul>
        <Show when={held().folders + held().trips === 0}>
          <p class="muted">{TREES[tree.tab].empty}</p>
        </Show>
      </div>
    );
  };

  /**
   * What the search found in the tree shown, up to the limit, in the tree's place: cards
   * that are selected and have their menus as the tree's have, a folder's and a trip's
   * with where it is.
   */
  const Results = (results: { tree: TreeTab }): JSX.Element => {
    const total = () => foundCount(found());
    return (
      <Show when={total() > 0} fallback={<p class="muted">{t('Nothing found.')}</p>}>
        <ul class="results">
          <For each={listed().folders}>
            {(f) => (
              <FolderCard
                folder={f}
                note={[pathOf(f.parentId), heldText(heldOf(f.id), heldNoun(f.id))].filter(Boolean).join(' · ')}
                onOpen={markFolderShown}
                items={() => itemMenu({ folder: f })}
                select={select(results.tree, { folder: f }, listedKeys)}
              />
            )}
          </For>
          <For each={listed().trips}>
            {(trip) => (
              <TripCard
                trip={trip}
                onOpen={clickTrip}
                items={() => itemMenu({ trip })}
                where={pathOf(trip.folderId) || t('No folder')}
                select={select(results.tree, { trip }, listedKeys)}
                pane={trip.kind === 'trip' ? paneOf(trip) : undefined}
              />
            )}
          </For>
          <For each={listed().files}>
            {(file) => (
              <StashFileCard file={file} where={pathOf(file.folderId)} onOpen={revealFile} items={() => itemMenu({ file })} select={select(results.tree, { file }, listedKeys)} />
            )}
          </For>
          <For each={listed().routes}>{(route) => <RouteCard found={route} onOpen={props.onOpenRoute} items={() => routeMenu(route)} select={selectRow(results.tree, routeKey(route), listedKeys)} />}</For>
          <For each={listed().items}>{(at) => <StashItemRow file={at.file} item={at.item} where={at.file.name} onShow={(item) => revealFile(at.file, item)} items={() => stashItemMenu(at)} select={selectRow(results.tree, itemKey(at), listedKeys)} />}</For>
        </ul>
        <Show when={total() > SEARCH_LIMIT}>
          <p class="muted">{t('{n} more. Refine your search.', { n: total() - SEARCH_LIMIT })}</p>
        </Show>
      </Show>
    );
  };

  return (
    <div class="library" ref={root} hidden={!shownTree()}>
      <Show when={importNote()}>{(note) => <Said note={note()} />}</Show>
      {/* Reading a resource that failed throws; its error is shown instead. */}
      <Switch fallback={<p class="muted">{t('Loading…')}</p>}>
        <Match when={libraryTrips.error ?? libraryFolders.error ?? stashFiles.error}>{(error) => <p class="error">{errorMessage(error())}</p>}</Match>
        <Match when={libraryTrips() && libraryFolders()}>
          <Show
            when={searchedFor() ? shownTree() : undefined}
            keyed
            fallback={
              <>
                <Show when={takesClip(shownFolderId()) && libraryClip()}>
                  {(copied) => (
                    <button class="paste-here" onClick={() => pasteLibrary(shownFolderId())}>
                      {t(copied().move ? 'Move {what} to “{where}”' : 'Paste a copy of {what} into “{where}”', { what: clipText(copied()), where: pathOf(shownFolderId()) || ALL_TRIPS })}
                    </button>
                  )}
                </Show>
                <Show when={stashFilesClip() && pasteFilesItem(shownFolderId())[0]}>
                  {(paste) => (
                    <button class="paste-here" onClick={() => paste().run()}>
                      {t('Import {what} into “{where}”', { what: countsText(stashFilesClip()!.folders.length, stashFilesClip()!.files.length, 'file'), where: pathOf(shownFolderId()) || ALL_TRIPS })}
                    </button>
                  )}
                </Show>
                <For each={TREE_TABS}>{(tree) => <Tree tab={tree} />}</For>
              </>
            }
          >
            {(tree) => <Results tree={tree} />}
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
        title={renamed()?.title ?? ''}
        open={renamed() !== undefined}
        placeholder={renamed()?.placeholder ?? ''}
        initial={renamed()?.name}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => {
          const { name: before, save, saved } = renamed()!;
          if (name !== before) void runLibrary(() => save(name), saved);
        }}
      />
      <GroupDialog
        grouping={grouping()}
        onClose={() => setGrouping(undefined)}
        onApply={(groups) => {
          const { id } = grouping()!;
          if (groups.length > 0) takeOut(() => applyGroups(id, groups), relist);
        }}
      />
    </div>
  );
}
