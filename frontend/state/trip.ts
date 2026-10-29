import { batch, createMemo, createRoot, createSignal } from 'solid-js';
import { newId, withChanges, type Day, type LngLat, type Route, type RoutedLeg, type RoutedRoute, type Stop, type Trip } from '../model/trip';
import * as dayEdit from '../routing/dayEdit';
import { roundLngLat } from '../routing/legs';
import * as routeEdit from '../routing/routeEdit';
import { daySequence, type SequenceEntry } from '../routing/sequence';
import { dayTimeline, type DayTimeline } from '../routing/timeline';
import { History } from './history';

/**
 * The open trip, as an immutable value: each edit replaces it with the result of a pure
 * edit, which shares every part it leaves unchanged. All writes go through the actions
 * below: edits with a label are undo steps, every content change counts for the autosave,
 * and positions are rounded here, so that the document never holds a coordinate the leg
 * keys cannot agree on.
 */

const [openTrip, setOpenTrip] = createSignal<Trip>();
export { openTrip };

/** The open trip's id; it changes only when another trip opens, not with each edit. */
export const openTripId: () => number | undefined = createRoot(() => createMemo(() => openTrip()?.id));

const [selectedDayId, setSelectedDayId] = createSignal<string>();
export { selectedDayId };

/** The route being edited, of the selected day; none while the day is only shown. */
const [editingRouteId, setEditingRouteId] = createSignal<string>();
export { editingRouteId };

/** Shows a day; whatever was being edited is done. */
export function selectDay(id: string | undefined): void {
  batch(() => {
    setSelectedDayId(id);
    setEditingRouteId(undefined);
  });
}

/** The selected day; it changes only when that day does. */
export const selectedDay: () => Day | undefined = createRoot(() => createMemo(() => openTrip()?.days.find((d) => d.id === selectedDayId())));

/** The days before and after the selected one. */
export function neighbourDays(): Day[] {
  const days = openTrip()?.days ?? [];
  const index = days.findIndex((d) => d.id === selectedDayId());
  return index < 0 ? [] : [days[index - 1], days[index + 1]].filter((d): d is Day => d !== undefined);
}

/** The selected day's stops and route points in riding order; computed once for the map and the panel. */
export const selectedSequence: () => SequenceEntry[] = createRoot(() =>
  createMemo(() => {
    const day = selectedDay();
    return day ? daySequence(day) : [];
  }),
);

/** The selected day's times, from its first stop with a time on. */
export const selectedTimeline: () => DayTimeline | undefined = createRoot(() => createMemo(() => dayTimeline(selectedSequence())));

/** Starts editing a route of the selected day, or ends editing for undefined. */
export function editRoute(id: string | undefined): void {
  setEditingRouteId(id);
}

export const editingRoute = (): Route | undefined => selectedDay()?.routes.find((r) => r.id === editingRouteId());

export function routeById(id: string): Route | undefined {
  for (const day of openTrip()?.days ?? []) {
    const route = day.routes.find((r) => r.id === id);
    if (route) return route;
  }
  return undefined;
}

/** Counts the content changes since the trip was loaded; the autosave follows it. */
const [changeCount, setChangeCount] = createSignal(0);
export { changeCount };

/** The trip before each edit; as trips are never changed in place, a step keeps the trip itself. */
const history = new History<Trip>();
const [historyVersion, setHistoryVersion] = createSignal(0);

/** Label of the edit that undo would revert (reactive). */
export function undoLabel(): string | undefined {
  historyVersion();
  return history.undoLabel;
}

/** Label of the edit that redo would repeat (reactive). */
export function redoLabel(): string | undefined {
  historyVersion();
  return history.redoLabel;
}

export function undo(): void {
  const current = openTrip();
  if (current) restore(history.undo(current), current);
}

export function redo(): void {
  const current = openTrip();
  if (current) restore(history.redo(current), current);
}

/** Puts back an earlier trip; the version stays the current one, since saves are no edits. */
function restore(earlier: Trip | undefined, current: Trip): void {
  if (!earlier) return;
  batch(() => {
    setOpenTrip({ ...earlier, version: current.version });
    setHistoryVersion((v) => v + 1);
    setChangeCount((c) => c + 1);
    if (editingRouteId() && !editingRoute()) setEditingRouteId(undefined);
  });
}

/** Opens a trip as loaded from the server, at the day `dayId` or with none shown; nothing before it can be undone. */
export function loadTrip(loaded: Trip, dayId?: string): void {
  history.clear();
  batch(() => {
    setOpenTrip(loaded);
    setHistoryVersion((v) => v + 1);
    setSelectedDayId(dayId);
    setEditingRouteId(undefined);
  });
}

export function closeTrip(): void {
  history.clear();
  batch(() => {
    setOpenTrip(undefined);
    setSelectedDayId(undefined);
    setEditingRouteId(undefined);
    setHistoryVersion((v) => v + 1);
  });
}

