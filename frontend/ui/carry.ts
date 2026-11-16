import { followPointer } from './followPointer';

/**
 * Carrying something from a pressed pad to a place that takes it. A place is an element
 * made one with `dropTarget`; it says itself what a drop of what is carried does there.
 */

/** How far a pressed pad moves, in CSS pixels, before the press is a drag rather than a tap. */
const DRAG_FROM_PX = 6;

/**
 * What a drop on a place does: the drop itself; null where the place is for what is
 * carried but a drop there is refused or would change nothing; undefined where the place
 * is not for it, and a place around it may be.
 */
export type Drop = (() => void) | null | undefined;

const takers = new WeakMap<Element, (carried: unknown) => Drop>();

/** Makes the element a place to drop: `taker` says of whatever is carried what a drop there does. */
export function dropTarget(el: HTMLElement, taker: (carried: unknown) => Drop): void {
  takers.set(el, taker);
  el.dataset.drop = '';
}

/** The place under the point that takes what is carried, with what a drop there does: the nearest place around the point that is for it, none where that one refuses, and none inside `own`. */
function placeAt(x: number, y: number, carried: unknown, own?: Element | null): { el: HTMLElement; drop: () => void } | undefined {
  for (let el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]'); el; el = el.parentElement?.closest<HTMLElement>('[data-drop]')) {
    if (own?.contains(el)) continue;
    const drop = takers.get(el)?.(carried);
    if (drop !== undefined) return drop ? { el, drop } : undefined;
  }
  return undefined;
}

/**
 * What is carried, shown: a label saying `what` follows the pointer, and the place it is
 * over, outside `own`, is marked. `to` moves it and says whether it is over a place;
 * `end` takes both away and answers the drop on the place it was over last, if any.
 */
export function carrying(what: string, carried: unknown, own?: Element | null): { to: (x: number, y: number) => boolean; end: () => (() => void) | undefined } {
  let label: HTMLElement | undefined;
  let place: ReturnType<typeof placeAt>;
  const mark = (next: ReturnType<typeof placeAt>) => {
    if (next?.el !== place?.el) {
      place?.el.classList.remove('drop-target');
      next?.el.classList.add('drop-target');
    }
    place = next;
  };
  return {
    to: (x, y) => {
      mark(placeAt(x, y, carried, own));
      // Within the list of what is carried the label is in the way of the row that follows the pointer there.
      if (own && !place) {
        label?.remove();
        label = undefined;
        return false;
      }
      if (!label) {
        label = document.createElement('div');
        label.className = 'drag-label';
        label.textContent = what;
        document.body.append(label);
      }
      label.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
      return place !== undefined;
    },
    end: () => {
      const drop = place?.drop;
      label?.remove();
      mark(undefined);
      return drop;
    },
  };
}

/** What a drag carries, and what the label that follows the pointer calls it. */
export interface Held {
  what: string;
  carried: unknown;
}

/**
 * Carries what a pressed pad stands for to a place that takes it: once the pointer moves,
 * `held` is asked what that is, a label saying it follows the pointer, the place it is
 * over is marked, and released there, the place's drop runs. A press that does not move
 * stays a tap and asks nothing; one that moved tells `onDrag`, so that the click its
 * release makes is no tap.
 */
export function carry(e: PointerEvent, held: () => Held | undefined, onDrag: () => void): void {
  if (e.button !== 0) return;
  const row = (e.currentTarget as HTMLElement).closest('li');
  const start = { x: e.clientX, y: e.clientY };
  let moved = false;
  let shown: ReturnType<typeof carrying> | undefined;
  followPointer(
    e,
    (m) => {
      if (!moved && Math.hypot(m.clientX - start.x, m.clientY - start.y) < DRAG_FROM_PX) return;
      if (!moved) {
        moved = true;
        onDrag();
        const of = held();
        shown = of && carrying(of.what, of.carried);
        if (shown) row?.classList.add('dragged');
      }
      shown?.to(m.clientX, m.clientY);
    },
    () => {
      row?.classList.remove('dragged');
      shown?.end()?.();
    },
  );
}
