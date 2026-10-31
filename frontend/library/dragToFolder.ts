import { followPointer } from '../ui/followPointer';

/** How far a pressed pad moves, in CSS pixels, before the press is a drag rather than a tap. */
const DRAG_FROM_PX = 6;

/** How long after a drag ends the click its release makes is still taken for part of it. */
const RELEASE_CLICK_MS = 500;

/**
 * Drags what a pressed pad stands for onto a folder: once the pointer moves, a label saying
 * `what` follows it and the folder under it is marked: a card with `data-drop-folder`, the
 * folder's id or "top". Released over one, `onDrop` gets that folder, null for the top. A
 * press that does not move stays a tap.
 */
export function dragToFolder(e: PointerEvent, what: () => string, onDrop: (folderId: number | null) => void): void {
  if (e.button !== 0) return;
  const pad = e.currentTarget as HTMLElement;
  const row = pad.closest('li');
  const start = { x: e.clientX, y: e.clientY };
  let label: HTMLElement | undefined;
  let target: HTMLElement | undefined;
  const follow = (m: PointerEvent) => {
    if (!label && Math.hypot(m.clientX - start.x, m.clientY - start.y) < DRAG_FROM_PX) return;
    if (!label) {
      label = document.createElement('div');
      label.className = 'drag-label';
      label.textContent = what();
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
    const swallow = (c: MouseEvent) => {
      c.stopPropagation();
      c.preventDefault();
    };
    pad.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => pad.removeEventListener('click', swallow, { capture: true }), RELEASE_CLICK_MS);
    const folder = target?.dataset.dropFolder;
    if (folder !== undefined) onDrop(folder === 'top' ? null : Number(folder));
  });
}
