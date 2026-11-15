import { createRoot, createSelector, createSignal } from 'solid-js';

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

/** The row clicked last, in whichever list, and whether by a plain click: where a Shift-click in that list selects from, and what a Cmd-click there starts a selection with. Nothing shows it. */
let clicked: { owner: string; key: string; plain: boolean } | undefined;

/** The list that holds the selection; none while nothing is selected. */
export const selectionOwner = (): string | undefined => held()?.owner;

/** The rows selected in the list `owner`; none while another list holds the selection. */
export const selectionOf = (owner: string): Selection<string> => (held()?.owner === owner ? held()!.rows : NOTHING_SELECTED);

/** Whether a row, named by its list and its key on two lines, is selected: told to that row alone when the selection changes. */
const isHeld = createRoot(() =>
  createSelector(held, (row: string, selection) => {
    const at = row.indexOf('\n');
    return selection?.owner === row.slice(0, at) && selection.rows.has(row.slice(at + 1));
  }),
);

/** Whether the row `key` is selected in the list `owner`. */
export const isRowSelected = (owner: string, key: string): boolean => isHeld(`${owner}\n${key}`);

/** Makes the rows the selection, held by the list `owner`; with no rows the list lets go of what it held. */
export function selectIn(owner: string, rows: Selection<string>): void {
  if (rows.size > 0) setHeld({ owner, rows });
  else if (held()?.owner === owner) setHeld(undefined);
}

/** Whether a click is one that selects: with Cmd, Ctrl or Shift held. */
export const selects = (click: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): boolean => click.metaKey || click.ctrlKey || click.shiftKey;

/**
 * A click on the row `key` of the list `owner`, whose rows are in `order`. With Cmd, Ctrl
 * or Shift held it selects, a Shift run starting at the row clicked last; a Cmd or Ctrl
 * click that starts a selection takes in the row a plain click opened last, as a file
 * manager does. Without, it lets go of whatever is selected. Either way the row is the
 * one clicked last. Whether it selected: a click that did not is left to open its row.
 */
export function clickRow(owner: string, order: readonly string[], key: string, click: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): boolean {
  const last = clicked?.owner === owner ? clicked : undefined;
  clicked = { owner, key, plain: !selects(click) };
  if (!selects(click)) {
    setHeld(undefined);
    return false;
  }
  const opened = !click.shiftKey && last?.plain && last.key !== key && order.includes(last.key) && selectionOf(owner).size === 0;
  selectIn(owner, clickSelect(opened ? new Set([last.key]) : selectionOf(owner), order, key, click, last?.key));
  return true;
}

/** Adds the row to the selection of the list `owner` or takes it away, as its pad does; the row is the one clicked last. */
export function toggleRow(owner: string, key: string): void {
  clicked = { owner, key, plain: false };
  selectIn(owner, toggled(selectionOf(owner), key));
}

/**
 * The rows a row's menu acts on in the list `owner`: the rows selected there where they
 * are several and the row is one of them, else the row alone, which lets go of whatever
 * is selected, as a plain click does.
 */
export function menuRows(owner: string, key: string): string[] {
  const rows = menuSelection(selectionOf(owner), key);
  if (rows.size > 1) return [...rows];
  setHeld(undefined);
  return [key];
}

/** How a row takes part in the selection of its list: whether it is selected, what its pad does, and what a click does. */
export interface RowSelect {
  selected: () => boolean;
  onToggle: () => void;
  /** Whether the click selected, and so opens nothing. */
  onClick: (e: MouseEvent) => boolean;
}

/** How the row `key` of the list `owner` is selected, among the rows in view there, top to bottom, which `order` gives. */
export const rowSelect = (owner: string, key: string, order: () => readonly string[]): RowSelect => ({
  selected: () => isRowSelected(owner, key),
  onToggle: () => toggleRow(owner, key),
  onClick: (e) => clickRow(owner, order(), key, e),
});