/** Records the version a save stored; a save is no change. */
export function markSaved(version: number): void {
  const current = openTrip();
  if (current) setOpenTrip({ ...current, version });
}

/** Applies a pure edit to the open trip; with a label it is an undo step. */
function edit(change: (trip: Trip) => Trip, label?: string): void {
  const current = openTrip();
  if (!current) return;
  const next = change(current);
  if (next === current) return;
  batch(() => {
    if (label) {
      history.record(current, label);
      setHistoryVersion((v) => v + 1);
    }
    setOpenTrip(next);
    setChangeCount((c) => c + 1);
  });
}

/** Applies a pure edit to the selected day. */
function editDay(change: (trip: Trip, dayId: string) => Trip, label: string): void {
  const dayId = selectedDayId();
  if (dayId) edit((trip) => change(trip, dayId), label);
}

/** Adds a route to the selected day and starts editing it. */
export function addRoute(): void {
  const id = newId();
  editDay((trip, dayId) => dayEdit.addRoute(trip, dayId, id), 'Add route');
  if (routeById(id)) setEditingRouteId(id);
}

/** Adds routes and stops read from a file to the selected day, as one step. */
export function addParts(parts: { routes: Route[]; stops: Stop[] }): void {
  editDay((trip, dayId) => dayEdit.addParts(trip, dayId, parts), 'Import GPX');
}

export function removeRoute(routeId: string): void {
  editDay((trip, dayId) => dayEdit.removeRoute(trip, dayId, routeId), 'Remove route');
  if (editingRouteId() === routeId) setEditingRouteId(undefined);
}

/** Applies a route edit (see routeEdit) to a route; the day's bound stops follow their points. */
function changeRoute(routeId: string, change: (route: Route) => Route, label?: string): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, change), label);
}

/** Applies an edit of a routed route; a track stays as it is. */
function changeRoutedRoute(routeId: string, change: (route: RoutedRoute) => RoutedRoute, label?: string): void {
  changeRoute(routeId, dayEdit.routedOnly(change), label);
}

/** Leaves out the track's points that keep its line within `toleranceM`. */
export function condenseTrack(routeId: string, toleranceM: number): void {
  changeRoute(routeId, (r) => (r.kind === 'track' ? routeEdit.condenseTrack(r, toleranceM) : r), 'Condense points');
}

/** Makes a route of the track: its points thinned at `toleranceM`, the legs between them routed along the roads. */
export function convertTrackToRoute(routeId: string, toleranceM: number): void {
  changeRoute(routeId, (r) => (r.kind === 'track' ? routeEdit.trackToRoute(r, toleranceM, newId) : r), 'Convert to route');
}

/** Changes what a route says about itself; a new profile or motorway dial routes its legs again. */
export function updateRoute(routeId: string, settings: Partial<routeEdit.RouteSettings>): void {
  changeRoute(routeId, (r) => routeEdit.changeSettings(r, settings), 'Edit route');
}

export function appendPoint(routeId: string, lngLat: LngLat): void {
  changeRoutedRoute(routeId, (r) => routeEdit.appendPoint(r, { id: newId(), lngLat: roundLngLat(lngLat) }), 'Add point');
}

/** Inserts a point of a route before the one at `index`. */
export function insertPoint(routeId: string, index: number, lngLat: LngLat): void {
  changeRoutedRoute(routeId, (r) => routeEdit.insertPoint(r, index, { id: newId(), lngLat: roundLngLat(lngLat) }), 'Insert point');
}

export function movePoint(routeId: string, pointId: string, lngLat: LngLat): void {
  changeRoutedRoute(routeId, (r) => routeEdit.movePoint(r, pointId, roundLngLat(lngLat)), 'Move point');
}

export function removePoint(routeId: string, pointId: string): void {
  changeRoutedRoute(routeId, (r) => routeEdit.removePoint(r, pointId), 'Remove point');
}

/** Makes the leg that leads to the point straight, or routed again. */
export function setStraight(routeId: string, pointId: string, straight: boolean): void {
  changeRoutedRoute(routeId, (r) => routeEdit.setStraight(r, pointId, straight), straight ? 'Straight leg' : 'Routed leg');
}

/** Stores a routed leg; routing results are no undo steps. */
export function setRouteLeg(routeId: string, key: string, leg: RoutedLeg): void {
  changeRoutedRoute(routeId, (r) => routeEdit.addLeg(r, key, leg));
}

/** Drops a route's routed legs so that they are routed again; undoing it brings the old ones back. */
export function clearLegs(routeId: string): void {
  edit((trip) => dayEdit.clearLegs(trip, routeId), 'Reroute');
}

/** Makes a stop of a route point of the selected day. */
export function convertPoint(pointId: string): void {
  editDay((trip, dayId) => dayEdit.convertPoint(trip, dayId, pointId, newId()), 'Add stop');
}

