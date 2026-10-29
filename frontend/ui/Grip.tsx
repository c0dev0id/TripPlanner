import { followPointer } from './followPointer';
import { GripIcon } from './icons';

/**
 * Drags the list item the pressed handle belongs to into another place in its list: the
 * item follows the pointer, the others make room, and `onDrop` gets the place it goes to,
 * counted in the list as it will be.
 */
function dragToSort(e: PointerEvent, onDrop: (to: number) => void): void {
  if (e.button !== 0) return;
  const item = (e.currentTarget as HTMLElement).closest('li')!;
  const items = [...item.parentElement!.children].filter((c): c is HTMLLIElement => c instanceof HTMLLIElement);
  const from = items.indexOf(item);
  const middles = items.map((i) => {
    const box = i.getBoundingClientRect();
    return box.top + box.height / 2;
  });
  const height = item.getBoundingClientRect().height;
  const startY = e.clientY;
  let to = from;
  const follow = (m: PointerEvent) => {
    const dy = m.clientY - startY;
    to = middles.filter((middle, i) => i !== from && middle < middles[from]! + dy).length;
    item.style.transform = `translateY(${dy}px)`;
    items.forEach((other, i) => {
      if (i === from) return;
      const shift = i > from && i <= to ? -height : i < from && i >= to ? height : 0;
      other.style.transform = shift === 0 ? '' : `translateY(${shift}px)`;
    });
  };
  item.classList.add('dragged');
  followPointer(e, follow, () => {
    for (const i of items) i.style.transform = '';
    item.classList.remove('dragged');
    if (to !== from) onDrop(to);
  });
}

/** The handle a list item is dragged by into another place; the arrow keys move it one place, within the list's ends. */
export function Grip(props: { label: string; index: number; onMove: (to: number) => void }) {
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    props.onMove(props.index + (e.key === 'ArrowUp' ? -1 : 1));
  };
  return (
    <button type="button" class="icon grip" title={props.label} aria-label={props.label} onPointerDown={(e) => dragToSort(e, props.onMove)} onKeyDown={key}>
      <GripIcon />
    </button>
  );
}
