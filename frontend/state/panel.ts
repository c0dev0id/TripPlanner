import { createEffect, createMemo, createRoot, createSignal, on } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';
import { detailShown, paneShown } from './library';
import { setShowingDuplicates, showingDuplicates } from './pane';
import { closeDetail, detailDayId, openDetail } from './trip';

/**
 * The panes beside the map: the library, the pane of what is open in it, and the pane of
 * that one's day. Each is folded to a strip and unfolded by hand, which this browser
 * keeps; none folds by itself. Where they do not fit side by side one is shown, the
 * deepest that is open.
 */
const PANES = ['library', 'second', 'detail'] as const;
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

/** Gives a pane the room a pad on a row asks for: it is unfolded, and the open trip's stands in the place of a report. */
export function reveal(level: PaneLevel): void {
  setShowingDuplicates(false);
  fold(level, false);
}

/** Whether the pane of a day's contents, or of a category's places, shows this one's. */
export const isDetailed = (dayId: string): boolean => detailDayId() === dayId && paneShown();

/** What the pad on a day's or a category's row does: it opens the pane of what that holds, and closes it. */
export function toggleDetail(dayId: string): void {
  if (isDetailed(dayId)) return closeDetail();
  openDetail(dayId);
  reveal(detailShown() ? 'detail' : 'second');
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
type Sheet = 'half' | 'full';

export const [sheet, setSheet] = createSignal<Sheet>('half');
