/** Rows of a list selected by key, and the row a Shift-click selects from. */
export interface Selection<K> {
  /** In the order they were selected; a run from its anchor on. */
  keys: ReadonlySet<K>;
  anchor?: K;
}

export const NOTHING_SELECTED: Selection<never> = { keys: new Set() };

/** The row alone. */
const only = <K>(key: K): Selection<K> => ({ keys: new Set([key]), anchor: key });

/** The selection with the row added, or taken away where it was in it. */
export function toggled<K>(selection: Selection<K>, key: K): Selection<K> {
  const keys = new Set(selection.keys);
  if (!keys.delete(key)) keys.add(key);
  return { keys, anchor: key };
}

/**
 * The selection after a click on the row `key` of the rows in `order`: the row alone; with
 * Cmd or Ctrl held the row added or taken away; with Shift held the rows from the anchor
 * to it, the anchor first.
 */
export function clickSelect<K>(selection: Selection<K>, order: readonly K[], key: K, click: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>): Selection<K> {
  if (click.shiftKey && selection.anchor !== undefined && order.includes(selection.anchor)) {
    const [a, b] = [order.indexOf(selection.anchor), order.indexOf(key)];
    const run = order.slice(Math.min(a, b), Math.max(a, b) + 1);
    return { keys: new Set(a <= b ? run : run.reverse()), anchor: selection.anchor };
  }
  if (click.metaKey || click.ctrlKey) return toggled(selection, key);
  return only(key);
}

/** The selection a row's menu acts on: the selection where it holds the row, else the row alone. */
export const menuSelection = <K>(selection: Selection<K>, key: K): Selection<K> => (selection.keys.has(key) ? selection : only(key));
