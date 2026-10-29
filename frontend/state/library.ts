import { createSignal } from 'solid-js';

/** The folder the trip list shows; none at the top. It outlives the list while a trip is open, so leaving the trip goes back to it. */
export const [listFolderId, setListFolderId] = createSignal<number>();

/** Whether the library shows the duplicates report instead of the list; it too outlives a trip opened from it. */
export const [showingDuplicates, setShowingDuplicates] = createSignal(false);