/** Inserts a point of a route before the one at `index` and makes a stop of it, as one step. */
export function insertStop(routeId: string, index: number, lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.insertStop(trip, dayId, routeId, index, roundLngLat(lngLat), newId(), newId()), 'Add stop');
}

/** Adds a free stop to the selected day. */
export function addFreeStop(lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.addFreeStop(trip, dayId, roundLngLat(lngLat), newId()), 'Add stop');
}

/** Where the routes of the selected day pass closest to a free stop of it, within reach; none for a stop that stands alone or is bound. */
const nearOf = (stopId: string): SequenceEntry['near'] => selectedSequence().find((e) => e.stop?.id === stopId)?.near;

/** Whether a free stop of the selected day can be bound where its routes pass closest: a track there has no points to bind to. */
export function canConnect(stopId: string): boolean {
  const near = nearOf(stopId);
  return near !== undefined && routeById(near.routeId)?.kind === 'routed';
}

/** Binds a free stop of the selected day to its routes where they pass closest. */
export function connectStop(stopId: string): void {
  const near = nearOf(stopId);
  if (near) editDay((trip, dayId) => dayEdit.connectStop(trip, dayId, stopId, near.routeId, near.legIndex + 1, newId()), 'Connect stop');
}

export function disconnectStop(stopId: string): void {
  editDay((trip, dayId) => dayEdit.disconnectStop(trip, dayId, stopId), 'Disconnect stop');
}

export function moveStop(stopId: string, lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.moveStop(trip, dayId, stopId, roundLngLat(lngLat)), 'Move stop');
}

export function removeStop(stopId: string): void {
  editDay((trip, dayId) => dayEdit.removeStop(trip, dayId, stopId), 'Remove stop');
}

/** Changes what a stop of the selected day says about itself. */
export function updateStop(stopId: string, change: Partial<Omit<Stop, 'id' | 'pointId'>>, label = 'Edit stop'): void {
  editDay((trip, dayId) => dayEdit.updateStop(trip, dayId, stopId, change), label);
}

export function addDay(): void {
  const id = newId();
  edit((trip) => dayEdit.addDay(trip, id), 'Add day');
  selectDay(id);
}

/** Moves the day to place `to` among the days. */
export function moveDay(dayId: string, to: number): void {
  edit((trip) => dayEdit.moveDay(trip, dayId, to), 'Move day');
}

/** Copies the day right after itself and selects the copy. */
export function duplicateDay(dayId: string): void {
  const id = newId();
  edit((trip) => dayEdit.duplicateDay(trip, dayId, id, newId), 'Duplicate day');
  if (openTrip()?.days.some((d) => d.id === id)) selectDay(id);
}

/** Moves the route to place `to` among the routes of its day. */
export function moveRoute(routeId: string, to: number): void {
  edit((trip) => dayEdit.moveRoute(trip, routeId, to), 'Move route');
}

export function duplicateRoute(routeId: string): void {
  edit((trip) => dayEdit.duplicateRoute(trip, routeId, newId), 'Duplicate route');
}

/** Moves the route and the stops bound to it to another day. */
export function moveRouteToDay(routeId: string, dayId: string): void {
  edit((trip) => dayEdit.moveRouteToDay(trip, routeId, dayId), 'Move route');
  if (editingRouteId() === routeId) setEditingRouteId(undefined);
}

/** Adds copied routes, with their bound stops, at the end of a day, as one step to undo. */
export function pasteRoutes(dayId: string, copied: readonly dayEdit.CopiedRoute[]): void {
  edit((trip) => copied.reduce((t, c) => dayEdit.pasteRoute(t, dayId, c, newId), trip), copied.length > 1 ? 'Paste routes' : 'Paste route');
}

/** Adds a copied stop to a day, free where it stands. */
export function pasteStop(dayId: string, stop: Stop): void {
  edit((trip) => dayEdit.pasteStop(trip, dayId, stop, newId()), 'Paste stop');
}

/** Removes a day; the day before it, or the first, is selected instead. */
export function removeDay(dayId: string): void {
  const days = openTrip()?.days ?? [];
  const index = days.findIndex((d) => d.id === dayId);
  if (index < 0) return;
  edit((trip) => dayEdit.removeDay(trip, dayId), 'Remove day');
  if (selectedDayId() === dayId) selectDay((days[index - 1] ?? days[index + 1])?.id);
}

/** Changes what a day says about itself: its name, date and notes. */
export function updateDay(dayId: string, change: Pick<Day, 'name' | 'date' | 'notes'>): void {
  edit((trip) => dayEdit.updateDay(trip, dayId, (day) => withChanges(day, change)), 'Edit day');
}

/** Changes what the trip says about itself: its name, description, and whether it has been ridden. */
export function updateTrip(change: Pick<Trip, 'name' | 'description' | 'state'>): void {
  edit((trip) => withChanges(trip, change), 'Edit trip');
}
