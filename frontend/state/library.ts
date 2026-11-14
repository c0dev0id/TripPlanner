import { createMemo, createResource, createRoot, createSelector, createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { listFolders, listTrips, fetchOutlines, type OutlineDay, type Progress } from '../api';
import { heldCounts, kindAround } from '../library/folders';
import type { FolderKind } from '../model/trip';
import { createRequest } from '../ui/request';

/** The library as the server lists it, and where the user is in it. */

/** The folder asked for, null for the top: the one the tree marks, and that takes what is pasted with the keys or from the line that offers it. */
const [listFolderId, setListFolderId] = createSignal<number | null>(null);

/** Whether the duplicates report stands in the pane between the library and the map. */
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

/** The search typed into the library; while there is one, what it finds stands in for the tree. */
export const [query, setQuery] = createSignal('');

/** The special folders are named in the page's language. */
const SPECIAL_NAMES = { recordings: t('Recordings'), collections: t('Collections'), places: t('Places') };

const library = createRoot(() => {
  const [trips, { refetch: refetchTrips }] = createResource(listTrips);
  const [folders, { refetch: refetchFolders }] = createResource(async () => (await listFolders()).map((f) => (f.kind === 'folder' ? f : { ...f, name: SPECIAL_NAMES[f.kind] })));
  const [outlines, { refetch: refetchOutlines }] = createResource(fetchOutlines);
  /** The folder sent to while it exists, else the top: a folder deleted elsewhere leaves the explorer at the top. */
  const shownFolderId = createMemo(() => (folders()?.some((f) => f.id === listFolderId()) ? listFolderId() : null));
  const heldOf = createMemo(() => heldCounts(folders() ?? [], trips() ?? []));
  return { trips, folders, outlines, refetchTrips, refetchFolders, refetchOutlines, shownFolderId, heldOf };
});

/** The user's trips and folders as the server last listed them. */
export const libraryTrips = library.trips;
export const libraryFolders = library.folders;

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

/** The folder shown, null for the top: the one asked for while it exists. */
export const shownFolderId = library.shownFolderId;

/** How many folders and trips each folder holds itself, by its id, null for the top. */
export const heldOf = (id: number | null) => library.heldOf()(id);

/** Lists the trips, or the folders, afresh after they changed. */
export const relistTrips = (): void => {
  void library.refetchTrips();
  void library.refetchOutlines();
};
export const relistFolders = (): void => void library.refetchFolders();

const requests = createRequest();

/** Why the last request of the library failed, until the next one. */
export const libraryProblem = requests.error;

/** Runs a request of the library: its failure is said, and `then` runs after success. */
export const runLibrary = (work: () => Promise<unknown>, then?: () => void): Promise<void> =>
  requests.run(async () => {
    await work();
    then?.();
  });

/** How the last folder import goes or went, and what it could not read or save. */
export const [importNote, setImportNote] = createSignal<{ text: string; errors: string[] }>();

/** Makes a folder the one shown, null for the top, and ends a search. */
export function showFolder(id: number | null): void {
  setListFolderId(id);
  setQuery('');
}
