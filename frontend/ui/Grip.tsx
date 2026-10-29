import { GripIcon } from './icons';

/**
 * Drags the list item the pressed handle belongs to into another place in its list: the
 * item follows the pointer, the others make room, and `onDrop` gets the place it goes to,
 * counted in the list as it will be.
 */
function dragToSort(e: PointerEvent, onDrop: (to: number) => void): void {
  if (e.button !== 0) return;
  const handle = e.currentTarget as HTMLElement;
  const item = handle.closest('li')!;
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
  const drop = () => {
    handle.removeEventListener('pointermove', follow);
    handle.removeEventListener('pointerup', drop);
    handle.removeEventListener('pointercancel', drop);
    for (const i of items) i.style.transform = '';
    item.classList.remove('dragged');
    if (to !== from) onDrop(to);
  };
  handle.setPointerCapture(e.pointerId);
  item.classList.add('dragged');
  handle.addEventListener('pointermove', follow);
  handle.addEventListener('pointerup', drop);
  handle.addEventListener('pointercancel', drop);
}

/** The handle a list item is dragged by into another place; the arrow keys move it one place. */
export function Grip(props: { label: string; index: number; count: number; onMove: (to: number) => void }) {
  const key = (e: KeyboardEvent) => {
    const to = e.key === 'ArrowUp' ? props.index - 1 : e.key === 'ArrowDown' ? props.index + 1 : -1;
    if (to < 0 || to >= props.count) return;
    e.preventDefault();
    props.onMove(to);
  };
  return (
    <button type="button" class="icon grip" title={props.label} aria-label={props.label} onPointerDown={(e) => dragToSort(e, props.onMove)} onKeyDown={key}>
      <GripIcon />
    </button>
  );
}
