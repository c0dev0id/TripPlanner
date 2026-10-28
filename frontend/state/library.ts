import { createSignal } from 'solid-js';

/** The folder the trip list shows; none at the top. It outlives the list while a trip is open, so leaving the trip goes back to it. */
export const [listFolderId, setListFolderId] = createSignal<number>();
