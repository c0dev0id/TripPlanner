import { createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { listFolders, listTrips } from '../api';
import { heldCounts } from '../library/folders';
import { createRequest } from '../ui/request';

/** Where the explorer is in the library, and what it found there. */

/** The folder the explorer was sent to, null for the top. It outlives an open trip, so leaving the trip goes back to it. */
const [listFolderId, setListFolderId] = createSignal<number | null>(null);

/** Whether the explorer shows the duplicates report instead of the folder; it too outlives a trip opened from it. */
export const [showingDuplicates, setShowingDuplicates] = createSignal(false);

/** The search typed into the explorer; while there is one, what it finds stands in for the list. */
export const [query, setQuery] = createSignal('');

const library = createRoot(() => {
  const [trips, { refetch: refetchTrips }] = createResource(listTrips);
  const [folders, { refetch: refetchFolders }] = createResource(listFolders);
  /** The folder sent to while it exists, else the top: a folder deleted elsewhere leaves the explorer at the top. */
  const shownFolderId = createMemo(() => (folders()?.some((f) => f.id === listFolderId()) ? listFolderId() : null));
  const heldOf = createMemo(() => heldCounts(folders() ?? [], trips() ?? []));
  return { trips, folders, refetchTrips, refetchFolders, shownFolderId, heldOf };
});

/** The user's trips and folders as the server last listed them. */
export const libraryTrips = library.trips;
export const libraryFolders = library.folders;

/** The folder the explorer shows, null for the top. */
export const shownFolderId = library.shownFolderId;

/** How many folders and trips each folder holds itself, by its id, null for the top. */
export const heldOf = (id: number | null) => library.heldOf()(id);

/** Lists the trips, or the folders, afresh after they changed. */
export const relistTrips = (): void => void library.refetchTrips();
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

/** Shows a folder, null for the top: its list, rather than the duplicates report or what a search found. */
export function showFolder(id: number | null): void {
  setListFolderId(id);
  setShowingDuplicates(false);
  setQuery('');
}

/** Shows the duplicates report in place of the folder's list. */
export function showDuplicates(): void {
  setShowingDuplicates(true);
  setQuery('');
}
