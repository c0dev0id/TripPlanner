import { batch, createSignal } from 'solid-js';
import { createStore, reconcile, unwrap } from 'solid-js/store';
import { newId, type Day, type LngLat, type Profile, type Route, type RoutedLeg, type Trip } from '../model/trip';
import * as dayEdit from '../routing/dayEdit';
import * as routeEdit from '../routing/routeEdit';
import { History } from './history';

/**
 * The open trip. All writes go through the actions below: results of the pure edits are
 * applied with `reconcile` (a plain set would keep stale keys), edits with a label are
 * undo steps, and every content change counts for the autosave.
 */

const [state, setState] = createStore<{ trip?: Trip }>({});

export const openTrip = (): Trip | undefined => state.trip;

const [selectedDayId, setSelectedDayId] = createSignal<string>();
export { selectedDayId };

export function selectDay(id: string | undefined): void {
  setSelectedDayId(id);
}

export const selectedDay = (): Day | undefined => state.trip?.days.find((d) => d.id === selectedDayId());

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
  if (state.trip) restore(history.undo(snapshot()));
}

export function redo(): void {
  if (state.trip) restore(history.redo(snapshot()));
}

/** Puts back a snapshot; the version stays the current one, since saves are no edits. */
function restore(trip: Trip | undefined): void {
  if (!trip) return;
  batch(() => {
    setState('trip', reconcile({ ...trip, version: state.trip!.version }, { key: 'id', merge: false }));
    setHistoryVersion((v) => v + 1);
    setChangeCount((c) => c + 1);
  });
}

/** Opens a trip as loaded from the server; nothing before it can be undone. */
export function loadTrip(trip: Trip): void {
  history.clear();
  batch(() => {
    setState('trip', reconcile(trip, { key: 'id', merge: false }));
    setHistoryVersion((v) => v + 1);
    setSelectedDayId(trip.days[0]?.id);
  });
}

export function closeTrip(): void {
  history.clear();
  batch(() => {
    setState('trip', undefined);
    setSelectedDayId(undefined);
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

export function addStop(lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.appendStop(trip, dayId, lngLat, newId), 'Add stop');
}

/** Adds a stop on the selected day's route `routeIndex`, splitting it at its leg `legIndex`. */
export function insertStop(routeIndex: number, legIndex: number, lngLat: LngLat): void {
  editDay((trip, dayId) => dayEdit.insertStop(trip, dayId, routeIndex, legIndex, lngLat, newId), 'Add stop');
}

export function removeStop(stopId: string): void {
  editDay((trip, dayId) => dayEdit.removeStop(trip, dayId, stopId), 'Remove stop');
}

export function movePlace(placeId: string, lngLat: LngLat): void {
  edit((trip) => dayEdit.movePlace(trip, placeId, lngLat), 'Move stop');
}

export function renamePlace(placeId: string, name: string): void {
  edit((trip) => dayEdit.renamePlace(trip, placeId, name), 'Rename stop');
}

/** Inserts a point of a route before the one at `index`. */
export function insertPoint(routeId: string, index: number, lngLat: LngLat): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, (r) => routeEdit.insertPoint(r, index, { id: newId(), lngLat })), 'Insert point');
}

export function movePoint(routeId: string, pointId: string, lngLat: LngLat): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, (r) => routeEdit.movePoint(r, pointId, lngLat)), 'Move point');
}

export function removePoint(routeId: string, pointId: string): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, (r) => routeEdit.removePoint(r, pointId)), 'Remove point');
}

/** Makes the leg that leads to the point straight, or routed again. */
export function setStraight(routeId: string, pointId: string, straight: boolean): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, (r) => routeEdit.setStraight(r, pointId, straight)), straight ? 'Straight leg' : 'Routed leg');
}

/** Stores a routed leg; routing results are no undo steps. */
export function setRouteLeg(routeId: string, key: string, leg: RoutedLeg): void {
  edit((trip) => dayEdit.updateRoute(trip, routeId, (r) => routeEdit.addLeg(r, key, leg)));
}

export function setDayProfile(profile: Profile): void {
  editDay((trip, dayId) => dayEdit.setDayProfile(trip, dayId, profile), 'Change profile');
}

/** Drops the selected day's routed legs so that they are routed again; undoing it brings the old ones back. */
export function clearDayLegs(): void {
  editDay((trip, dayId) => dayEdit.clearDayLegs(trip, dayId), 'Recalculate day');
}

export function addDay(): void {
  const id = newId();
  edit((trip) => dayEdit.addDay(trip, () => id), 'Add day');
  setSelectedDayId(id);
}

/** Removes a day; the day before it, or the first, is selected instead. */
export function removeDay(dayId: string): void {
  const days = state.trip?.days ?? [];
  const index = days.findIndex((d) => d.id === dayId);
  if (index < 0) return;
  edit((trip) => dayEdit.removeDay(trip, dayId), 'Remove day');
  if (selectedDayId() === dayId) setSelectedDayId((days[index - 1] ?? days[index + 1])?.id);
}

export function renameDay(dayId: string, name: string): void {
  edit((trip) => dayEdit.renameDay(trip, dayId, name), 'Rename day');
}

export function renameTrip(name: string): void {
  edit((trip) => (trip.name === name ? trip : { ...trip, name }), 'Rename trip');
}
