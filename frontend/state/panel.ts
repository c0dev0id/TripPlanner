import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';
import { shownReport } from './library';
import { editingRouteId, selectedDayId } from './trip';

const PREFERENCE = 'panelFolded';

/** Whether the library's panel is folded away to a strip, which this browser keeps as a preference. */
const [panelFolded, setPanelFolded] = createSignal(readPreference(PREFERENCE) === '1');
export { panelFolded };

export function foldPanel(folded: boolean): void {
  setPanelFolded(folded);
  writePreference(PREFERENCE, folded ? '1' : undefined);
}

/** Whether the screen is a phone's, where the library lies over the map and the day's pane is a sheet under it; the width is the one the styles turn at. */
export const onPhone = (): boolean => matchMedia('(max-width: 720px)').matches;

/** How much of a phone's screen the day's sheet takes: its heading alone, about half, or nearly all. */
export type Sheet = 'peek' | 'half' | 'full';

export const [sheet, setSheet] = createSignal<Sheet>('half');

createRoot(() => {
  // On a phone the library lies over the map: a day picked in it, or a report asked for, is shown by folding it away.
  createEffect(on(selectedDayId, (id) => id && onPhone() && foldPanel(true)));
  createEffect(on(shownReport, (shown) => shown && onPhone() && foldPanel(true)));
  // A route is edited on the map, so the sheet folds down to its heading meanwhile.
  createEffect(on(editingRouteId, (id) => setSheet(id ? 'peek' : 'half'), { defer: true }));
});
