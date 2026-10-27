import { createSignal } from 'solid-js';
import type { RoutePoint } from '../model/trip';
import { selectedDay, setStraight } from './trip';

/** Transient state of editing on the map; never kept. */

/** Tools: add a stop (on the line or at the end of the day), insert a point on the line, delete. */
export type Tool = 'stop' | 'point' | 'delete';

/** Each tool's caption and what it does, for the toolbar and the hint bar. */
export const TOOLS: Record<Tool, { label: string; hint: string }> = {
  stop: { label: 'Stop', hint: 'tap the map to add a stop at the end of the day, or tap a route to add one there; drag stops and points to move them.' },
  point: { label: 'Point', hint: 'tap a route to insert a point there, for shaping it.' },
  delete: { label: 'Delete', hint: 'tap a stop or a point to delete it.' },
};

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

/** The menu item that makes the leg to a point of a route straight, or routed again. */
export function straightLegItem(routeId: string, point: RoutePoint): MenuItem {
  const straight = point.straight === true;
  return { label: straight ? 'Route the leg to here' : 'Straight leg to here', run: () => setStraight(routeId, point.id, !straight) };
}
