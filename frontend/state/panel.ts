import { createEffect, createMemo, createRoot, createSignal, on } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';
import { detailShown, paneShown } from './library';
import { setShowingDuplicates, showingDuplicates } from './pane';
import { openDetail, openTrip } from './trip';

/**
 * The panes beside the map: the library, the pane of what is open in it, and the pane of
 * that one's day. Each is folded to a strip and unfolded by hand, which this browser
 * keeps; none folds by itself. Where they do not fit side by side one is shown, the
 * deepest that is open.
 */
export const PANES = ['library', 'second', 'detail'] as const;
export type PaneLevel = (typeof PANES)[number];

const PREFERENCE = 'foldedPanes';

const [folds, setFolds] = createSignal<ReadonlySet<string>>(new Set((readPreference(PREFERENCE) ?? '').split(',').filter(Boolean)));

export const folded = (level: PaneLevel): boolean => folds().has(level);

/** Folds a pane to its strip, or unfolds it. */
export function fold(level: PaneLevel, to: boolean): void {
  const next = new Set(folds());
  if (to) next.add(level);
  else next.delete(level);
  setFolds(next);
  writePreference(PREFERENCE, [...next].join(',') || undefined);
}

/** Opens the pane of a day's contents, or of a category's places, as the pad on its row asks: unfolded, and in the place of a report. */
export function showDetail(dayId: string): void {
  setShowingDuplicates(false);
  openDetail(dayId);
  fold(openTrip()?.kind === 'trip' ? 'detail' : 'second', false);
}

/** Whether the window matches a media query, as it is resized and turned. */
function matching(query: string): () => boolean {
  const media = matchMedia(query);
  const [matches, setMatches] = createSignal(media.matches);
  media.addEventListener('change', (e) => setMatches(e.matches));
  return matches;
}

/** Whether the window has room for one pane alone beside the map; the width is the one the styles turn at. */
export const onePane = matching('(max-width: 1199px)');

/** Whether the pane shown is a sheet under the map: on a phone held upright, as the styles have it. */
export const sheetMode = matching('(max-width: 720px) and (orientation: portrait)');

/** The deepest pane that is open: the one shown where one alone is. */
export const shownLevel: () => PaneLevel = createRoot(() => createMemo(() => (showingDuplicates() ? 'second' : detailShown() ? 'detail' : paneShown() ? 'second' : 'library')));

/** Which way the pane shown was come to, from the one shown before: forward to a deeper one, or back; none before the first change. */
const [entered, setEntered] = createSignal<'enter-forward' | 'enter-back'>();
export { entered };

createRoot(() => {
  createEffect(on(shownLevel, (now, before) => before !== undefined && setEntered(PANES.indexOf(now) > PANES.indexOf(before) ? 'enter-forward' : 'enter-back')));
});

/** How much of a phone's screen the sheet takes while it is not folded: about half, or nearly all. */
export type Sheet = 'half' | 'full';

export const [sheet, setSheet] = createSignal<Sheet>('half');
