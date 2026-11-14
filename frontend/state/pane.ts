import { createSignal } from 'solid-js';

/**
 * Whether the report of the routes kept more than once stands in the pane between the
 * library and the map, instead of a day. A day that is picked takes the pane; one that a
 * trip is merely opened at, as from the report itself, does not.
 */
export const [showingDuplicates, setShowingDuplicates] = createSignal(false);
