import { createSignal } from 'solid-js';
import { selectedDay } from './trip';

/** Transient state of editing on the map; never kept. */

/** Tools: add a stop (on the line or at the end of the day), insert a point on the line, delete. */
export type Tool = 'stop' | 'point' | 'delete';

export const [tool, setTool] = createSignal<Tool>('stop');

export interface MenuItem {
  label: string;
  run: () => void;
}

/**
 * The open context menu, positioned in CSS pixels relative to the map container. A menu
 * opened by a long press (`touch`) ignores the lifting finger until it is tapped again.
 */
export const [menu, setMenu] = createSignal<{ x: number; y: number; touch: boolean; items: MenuItem[] }>();

/** What the next tap on the map does: the tool's work on the selected day; nothing without a day. */
export function tapAction(): Tool | undefined {
  return selectedDay() ? tool() : undefined;
}
