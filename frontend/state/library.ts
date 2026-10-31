import { createResource, createRoot, createSignal } from 'solid-js';
import { errorMessage, listFolders, listTrips } from '../api';

/** Where the explorer is in the library, and what it found there. */

/** The folder the explorer shows; none at the top. It outlives an open trip, so leaving the trip goes back to it. */
export const [listFolderId, setListFolderId] = createSignal<number>();

/** Whether the explorer shows the duplicates report instead of the folder; it too outlives a trip opened from it. */
export const [showingDuplicates, setShowingDuplicates] = createSignal(false);

/** The search typed into the explorer; while there is one, what it finds stands in for the list. */
export const [query, setQuery] = createSignal('');

const library = createRoot(() => {
  const [trips, { refetch: refetchTrips }] = createResource(listTrips);
  const [folders, { refetch: refetchFolders }] = createResource(listFolders);
  return { trips, folders, refetchTrips, refetchFolders };
});

/** The user's trips and folders as the server last listed them. */
export const libraryTrips = library.trips;
export const libraryFolders = library.folders;

/** Lists the trips, or the folders, afresh after they changed. */
export const relistTrips = (): void => void library.refetchTrips();
export const relistFolders = (): void => void library.refetchFolders();

/** Why the last request of the library failed, until the next one. */
export const [libraryProblem, setLibraryProblem] = createSignal<string>();

/** Runs a request of the library: its failure is said, and `then` runs after success. */
export async function runLibrary(work: () => Promise<unknown>, then?: () => void): Promise<void> {
  setLibraryProblem(undefined);
  try {
    await work();
    then?.();
  } catch (error) {
    setLibraryProblem(errorMessage(error));
  }
}

/** How the last folder import goes or went, and what it could not read or save. */
export const [importNote, setImportNote] = createSignal<{ text: string; errors: string[] }>();

/** Shows a folder, none for the top, its list rather than what a search found. */
export function showFolder(id: number | undefined): void {
  setListFolderId(id);
  setQuery('');
}
