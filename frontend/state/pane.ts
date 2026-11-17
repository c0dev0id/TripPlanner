import { createSignal } from 'solid-js';

/**
 * Whether the report of the routes kept more than once stands in the pane between the
 * library and the map, in the place of the open trip's. A pad that opens a trip, a day's
 * contents or a category's places takes the pane back; a day that is merely shown on the
 * map, as from the report itself, does not.
 */
export const [showingDuplicates, setShowingDuplicates] = createSignal(false);
