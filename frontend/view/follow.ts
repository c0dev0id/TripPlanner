import { createSignal, onCleanup, type Accessor } from 'solid-js';

/**
 * Follows what of a page is being read. The elements given to `watch` name themselves by
 * `data-mark`; the one that lies lowest in a band across the upper half of the window is
 * the one read. `go` scrolls to a mark and reads it at once; a mark no watched element
 * names is gone to where an element says it is told of (`data-told`), as a photo within
 * a gallery is.
 */
export function createFollowing(first: string): { at: Accessor<string>; watch: (el: HTMLElement) => void; go: (mark: string) => void } {
  const [at, setAt] = createSignal(first);
  const inBand = new Set<Element>();
  const observer = new IntersectionObserver(
    (changes) => {
      for (const change of changes) {
        if (change.isIntersecting) inBand.add(change.target);
        else inBand.delete(change.target);
      }
      const read = [...inBand].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).at(-1);
      if (read instanceof HTMLElement) setAt(read.dataset.mark!);
    },
    { rootMargin: '-38% 0px -58% 0px' },
  );
  onCleanup(() => observer.disconnect());
  const watch = (el: HTMLElement) => {
    observer.observe(el);
    onCleanup(() => {
      observer.unobserve(el);
      inBand.delete(el);
    });
  };
  const go = (mark: string) => {
    setAt(mark);
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector(`[data-mark="${CSS.escape(mark)}"], [data-told="${CSS.escape(mark)}"]`)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: mark.startsWith('e:') ? 'center' : 'start' });
  };
  return { at, watch, go };
}

/** The mark of the trip as a whole, of a day's chapter, and of an entry that stands somewhere. */
export const TRIP_MARK = 'trip';
export const dayMark = (dayId: string): string => `d:${dayId}`;
export const entryMark = (entryId: number): string => `e:${entryId}`;
