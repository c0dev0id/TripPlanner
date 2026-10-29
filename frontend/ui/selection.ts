/** Rows of a list selected by key, and the row a Shift-click selects from. */
export interface Selection {
  /** In the order they were selected; a run from its anchor on. */
  keys: ReadonlySet<string>;
  anchor?: string;
}

export const NOTHING_SELECTED: Selection = { keys: new Set() };

/**
 * The selection after a click on the row `key` of the rows in `order`: the row alone; with
 * `toggle` (Cmd or Ctrl held) the row added or taken away; with `range` (Shift held) the
 * rows from the anchor to it, the anchor first.
 */
export function clickSelect(selection: Selection, order: readonly string[], key: string, how: { toggle: boolean; range: boolean }): Selection {
  if (how.range && selection.anchor !== undefined && order.includes(selection.anchor)) {
    const [a, b] = [order.indexOf(selection.anchor), order.indexOf(key)];
    const run = order.slice(Math.min(a, b), Math.max(a, b) + 1);
    return { keys: new Set(a <= b ? run : run.reverse()), anchor: selection.anchor };
  }
  if (how.toggle) {
    const keys = new Set(selection.keys);
    if (!keys.delete(key)) keys.add(key);
    return { keys, anchor: key };
  }
  return { keys: new Set([key]), anchor: key };
}
