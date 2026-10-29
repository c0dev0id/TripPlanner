import { createMemo, For, type Accessor, type JSX } from 'solid-js';

/**
 * A For that keeps each item's row by its id instead of by the object: an edit replaces a
 * changed item with a copy, and its row is updated rather than built anew. A row's item
 * changes only when that item does.
 */
export function ForById<T extends { id: string }>(props: { each: readonly T[]; children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element }): JSX.Element {
  const byId = createMemo(() => new Map(props.each.map((item) => [item.id, item])));
  return <For each={[...byId().keys()]}>{(id, index) => props.children(createMemo(() => byId().get(id)!), index)}</For>;
}
