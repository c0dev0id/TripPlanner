import { createSignal } from 'solid-js';

/** Rows of a list selected by key, in the order they were selected; a run from the row it was started at. */
export type Selection<K> = ReadonlySet<K>;

export const NOTHING_SELECTED: Selection<never> = new Set();

/** The selection with the row added, or taken away where it was in it. */
export function toggled<K>(selection: Selection<K>, key: K): Selection<K> {
  const keys = new Set(selection);
  if (!keys.delete(key)) keys.add(key);
  return keys;
}

/**
 * The selection after a click that selects on the row `key` of the rows in `order`: with
 * Shift held the rows from `anchor`, the row clicked before, to it and no others, the
 * anchor first, or the row alone where there is no anchor among them; with Cmd or Ctrl
 * held the row added or taken away.
 */
export function clickSelect<K>(selection: Selection<K>, order: readonly K[], key: K, click: Pick<MouseEvent, 'shiftKey'>, anchor?: K): Selection<K> {
  if (!click.shiftKey) return toggled(selection, key);
  if (anchor === undefined || !order.includes(anchor)) return new Set([key]);
  const [a, b] = [order.indexOf(anchor), order.indexOf(key)];
  const run = order.slice(Math.min(a, b), Math.max(a, b) + 1);
  return new Set(a <= b ? run : run.reverse());
}

/** The selection a row's menu acts on: the selection where it holds the row, else the row alone. */
export const menuSelection = <K>(selection: Selection<K>, key: K): Selection<K> => (selection.has(key) ? selection : new Set([key]));

/**
 * The one selection the keys act on: the rows selected in one list, which it is held by
 * under a name of its own. Selecting in a list takes the selection from whichever held
 * it, so that no two lists have rows selected at once.
 */
const [held, setHeld] = createSignal<{ owner: string; rows: Selection<string> }>();

/** The row clicked last, in whichever list: where a Shift-click in that list selects from. Nothing shows it. */
let clicked: { owner: string; key: string } | undefined;

/** The list that holds the selection; none while nothing is selected. */
export const selectionOwner = (): string | undefined => held()?.owner;

/** The rows selected in the list `owner`; none while another list holds the selection. */
export const selectionOf = (owner: string): Selection<string> => (held()?.owner === owner ? held()!.rows : NOTHING_SELECTED);

/** Makes the rows the selection, held by the list `owner`; with no rows the list lets go of what it held. */
export function selectIn(owner: string, rows: Selection<string>): void {
  if (rows.size > 0) setHeld({ owner, rows });
  else if (held()?.owner === owner) setHeld(undefined);
}

/** Whether a click is one that selects: with Cmd, Ctrl or Shift held. */
export const selects = (click: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): boolean => click.metaKey || click.ctrlKey || click.shiftKey;

/**
 * A click on the row `key` of the list `owner`, whose rows are in `order`. With Cmd, Ctrl
 * or Shift held it selects, a Shift run starting at the row clicked last; without, it
 * lets go of whatever is selected. Either way the row is the one clicked last. Whether
 * it selected: a click that did not is left to open its row.
 */
export function clickRow(owner: string, order: readonly string[], key: string, click: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): boolean {
  const anchor = clicked?.owner === owner ? clicked.key : undefined;
  clicked = { owner, key };
  if (selects(click)) selectIn(owner, clickSelect(selectionOf(owner), order, key, click, anchor));
  else setHeld(undefined);
  return selects(click);
}

/** Adds the row to the selection of the list `owner` or takes it away, as its pad does; the row is the one clicked last. */
export function toggleRow(owner: string, key: string): void {
  clicked = { owner, key };
  selectIn(owner, toggled(selectionOf(owner), key));
}
