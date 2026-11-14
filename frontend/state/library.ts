import { createMemo, createResource, createRoot, createSelector, createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { changeTrip, listFolders, listStash, listTrips, fetchOutlines, type OutlineDay, type Progress } from '../api';
import { heldCounts, kindAround } from '../library/folders';
import type { FolderKind } from '../model/trip';
import * as dayEdit from '../routing/dayEdit';
import { createRequest } from '../ui/request';
import { openTripId, removeParts } from './trip';

/** The library as the server lists it, and where the user is in it. */

/** The library's views, a tab each: the collections of planning material, the trips, the lists of places, and the rides as recorded. */
export type LibraryTab = 'stash' | 'trips' | 'places' | 'recordings';
/** The tabs that show a tree of folders. */
export type TreeTab = Exclude<LibraryTab, 'recordings'>;
export const TREE_TABS: readonly TreeTab[] = ['stash', 'trips', 'places'];
export const LIBRARY_TABS: readonly LibraryTab[] = [...TREE_TABS, 'recordings'];

/** The tab whose tree a folder of the kind is in. */
const TAB_OF: Record<FolderKind, TreeTab> = { collections: 'stash', folder: 'trips', places: 'places' };

/** What the tabs are called. */
export const TAB_NAMES: Record<LibraryTab, string> = { stash: t('Stash'), trips: t('Trips'), places: t('Places'), recordings: t('Recordings') };

/** The tab shown, and the tree last shown, which stays the one the address names while the rides are. */
const [libraryTab, setTab] = createSignal<LibraryTab>('trips');
const [treeTab, setTreeTab] = createSignal<TreeTab>('trips');
export { libraryTab };

/** Shows a tab; what the others show stays as it is. */
export function showTab(to: LibraryTab): void {
  setTab(to);
  if (to !== 'recordings') setTreeTab(to);
}

/** The folder asked for in each tree, none for its top: the one the tree marks, and that takes what is pasted with the keys or from the line that offers it. */
const [markedFolders, setMarkedFolders] = createSignal<Partial<Record<TreeTab, number>>>({});

/** Whether the report of the routes kept more than once stands in the pane between the library and the map, instead of a day. */
export const [showingDuplicates, setShowingDuplicates] = createSignal(false);

/** The trip being opened and how far that has come: its document on its way, or arrived and being put on the map. */
export const [opening, setOpening] = createSignal<{ tripId: number; progress: Progress | 'arrived' }>();

/** Whether the trip is the one being opened; told to that trip's row alone, however often the progress changes. */
export const isOpening = createRoot(() => createSelector(createMemo(() => opening()?.tripId)));

/** Whether a trip's document is on its way, during which no other is asked for. Once it is here the library answers again, while the map draws. */
export const fetchingTrip = createRoot(() =>
  createMemo(() => {
    const o = opening();
    return o !== undefined && o.progress !== 'arrived';
  }),
);

/** The search typed into the library, which limits the tab shown to what it finds there. */
export const [query, setQuery] = createSignal('');

/** What the search looks for, as it is compared with names in lower case; empty while nothing is typed. */
export const searchedFor = createRoot(() => createMemo(() => query().trim().toLowerCase()));

/** The special folders are named as the tabs they are the tops of. */
const SPECIAL_NAMES = { collections: TAB_NAMES.stash, places: TAB_NAMES.places };

const library = createRoot(() => {
  const [trips, { refetch: refetchTrips }] = createResource(listTrips);
  const [folders, { refetch: refetchFolders }] = createResource(async () => (await listFolders()).map((f) => (f.kind === 'folder' ? f : { ...f, name: SPECIAL_NAMES[f.kind] })));
  const [outlines, { refetch: refetchOutlines }] = createResource(fetchOutlines);
  const [files, { refetch: refetchFiles }] = createResource(listStash);
  /** The top of each tree: none for the trips', the folder of their kind for the others' once the folders are listed. */
  const roots = createMemo((): Record<TreeTab, number | null> => {
    const special = (kind: FolderKind) => folders()?.find((f) => f.kind === kind)?.id ?? null;
    return { stash: special('collections'), trips: null, places: special('places') };
  });
  /** The folder marked in each tree while it exists, else the tree's top: a folder deleted elsewhere leaves its tree at the top. */
  const marked = createMemo((): Record<TreeTab, number | null> => {
    const of = (tree: TreeTab) => (folders()?.some((f) => f.id === markedFolders()[tree]) ? markedFolders()[tree]! : roots()[tree]);
    return { stash: of('stash'), trips: of('trips'), places: of('places') };
  });
  const heldOf = createMemo(() => heldCounts(folders() ?? [], [...(trips() ?? []), ...(files() ?? [])]));
  return { trips, folders, outlines, files, refetchTrips, refetchFolders, refetchOutlines, refetchFiles, roots, marked, heldOf };
});

/** The user's trips and folders as the server last listed them. */
export const libraryTrips = library.trips;
export const libraryFolders = library.folders;

/** The files of the Stash as the server last listed them. */
export const stashFiles = library.files;

/** The outline of a trip, day by day, as last fetched: none while they load, or where they could not be had. */
export const outlineOf = (tripId: number): OutlineDay[] | undefined => (library.outlines.error ? undefined : library.outlines()?.[tripId]);

/** The kind of the special folder the trip is in or under; a plain folder's for a trip anywhere else. */
const folderKindOf = (tripId: number | undefined): FolderKind =>
  kindAround(library.folders.error ? [] : (library.folders() ?? []), (library.trips.error ? undefined : library.trips())?.find((trip) => trip.id === tripId)?.folderId ?? null);

/** Whether the trip is a list of places: a collection in the folder for places or a folder in it. */
export const isPlaceList = (tripId: number | undefined): boolean => folderKindOf(tripId) === 'places';

/** Whether the trip is planning material: a collection in the folder for collections or a folder in it. */
export const isPlanningMaterial = (tripId: number | undefined): boolean => folderKindOf(tripId) === 'collections';

/** What a trip is being made from, in its dialog: the collection `id`, whole or the sections named, and the name suggested for the trip. */
export interface TripSource {
  id: number;
  dayIds?: string[];
  name: string;
}
export const [tripSource, setTripSource] = createSignal<TripSource>();

/** The folder at the top of a tree, which its tab stands for: null for the trips', and for the others' while the folders are not listed. */
export const rootOf = (tree: TreeTab): number | null => library.roots()[tree];

/** The tree a folder is in, null for the top of the trips'. */
export const treeOf = (folderId: number | null): TreeTab => TAB_OF[kindAround(library.folders.error ? [] : (library.folders() ?? []), folderId)];

/** The tree the open trip is in; none while no trip is open, or the open one is not listed yet. */
export const openTree = createRoot(() =>
  createMemo(() => {
    const trip = (library.trips.error ? undefined : library.trips())?.find((listed) => listed.id === openTripId());
    return trip && treeOf(trip.folderId);
  }),
);

/** The folder marked in a tree: the one asked for while it exists, else the tree's top. */
export const markedFolderOf = (tree: TreeTab): number | null => library.marked()[tree];

/** The folder shown: the one marked in the tree shown or, with the rides shown, in the tree shown last. */
export const shownFolderId = (): number | null => markedFolderOf(treeTab());

/** How many folders and trips each folder holds itself, by its id, null for the top. */
export const heldOf = (id: number | null) => library.heldOf()(id);

/** Lists the trips, or the folders, afresh after they changed. */
export const relistTrips = (): void => {
  void library.refetchTrips();
  void library.refetchOutlines();
};
export const relistFolders = (): void => void library.refetchFolders();
export const relistStash = (): void => void library.refetchFiles();

const requests = createRequest();

/** Why the last request of the library failed, until the next one. */
export const libraryProblem = requests.error;

/** Runs a request of the library: its failure is said, and `then` runs after success. */
export const runLibrary = (work: () => Promise<unknown>, then?: () => void): Promise<void> =>
  requests.run(async () => {
    await work();
    then?.();
  });

/**
 * Deletes routes from their trips: from the open trip as an edit of it, saved with it
 * and undone like any other, from the others on the server, each trip changed once,
 * side by side. The stops bound to them stay, free.
 */
export async function deleteRoutes(routes: readonly { tripId: number; routeId: string }[]): Promise<void> {
  const idsIn = (tripId: number) => routes.filter((route) => route.tripId === tripId).map((route) => route.routeId);
  const tripIds = new Set(routes.map((route) => route.tripId));
  if (tripIds.delete(openTripId()!)) removeParts('route', idsIn(openTripId()!));
  if (tripIds.size === 0) return;
  await Promise.all([...tripIds].map((id) => changeTrip(id, (trip) => dayEdit.removeParts(trip, 'route', idsIn(id)))));
  relistTrips();
}

/** How the last folder import goes or went, and what it could not read or save. */
export const [importNote, setImportNote] = createSignal<{ text: string; errors: string[] }>();

/** Makes a folder the one shown, null for the top of the trips: its tree is shown with the folder marked, and a search ends. */
export function showFolder(id: number | null): void {
  const tree = treeOf(id);
  setMarkedFolders({ ...markedFolders(), [tree]: id ?? undefined });
  showTab(tree);
  setQuery('');
}
