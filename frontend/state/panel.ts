import { createSignal } from 'solid-js';
import { readPreference, writePreference } from '../ui/preferences';

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
