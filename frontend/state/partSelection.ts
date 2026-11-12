import { createEffect, createRoot, createSignal, on } from 'solid-js';
import type { PartKind } from '../routing/dayEdit';

/** What of the open trip is selected: a kind of its parts, or the recordings on its days, by their id as text. */
export type Selectable = PartKind | 'recording';
import { clickSelect, menuSelection, toggled, type Selection } from '../ui/selection';
import { openTripId, selectedDayId } from './trip';

/**
 * The days, routes, stops or recordings of the open trip that are selected to be acted on together:
 * of one kind at a time, forgotten with the trip, and what is selected of a day with the day shown.
 */
const [selected, setSelected] = createSignal<{ kind: Selectable; rows: Selection<string> }>();

createRoot(() => {
  createEffect(on(openTripId, () => setSelected(undefined), { defer: true }));
  createEffect(on(selectedDayId, () => selected()?.kind !== 'day' && setSelected(undefined), { defer: true }));
});

const rowsOf = (kind: Selectable): Selection<string> => (selected()?.kind === kind ? selected()!.rows : { keys: new Set() });

export const isPartSelected = (kind: Selectable, id: string): boolean => rowsOf(kind).keys.has(id);

/** A click on a part with Cmd, Ctrl or Shift held, among the parts of its list in `order`. */
export function clickPart(kind: Selectable, order: readonly string[], id: string, click: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): void {
  setSelected({ kind, rows: clickSelect(rowsOf(kind), order, id, click) });
}

/** Adds the part to the selection or takes it away. */
export function togglePart(kind: Selectable, id: string): void {
  setSelected({ kind, rows: toggled(rowsOf(kind), id) });
}

/** The parts a part's menu acts on: the selection where it holds the part, else the part alone, which is then the selection. */
export function partsOfMenu(kind: Selectable, id: string): string[] {
  const rows = menuSelection(rowsOf(kind), id);
  if (rows.keys.size > 1) return [...rows.keys];
  if (selected()) setSelected(undefined);
  return [id];
}

/** The parts selected, where any are: their kind and ids. */
export function selectedParts(): { kind: Selectable; ids: string[] } | undefined {
  const parts = selected();
  return parts && parts.rows.keys.size > 0 ? { kind: parts.kind, ids: [...parts.rows.keys] } : undefined;
}

export const clearPartSelection = (): void => void setSelected(undefined);
