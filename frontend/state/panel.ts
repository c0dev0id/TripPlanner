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
