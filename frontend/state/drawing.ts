import { createSignal } from 'solid-js';
import { googleMapsUrl, streetViewUrl } from '../geo/googleMaps';
import { t } from '../i18n/t';
import type { LngLat, Route, RoutePoint } from '../model/trip';
import type { MenuItem } from '../ui/menu';
import { openJournal } from './journal';
import { addFreeStop, appendPoint, editingRoute, openTrip, selectedDay, setStraight } from './trip';

/** Transient state of editing on the map; never kept. */

/** Tools while a route is selected: the hand moves about, the others add or insert a point, make a stop, delete. */
export type Tool = 'hand' | 'point' | 'stop' | 'delete';

/** Each tool's caption and what it does, for the toolbar's buttons and their tooltips. */
export const TOOLS: Record<Tool, { label: string; hint: string }> = {
  hand: { label: t('Hand'), hint: t('Drag the map; tap a stop for its details; points and stops stay where they are. Hold Space for the hand with another tool.') },
  point: { label: t('Point'), hint: t('Tap the map to add a point at the end of the route, or tap the route to insert one there; drag points and stops to move them.') },
  stop: { label: t('Stop'), hint: t('Tap a route point or the route to make a stop there; tap elsewhere for a stop beside the route; drag points and stops to move them.') },
  delete: { label: t('Delete'), hint: t('Tap a point or a stop to delete it.') },
};

/** The tool picked; the hand to start with: a tap adds nothing until a tool is picked. */
export const [tool, setTool] = createSignal<Tool>('hand');

/** The tools a route offers: a track has no points to add. */
export const toolsOf = (route: Route): Tool[] => (route.kind === 'track' ? ['hand', 'stop', 'delete'] : ['hand', 'point', 'stop', 'delete']);

/** The tool at work: the one picked where the edited route offers it, else the hand. */
export function currentTool(): Tool {
  const route = editingRoute();
  return route && !toolsOf(route).includes(tool()) ? 'hand' : tool();
}

/** Whether the days before and after the selected one are drawn, dimmed, for orientation. */
export const [showNeighbours, setShowNeighbours] = createSignal(true);

/** The element whose edit dialog is open: the trip, or a day, a route or a stop of it by id. */
export type EditTarget = { kind: 'trip' } | { kind: 'day'; id: string } | { kind: 'route'; id: string } | { kind: 'stop'; id: string };
export const [editTarget, setEditTarget] = createSignal<EditTarget>();

/** The track whose points are being condensed or made into a route, in a dialog. */
export const [trackAction, setTrackAction] = createSignal<{ routeId: string; action: 'condense' | 'convert' }>();

/** Whether the export dialog is open. */
export const [exportOpen, setExportOpen] = createSignal(false);

/** Whether the preferences dialog is open. */
export const [preferencesOpen, setPreferencesOpen] = createSignal(false);

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
export const dragsMarkers = (): boolean => currentTool() !== 'hand';

/** What the next tap on the map does: the tool's work on the selected route; nothing while no route is selected. */
export function tapAction(): Tool | undefined {
  return editingRoute() ? currentTool() : undefined;
}

/** What a spot on the map offers: a point at the edited routed route's end, a free stop while a route is edited, a journal entry of the selected day of a trip there, and the spot in Google Maps and Street View. */
export function spotItems(spot: LngLat): MenuItem[] {
  const route = editingRoute();
  const day = selectedDay();
  const items: MenuItem[] = [];
  if (route?.kind === 'routed') items.push({ label: t('Add a point here'), run: () => appendPoint(route.id, spot) });
  if (route) items.push({ label: t('Add a stop here, beside the route'), run: () => addFreeStop(spot) });
  if (day && openTrip()?.kind === 'trip') items.push({ label: t('Journal here…'), run: () => openJournal({ dayId: day.id }, spot) });
  items.push({ label: t('Open in Google Maps'), run: () => window.open(googleMapsUrl(spot), '_blank', 'noopener') });
  items.push({ label: t('Open in Street View'), run: () => window.open(streetViewUrl(spot), '_blank', 'noopener') });
  return items;
}

/** The menu item that makes the leg to a point of a route straight, or routed again. */
export function straightLegItem(routeId: string, point: RoutePoint): MenuItem {
  const straight = point.straight === true;
  return { label: t(straight ? 'Route the leg to here' : 'Straight leg to here'), run: () => setStraight(routeId, point.id, !straight) };
}
