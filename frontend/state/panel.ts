import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';
import { showingDuplicates } from './pane';
import { editingRouteId, selectedDayId } from './trip';

const PREFERENCE = 'panelFolded';

/** Whether the library's panel is folded away to a strip, which this browser keeps as a preference. */
const [panelFolded, setPanelFolded] = createSignal(readPreference(PREFERENCE) === '1');
export { panelFolded };

const AUTO_PREFERENCE = 'autoFold';

/**
 * Whether the library folds away by itself for the pane beside it, so that one pane at
 * most stands beside the map, and comes back when the pane closes; on unless this
 * browser was told otherwise. Where the two have no room side by side, it does so
 * either way (see `sideBySide`).
 */
const [autoFold, setAuto] = createSignal(readPreference(AUTO_PREFERENCE) !== '0');
export { autoFold };

/** Whether the library was folded away for the pane beside it, and comes back when the pane closes. */
let foldedForPane = false;

function setFolded(folded: boolean): void {
  setPanelFolded(folded);
  writePreference(PREFERENCE, folded ? '1' : undefined);
}

/** Folds the library away or brings it back, as the user asks; what the pane beside it did to it is forgotten. */
export function foldPanel(folded: boolean): void {
  foldedForPane = false;
  setFolded(folded);
}

/** Whether the library folds by itself now: where it has no room beside a pane, and elsewhere unless the user turned that off. */
export const foldsByItself = (): boolean => autoFold() || !sideBySide();

/** Folds the library away for the pane beside it, where it folds by itself and is not folded already. */
function foldForPane(): void {
  if (panelFolded() || !foldsByItself()) return;
  setFolded(true);
  foldedForPane = true;
}

/** Brings the library back as the pane beside it closes by its own button; not where it does not fold by itself, and so stays as the user left it. */
export function unfoldAfterPane(): void {
  if (foldsByItself()) foldPanel(false);
}

/** Turns the folding by itself on or off, at once: on, the library gives way to a pane that is open; off, it comes back where it was folded for one. */
export function setAutoFold(on: boolean): void {
  setAuto(on);
  writePreference(AUTO_PREFERENCE, on ? undefined : '0');
  if (on && selectedDayId() !== undefined) foldForPane();
  else if (!on && foldedForPane) foldPanel(false);
}

/** Whether the screen is a phone's, where the library lies over the map and the day's pane is a sheet under it; the width is the one the styles turn at. */
export const onPhone = (): boolean => matchMedia('(max-width: 720px)').matches;

/** Whether the screen has room for one pane beside the map, a tablet's: the unfolded library and the pane take turns there. The widths are the ones the styles turn at. */
const onTablet = (): boolean => matchMedia('(min-width: 721px) and (max-width: 1199px)').matches;

/** Whether the screen has room for the library and a pane side by side: only there is it the user's to say whether the library folds by itself. */
export const sideBySide = (): boolean => !onPhone() && !onTablet();

/** How much of a phone's screen the day's sheet takes: its heading alone, about half, or nearly all. */
export type Sheet = 'peek' | 'half' | 'full';

export const [sheet, setSheet] = createSignal<Sheet>('half');

createRoot(() => {
  // The day's pane folds the library away as it opens, and brings it back as it closes otherwise than by its own button or the strip, which say themselves what becomes of the library. Where the two cannot stand side by side, a phone's or a tablet's, any day picked folds it away.
  createEffect(
    on(selectedDayId, (id, before) => {
      if (id === undefined) {
        if (foldedForPane && !showingDuplicates()) foldPanel(false);
      } else if (before === undefined || onPhone() || onTablet()) foldForPane();
    }),
  );
  // The duplicates' report stands beside the library on a wide screen, which shows where a duplicate lies; elsewhere it folds the library away as a day does.
  createEffect(
    on(showingDuplicates, (shown) => {
      if (shown && (onPhone() || onTablet())) foldForPane();
      else if (!shown && foldedForPane && selectedDayId() === undefined) foldPanel(false);
    }),
  );
  // A route is edited on the map, so the sheet folds down to its heading meanwhile.
  createEffect(on(editingRouteId, (id) => setSheet(id ? 'peek' : 'half'), { defer: true }));
});
