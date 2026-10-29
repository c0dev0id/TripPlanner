import { createSignal } from 'solid-js';
import type { LngLat, RoutePoint } from '../model/trip';
import type { MenuItem } from '../ui/menu';
import { openJournal } from './journal';
import { addFreeStop, appendPoint, editingRoute, openTrip, selectedDay, setStraight } from './trip';

/** Transient state of editing on the map; never kept. */

/** Tools while a route is selected: the hand moves about, the others add or insert a point, make a stop, delete. */
export type Tool = 'hand' | 'point' | 'stop' | 'delete';

/** Each tool's caption and what it does, for the toolbar and the hint bar. */
export const TOOLS: Record<Tool, { label: string; hint: string }> = {
  hand: { label: 'Hand', hint: 'drag the map; tap a stop for its details; points and stops stay where they are. Hold Space for the hand with another tool.' },
  point: { label: 'Point', hint: 'tap the map to add a point at the end of the route, or tap the route to insert one there; drag points and stops to move them.' },
  stop: { label: 'Stop', hint: 'tap a route point or the route to make a stop there; tap elsewhere for a stop beside the route; drag points and stops to move them.' },
  delete: { label: 'Delete', hint: 'tap a point or a stop to delete it.' },
};

/** The hand to start with: a tap adds nothing until a tool is picked. */
export const [tool, setTool] = createSignal<Tool>('hand');

/** Whether the days before and after the selected one are drawn, dimmed, for orientation. */
export const [showNeighbours, setShowNeighbours] = createSignal(true);

/** The element whose edit dialog is open: the trip, or a day, a route or a stop of it by id. */
export type EditTarget = { kind: 'trip' } | { kind: 'day'; id: string } | { kind: 'route'; id: string } | { kind: 'stop'; id: string };
export const [editTarget, setEditTarget] = createSignal<EditTarget>();

/** The track whose points are being condensed or made into a route, in a dialog. */
export const [trackAction, setTrackAction] = createSignal<{ routeId: string; action: 'condense' | 'convert' }>();

/** Whether the export dialog is open. */
export const [exportOpen, setExportOpen] = createSignal(false);

/** Whether the print-and-share dialog is open. */
export const [shareOpen, setShareOpen] = createSignal(false);

/** Where the map should go next: to a spot, or to show positions whole; every request is a new object, so the same one twice counts twice. */
export const [panTarget, setPanTarget] = createSignal<{ lngLat: LngLat } | { positions: LngLat[] }>();

export function panTo(lngLat: LngLat): void {
  setPanTarget({ lngLat });
}

/** Shows the positions whole, such as a route's. */
export function showWhole(positions: LngLat[]): void {
  setPanTarget({ positions });
}

/** Whether the selected route's points and stops can be dragged: with every tool but the hand. */
export const dragsMarkers = (): boolean => tool() !== 'hand';

/** What the next tap on the map does: the tool's work on the selected route; nothing while no route is selected. */
export function tapAction(): Tool | undefined {
  return editingRoute() ? tool() : undefined;
}

/** What a spot on the map offers: a point at the edited routed route's end, a free stop while a route is edited, a journal entry of the selected day of a trip there; nothing without a day. */
export function spotItems(spot: LngLat): MenuItem[] | undefined {
  const route = editingRoute();
  const day = selectedDay();
  const items: MenuItem[] = [];
  if (route?.kind === 'routed') items.push({ label: 'Add a point here', run: () => appendPoint(route.id, spot) });
  if (route) items.push({ label: 'Add a stop here, beside the route', run: () => addFreeStop(spot) });
  if (day && openTrip()?.kind === 'trip') items.push({ label: 'Journal here…', run: () => openJournal({ dayId: day.id }, spot) });
  return items.length > 0 ? items : undefined;
}

/** The menu item that makes the leg to a point of a route straight, or routed again. */
export function straightLegItem(routeId: string, point: RoutePoint): MenuItem {
  const straight = point.straight === true;
  return { label: straight ? 'Route the leg to here' : 'Straight leg to here', run: () => setStraight(routeId, point.id, !straight) };
}
