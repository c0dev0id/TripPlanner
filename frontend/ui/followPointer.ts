/**
 * Follows the pointer that pressed `e.currentTarget` until it is lifted: `move` gets each of
 * its moves, and `end` runs once it is lifted or cancelled.
 */
export function followPointer(e: PointerEvent, move: (m: PointerEvent) => void, end?: () => void): void {
  const handle = e.currentTarget as HTMLElement;
  const stop = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', stop);
    handle.removeEventListener('pointercancel', stop);
    end?.();
  };
  handle.setPointerCapture(e.pointerId);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}
