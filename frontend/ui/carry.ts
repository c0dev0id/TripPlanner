import { followPointer } from './followPointer';

/**
 * Carrying something from a pressed pad to a place that takes it. A place is an element
 * made one with `dropTarget`; it says itself what a drop of what is carried does there.
 */

/** How far a pressed pad moves, in CSS pixels, before the press is a drag rather than a tap. */
const DRAG_FROM_PX = 6;

/** What a drop on a place does: the drop itself, or null where a drop there is refused or would change nothing. */
export type Drop = (() => void) | null;

/** What a drag carries: its kind, by which the places for it are known, what the label that follows the pointer calls it, and the thing itself. */
export interface Held {
  kind: string;
  what: string;
  carried: unknown;
}

const takers = new WeakMap<Element, Map<string, (carried: never) => Drop>>();

/** Makes the element a place to drop what is carried of a `kind`: `taker` says what a drop of it there does. */
export function dropTarget<T>(el: HTMLElement, kind: string, taker: (carried: T) => Drop): void {
  takers.set(el, (takers.get(el) ?? new Map()).set(kind, taker));
  el.dataset.drop = '';
}

/** What a drop of what is held on the element does; undefined where the element is no place for its kind. */
export function dropOn(el: Element, held: Held): Drop | undefined {
  return takers.get(el)?.get(held.kind)?.(held.carried as never);
}

/** The place under the point that takes what is held, with what a drop there does: the nearest place around the point that is for its kind, none where that one refuses, and none inside `own`. */
function placeAt(x: number, y: number, held: Held, own?: Element | null): { el: HTMLElement; drop: () => void } | undefined {
  for (let el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]'); el; el = el.parentElement?.closest<HTMLElement>('[data-drop]')) {
    const drop = own?.contains(el) ? undefined : dropOn(el, held);
    if (drop !== undefined) return drop ? { el, drop } : undefined;
  }
  return undefined;
}

/**
 * What is held, shown: a label saying what it is follows the pointer, and the place it is
 * over, outside `own`, is marked. `to` moves it and says whether it is over a place;
 * `end` takes both away and answers the drop on the place it was over last, if any.
 */
export function carrying(held: Held, own?: Element | null): { to: (x: number, y: number) => boolean; end: () => (() => void) | undefined } {
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
      mark(placeAt(x, y, held, own));
      // Within the list of what is carried the label is in the way of the row that follows the pointer there.
      if (own && !place) {
        label?.remove();
        label = undefined;
        return false;
      }
      if (!label) {
        label = document.createElement('div');
        label.className = 'drag-label';
        label.textContent = held.what;
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
        shown = of && carrying(of);
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
