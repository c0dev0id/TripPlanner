import { createSignal } from 'solid-js';
import type { LngLat, RoutePoint } from '../model/trip';
import { editingRoute, setStraight } from './trip';

/** Transient state of editing on the map; never kept. */

/** Tools while a route is edited: add or insert a point, make a stop, delete. */
export type Tool = 'point' | 'stop' | 'delete';

/** Each tool's caption and what it does, for the toolbar and the hint bar. */
export const TOOLS: Record<Tool, { label: string; hint: string }> = {
  point: { label: 'Point', hint: 'tap the map to add a point at the end of the route, or tap the route to insert one there; drag points and stops to move them.' },
  stop: { label: 'Stop', hint: 'tap a route point or the route to make a stop there; tap elsewhere for a stop beside the route.' },
  delete: { label: 'Delete', hint: 'tap a point or a stop to delete it.' },
};

export const [tool, setTool] = createSignal<Tool>('point');

/** Whether the panel lists the plain route points between the stops. */
export const [showRoutePoints, setShowRoutePoints] = createSignal(false);

/** Whether the days before and after the selected one are drawn, dimmed, for orientation. */
export const [showNeighbours, setShowNeighbours] = createSignal(true);

/** The stop whose details dialog is open. */
export const [stopDialogId, setStopDialogId] = createSignal<string>();

/** Whether the export dialog is open. */
export const [exportOpen, setExportOpen] = createSignal(false);

/** Whether the print-and-share dialog is open. */
export const [shareOpen, setShareOpen] = createSignal(false);

/** Where the map should go next; every request is a new object, so the same spot twice counts twice. */
export const [panTarget, setPanTarget] = createSignal<{ lngLat: LngLat }>();

export function panTo(lngLat: LngLat): void {
  setPanTarget({ lngLat });
}

export interface MenuItem {
  label: string;
  run: () => void;
  disabled?: boolean;
}

/**
 * The open menu, at a spot in viewport pixels: a context menu on the map or a marker, or
 * the further actions of a row in the panel. A menu opened by a long press (`touch`)
 * ignores the lifting finger until it is tapped again.
 */
export const [menu, setMenu] = createSignal<{ x: number; y: number; touch: boolean; items: MenuItem[] }>();

/** What the next tap on the map does: the tool's work on the route being edited; nothing while no route is. */
export function tapAction(): Tool | undefined {
  return editingRoute() ? tool() : undefined;
}

/** The menu item that makes the leg to a point of a route straight, or routed again. */
export function straightLegItem(routeId: string, point: RoutePoint): MenuItem {
  const straight = point.straight === true;
  return { label: straight ? 'Route the leg to here' : 'Straight leg to here', run: () => setStraight(routeId, point.id, !straight) };
}
