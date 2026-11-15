import { createEffect, createRoot, on } from 'solid-js';
import type { PartKind } from '../routing/dayEdit';
import { isRowSelected, menuRows, NOTHING_SELECTED, rowSelect, selectIn, selectionOf, selectionOwner, toggleRow, type RowSelect } from '../ui/selection';
import { openTripId, selectedDayId } from './trip';

/** What of the open trip is selected: a kind of its parts, or the recordings or the media on its days, by their id as text. */
export type Selectable = PartKind | 'recording' | 'media';

const KINDS: readonly Selectable[] = ['day', 'route', 'stop', 'recording', 'media'];

/**
 * The days, routes, stops, recordings or media of the open trip that are selected to be acted on
 * together: each kind a list of its own, so of one kind at a time; forgotten with the
 * trip, and what is selected of a day with the day shown.
 */
const selectedKind = (): Selectable | undefined => KINDS.find((kind) => kind === selectionOwner());

export function clearPartSelection(): void {
  const kind = selectedKind();
  if (kind) selectIn(kind, NOTHING_SELECTED);
}

createRoot(() => {
  createEffect(on(openTripId, clearPartSelection, { defer: true }));
  createEffect(on(selectedDayId, () => selectedKind() !== 'day' && clearPartSelection(), { defer: true }));
});

export const isPartSelected = (kind: Selectable, id: string): boolean => isRowSelected(kind, id);

/** How a part's row is selected, among the parts of its list in view, which `order` gives by id. */
export const partSelect = (kind: Selectable, id: string, order: () => readonly string[]): RowSelect => rowSelect(kind, id, order);

/** Adds the part to the selection or takes it away. */
export const togglePart = (kind: Selectable, id: string): void => toggleRow(kind, id);

/** The parts a part's menu acts on: the selection where it holds the part, else the part alone. */
export const partsOfMenu = (kind: Selectable, id: string): string[] => menuRows(kind, id);

/** The parts selected, where any are: their kind and ids. */
export function selectedParts(): { kind: Selectable; ids: string[] } | undefined {
  const kind = selectedKind();
  return kind && { kind, ids: [...selectionOf(kind)] };
}
