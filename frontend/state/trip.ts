import { batch, createSignal } from 'solid-js';
import { createStore, reconcile, unwrap } from 'solid-js/store';
import { newId, type Day, type LngLat, type Profile, type Route, type RoutedLeg, type Stop, type Trip } from '../model/trip';
import * as dayEdit from '../routing/dayEdit';
import { roundLngLat } from '../routing/legs';
import * as routeEdit from '../routing/routeEdit';
import { nearestOnRoutes } from '../routing/sequence';
import { History } from './history';

/**
 * The open trip. All writes go through the actions below: results of the pure edits are
 * applied with `reconcile` (a plain set would keep stale keys), edits with a label are
 * undo steps, every content change counts for the autosave, and positions are rounded
 * here, so that the document never holds a coordinate the leg keys cannot agree on.
 */

const [state, setState] = createStore<{ trip?: Trip }>({});

export const openTrip = (): Trip | undefined => state.trip;

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

export const selectedDay = (): Day | undefined => state.trip?.days.find((d) => d.id === selectedDayId());

/** Starts editing a route of the selected day, or ends editing for undefined. */
export function editRoute(id: string | undefined): void {
  setEditingRouteId(id);
}

export const editingRoute = (): Route | undefined => selectedDay()?.routes.find((r) => r.id === editingRouteId());

export function routeById(id: string): Route | undefined {
  for (const day of state.trip?.days ?? []) {
    const route = day.routes.find((r) => r.id === id);
    if (route) return route;
  }
  return undefined;
}

/** Counts the content changes since the trip was loaded; the autosave follows it. */
const [changeCount, setChangeCount] = createSignal(0);
export { changeCount };

const history = new History<Trip>();
const [historyVersion, setHistoryVersion] = createSignal(0);

const snapshot = (): Trip => structuredClone(unwrap(state.trip)!);

function recordEdit(label: string): void {
  history.record(snapshot(), label);
  setHistoryVersion((v) => v + 1);
}

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
  if (state.trip && history.undoLabel !== undefined) restore(history.undo(snapshot()));
}

export function redo(): void {
  if (state.trip && history.redoLabel !== undefined) restore(history.redo(snapshot()));
}

/** Puts back a snapshot; the version stays the current one, since saves are no edits. */
function restore(trip: Trip | undefined): void {
  if (!trip) return;
  batch(() => {
    setState('trip', reconcile({ ...trip, version: state.trip!.version }, { key: 'id', merge: false }));
    setHistoryVersion((v) => v + 1);
    setChangeCount((c) => c + 1);
    if (editingRouteId() && !editingRoute()) setEditingRouteId(undefined);
  });
}

/** Opens a trip as loaded from the server; nothing before it can be undone. */
export function loadTrip(trip: Trip): void {
  history.clear();
  batch(() => {
    setState('trip', reconcile(trip, { key: 'id', merge: false }));
    setHistoryVersion((v) => v + 1);
    setSelectedDayId(trip.days[0]?.id);
    setEditingRouteId(undefined);
  });
}

export function closeTrip(): void {
  history.clear();
  batch(() => {
    setState('trip', undefined);
    setSelectedDayId(undefined);
    setEditingRouteId(undefined);
    setHistoryVersion((v) => v + 1);
  });
}

/** Records the version a save stored; a save is no change. */
export function markSaved(version: number): void {
  if (state.trip) setState('trip', 'version', version);
}

/** Applies a pure edit to the open trip; with a label it is an undo step. */
function edit(change: (trip: Trip) => Trip, label?: string): void {
  const current = unwrap(state.trip);
  if (!current) return;
  const next = change(current);
  if (next === current) return;
  batch(() => {
    if (label) recordEdit(label);
    setState('trip', reconcile(next, { key: 'id', merge: false }));
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

export function removeRoute(routeId: string): void {
  editDay((trip, dayId) => dayEdit.removeRoute(trip, dayId, routeId), 'Remove route');
  if (editingRouteId() === routeId) setEditingRouteId(undefined);
}

export function renameRoute(routeId: string, name: string): void {
  edit((trip) => dayEdit.renameRoute(trip, routeId, name), 'Rename route');
}

export function setRouteProfile(routeId: string, profile: Profile): void {
  edit((trip) => dayEdit.setRouteProfile(trip, routeId, profile), 'Change profile');
}

export function appendPoint(routeId: string, lngLat: LngLat): void {
  edit((trip) => dayEdit.appendPoint(trip, routeId, roundLngLat(lngLat), newId()), 'Add point');
}

/** Inserts a point of a route before the one at `index`. */
export function insertPoint(routeId: string, index: number, lngLat: LngLat): void {
  edit((trip) => dayEdit.insertPoint(trip, routeId, index, roundLngLat(lngLat), newId()), 'Insert point');
}

export function movePoint(routeId: string, pointId: string, lngLat: LngLat): void {
  edit((trip) => dayEdit.movePoint(trip, routeId, pointId, roundLngLat(lngLat)), 'Move point');
}

export function removePoint(routeId: string, pointId: string): void {
  edit((trip) => dayEdit.removePoint(trip, routeId, pointId), 'Remove point');
}

/** Makes the leg that leads to the point straight, or routed again. */
export function setStraight(routeId: string, pointId: string, straight: boolean): void {
  edit((trip) => dayEdit.setStraight(trip, routeId, pointId, straight), straight ? 'Straight leg' : 'Routed leg');
}

/** Stores a routed leg; routing results are no undo steps. */
export function setRouteLeg(routeId: string, key: string, leg: RoutedLeg): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, (r) => routeEdit.addLeg(r, key, leg)));
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
  const pointId = newId();
  editDay((trip, dayId) => dayEdit.convertPoint(dayEdit.insertPoint(trip, routeId, index, roundLngLat(lngLat), pointId), dayId, pointId, newId()), 'Add stop');
}

/** Adds a free stop to the selected day. */
export function addFreeStop(lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.addFreeStop(trip, dayId, roundLngLat(lngLat), newId()), 'Add stop');
}

/** Binds a free stop of the selected day to its routes where they pass closest. */
export function connectStop(stopId: string): void {
  editDay((trip, dayId) => {
    const day = trip.days.find((d) => d.id === dayId)!;
    const stop = day.stops.find((s) => s.id === stopId);
    const near = stop && nearestOnRoutes(day, stop.lngLat);
    return near ? dayEdit.connectStop(trip, dayId, stopId, near.routeId, near.legIndex + 1, newId()) : trip;
  }, 'Connect stop');
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

/** Removes a day; the day before it, or the first, is selected instead. */
export function removeDay(dayId: string): void {
  const days = state.trip?.days ?? [];
  const index = days.findIndex((d) => d.id === dayId);
  if (index < 0) return;
  edit((trip) => dayEdit.removeDay(trip, dayId), 'Remove day');
  if (selectedDayId() === dayId) selectDay((days[index - 1] ?? days[index + 1])?.id);
}

export function renameDay(dayId: string, name: string): void {
  edit((trip) => dayEdit.renameDay(trip, dayId, name), 'Rename day');
}

export function renameTrip(name: string): void {
  edit((trip) => (trip.name === name ? trip : { ...trip, name }), 'Rename trip');
}
