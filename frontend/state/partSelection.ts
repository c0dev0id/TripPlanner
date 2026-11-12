import { createEffect, createRoot, on } from 'solid-js';
import type { PartKind } from '../routing/dayEdit';
import { clickSelect, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, selectionOwner, toggled } from '../ui/selection';
import { openTripId, selectedDayId } from './trip';

/** What of the open trip is selected: a kind of its parts, or the recordings on its days, by their id as text. */
export type Selectable = PartKind | 'recording';

const KINDS: readonly Selectable[] = ['day', 'route', 'stop', 'recording'];

/**
 * The days, routes, stops or recordings of the open trip that are selected to be acted on
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

export const isPartSelected = (kind: Selectable, id: string): boolean => selectionOf(kind).keys.has(id);

/** A click on a part with Cmd, Ctrl or Shift held, among the parts of its list in `order`. */
export function clickPart(kind: Selectable, order: readonly string[], id: string, click: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): void {
  selectIn(kind, clickSelect(selectionOf(kind), order, id, click));
}

/** Adds the part to the selection or takes it away. */
export function togglePart(kind: Selectable, id: string): void {
  selectIn(kind, toggled(selectionOf(kind), id));
}

/** The parts a part's menu acts on: the selection where it holds the part, else the part alone, which is then the selection. */
export function partsOfMenu(kind: Selectable, id: string): string[] {
  const rows = menuSelection(selectionOf(kind), id);
  if (rows.keys.size > 1) return [...rows.keys];
  clearPartSelection();
  return [id];
}

/** The parts selected, where any are: their kind and ids. */
export function selectedParts(): { kind: Selectable; ids: string[] } | undefined {
  const kind = selectedKind();
  return kind && { kind, ids: [...selectionOf(kind).keys] };
}
