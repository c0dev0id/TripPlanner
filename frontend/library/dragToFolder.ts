import { followPointer } from '../ui/followPointer';

/** How far a pressed pad moves, in CSS pixels, before the press is a drag rather than a tap. */
const DRAG_FROM_PX = 6;

/**
 * Drags what a pressed pad stands for into a folder: once the pointer moves, a label saying
 * `what` follows it and the folder it is over is marked: the nearest element around the
 * pointer with `data-drop-folder`, the folder's id or "top". A folder's whole row with all
 * it holds is such an element, so a drop anywhere inside a folder goes into it, and the
 * library's pane around the tree is the top. Released, `onDrop` gets that folder, null for
 * the top. What is dragged takes no drop on itself or inside itself. A press that does not
 * move stays a tap; one that moved tells `onDrag`, so that the click its release makes is
 * no tap.
 */
export function dragToFolder(e: PointerEvent, what: string, onDrop: (folderId: number | null) => void, onDrag: () => void): void {
  if (e.button !== 0) return;
  const row = (e.currentTarget as HTMLElement).closest('li');
  const start = { x: e.clientX, y: e.clientY };
  let label: HTMLElement | undefined;
  let target: HTMLElement | undefined;
  const follow = (m: PointerEvent) => {
    if (!label && Math.hypot(m.clientX - start.x, m.clientY - start.y) < DRAG_FROM_PX) return;
    if (!label) {
      label = document.createElement('div');
      label.className = 'drag-label';
      label.textContent = what;
      onDrag();
      document.body.append(label);
      row?.classList.add('dragged');
    }
    label.style.transform = `translate(${m.clientX + 14}px, ${m.clientY + 10}px)`;
    const over = document.elementFromPoint(m.clientX, m.clientY)?.closest<HTMLElement>('[data-drop-folder]') ?? undefined;
    const into = over && !row?.contains(over) ? over : undefined;
    if (into !== target) {
      target?.classList.remove('drop-target');
      into?.classList.add('drop-target');
      target = into;
    }
  };
  followPointer(e, follow, () => {
    if (!label) return;
    label.remove();
    row?.classList.remove('dragged');
    target?.classList.remove('drop-target');
    const folder = target?.dataset.dropFolder;
    if (folder !== undefined) onDrop(folder === 'top' ? null : Number(folder));
  });
}
