import { createSignal, onCleanup, type Accessor } from 'solid-js';

/** Where down the window the line lies that is read at, as a part of its height. */
const READ_AT = 0.4;

/**
 * How far down the window the reading line lies, in pixels, for a page scrolled `scrolled`
 * of the `range` it can be scrolled, in a window `height` high. It lies in the upper half
 * until the page's end comes near and goes down to the window's foot over the last of the
 * scrolling: what stands at the end of a page never comes up to the upper half.
 */
export function readingLine(scrolled: number, range: number, height: number): number {
  const stretch = Math.min((1 - READ_AT) * height, range);
  const progress = stretch > 0 ? Math.max(0, (scrolled - (range - stretch)) / stretch) : 0;
  return (READ_AT + (1 - READ_AT) * Math.min(1, progress)) * height;
}

/**
 * Follows what of a page is being read. The elements given to `watch` name themselves by
 * `data-mark`; the one that lies lowest of those the reading line crosses is the one
 * read. `go` scrolls to a mark and reads it until the reader scrolls on; a mark no watched
 * element names is gone to where an element says it is told of (`data-told`), as a photo
 * within a gallery is.
 */
export function createFollowing(first: string): { at: Accessor<string>; watch: (el: HTMLElement) => void; go: (mark: string) => void } {
  const [at, setAt] = createSignal(first);
  const watched = new Set<HTMLElement>();
  const inBand = new Set<Element>();
  /** Whether what was gone to is still read: until the reader moves the page. */
  let held = false;
  const read = () => {
    if (held) return;
    const page = document.documentElement;
    const line = readingLine(window.scrollY, page.scrollHeight - window.innerHeight, window.innerHeight);
    // In the upper half the line lies in the band that is watched. Lower down every element is asked: those the line crosses, or, under the last of them at the page's foot, those that begin above it.
    const begun = line > READ_AT * window.innerHeight + 1 ? [...watched].filter((el) => el.getBoundingClientRect().top <= line) : undefined;
    const crossed = begun?.filter((el) => el.getBoundingClientRect().bottom > line) ?? [...inBand];
    const lowest = (crossed.length > 0 ? crossed : (begun ?? [])).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).at(-1);
    if (lowest instanceof HTMLElement) setAt(lowest.dataset.mark!);
  };
  const observer = new IntersectionObserver(
    (changes) => {
      for (const change of changes) {
        if (change.isIntersecting) inBand.add(change.target);
        else inBand.delete(change.target);
      }
      read();
    },
    { rootMargin: `-${READ_AT * 100 - 2}% 0px -${(1 - READ_AT) * 100 - 2}% 0px` },
  );
  // The band tells of itself; near the page's end the line leaves it, and the scrolling is listened to.
  let frame = 0;
  const scrolled = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(read);
  };
  const moved = () => {
    held = false;
  };
  window.addEventListener('scroll', scrolled, { passive: true });
  for (const by of ['wheel', 'touchmove', 'keydown'] as const) window.addEventListener(by, moved, { passive: true });
  onCleanup(() => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', scrolled);
    for (const by of ['wheel', 'touchmove', 'keydown'] as const) window.removeEventListener(by, moved);
  });
  const watch = (el: HTMLElement) => {
    watched.add(el);
    observer.observe(el);
    onCleanup(() => {
      observer.unobserve(el);
      watched.delete(el);
      inBand.delete(el);
    });
  };
  const go = (mark: string) => {
    setAt(mark);
    held = true;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector(`[data-mark="${CSS.escape(mark)}"], [data-told="${CSS.escape(mark)}"]`)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: mark.startsWith('e:') ? 'center' : 'start' });
  };
  return { at, watch, go };
}

/** The mark of the trip as a whole, of a day's chapter, and of an entry that stands somewhere. */
export const TRIP_MARK = 'trip';
export const dayMark = (dayId: string): string => `d:${dayId}`;
export const entryMark = (entryId: number): string => `e:${entryId}`;
