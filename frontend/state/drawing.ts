import { createSignal } from 'solid-js';
import { googleMapsUrl, openStreetMapUrl, streetViewUrl } from '../geo/mapLinks';
import { t } from '../i18n/t';
import type { LngLat, Route, RoutePoint } from '../model/trip';
import type { MenuItem } from '../ui/menu';
import { openJournal } from './journal';
import { isPlaceList, shownDay } from './library';
import { addPlace, addStopBeside, appendPoint, convertPoint, editingRoute, openTrip, openTripId, removePoint, setStraight } from './trip';

/** Transient state of editing on the map; never kept. */

/** Tools while a route is selected: the hand moves about, the others add or insert a point, make a stop, delete. */
export type Tool = 'hand' | 'point' | 'stop' | 'delete';

/** Each tool's caption and what it does, for the toolbar's buttons and their tooltips. */
export const TOOLS: Record<Tool, { label: string; hint: string }> = {
  hand: { label: t('Hand'), hint: t('Drag the map; tap a stop for its details. Points and stops cannot be moved. Hold Space to use the hand while another tool is selected.') },
  point: { label: t('Point'), hint: t('Tap the map to add a point at the end of the route, or tap the route to insert one there; drag points and stops to move them.') },
  stop: { label: t('Stop'), hint: t('Tap a route point or the route to add a stop there; tap elsewhere to add a stop beside the route; drag points and stops to move them.') },
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

/** What the export dialog is open for: the trip, or days or routes of it picked in a menu; none while it is closed. */
export type ExportScope = { kind: 'trip' } | { kind: 'day' | 'route'; ids: string[] };
export const [exportScope, setExportScope] = createSignal<ExportScope>();

/** Whether the map shows how far it is to the nearest route or track it draws. */
export const [reachShown, setReachShown] = createSignal(false);

/** Whether the map stays as it is while another day, route or recording is taken up, where it would otherwise show that whole. */
export const [viewLocked, setViewLocked] = createSignal(false);

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

/** What a spot on the map offers: a point at the edited routed route's end, a stop beside the route while one is edited, a journal entry there on the route being edited or else on the day shown of a trip, a place of the kind shown of a list of places shown, and the spot in Google Maps, OpenStreetMap and Street View. */
export function spotItems(spot: LngLat): MenuItem[] {
  const route = editingRoute();
  const day = shownDay();
  const items: MenuItem[] = [];
  if (route?.kind === 'routed') items.push({ label: t('Add point'), run: () => appendPoint(route.id, spot) });
  if (route) items.push({ label: t('Add stop'), run: () => addStopBeside(spot) });
  if (day && openTrip()?.kind === 'trip') items.push({ label: t('Add journal entry…'), run: () => openJournal(route ? { routeId: route.id } : { dayId: day.id }, spot) });
  if (day && isPlaceList(openTripId())) items.push({ label: t('Add place…'), run: () => setEditTarget({ kind: 'stop', id: addPlace(spot) }) });
  items.push({ label: t('Open in Google Maps'), run: () => window.open(googleMapsUrl(spot), '_blank', 'noopener') });
  items.push({ label: t('Open in OpenStreetMap'), run: () => window.open(openStreetMapUrl(spot), '_blank', 'noopener') });
  items.push({ label: t('Open in Street View'), run: () => window.open(streetViewUrl(spot), '_blank', 'noopener') });
  return items;
}

/** The menu item that makes the leg to a point of a route straight, or routed again. */
export function straightLegItem(routeId: string, point: RoutePoint): MenuItem {
  const straight = point.straight === true;
  return { label: t(straight ? 'Route leg to here' : 'Straight leg to here'), run: () => setStraight(routeId, point.id, !straight) };
}

/** The menu of a plain point of a route, on the map and in the pane: a stop made of it, the leg to it straight or routed, the point removed. */
export function pointItems(routeId: string, point: RoutePoint): MenuItem[] {
  return [
    { label: t('Convert to stop'), run: () => convertPoint(routeId, point.id) },
    straightLegItem(routeId, point),
    { label: t('Remove point'), run: () => removePoint(routeId, point.id) },
  ];
}
