import { unwrap } from 'solid-js/store';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { addDay, addFreeStop, addRoute, appendPoint, closeTrip, convertPoint, editingRouteId, loadTrip, markSaved, openTrip, redo, selectDay, undo, undoLabel, updateStop } from './trip';

const empty = (): Trip => ({ id: 1, name: 'T', description: '', state: 'planned', version: 1, days: [] });

/** The open trip as the autosave sends it. */
const sent = (): Trip => JSON.parse(JSON.stringify(unwrap(openTrip())));

/** A day with a route of two points, edited. */
function dayWithRoute(): string {
  addDay();
  addRoute();
  const routeId = editingRouteId()!;
  appendPoint(routeId, [1.00000049, 1]);
  appendPoint(routeId, [2, 2]);
  return routeId;
}

describe('the trip store', () => {
  beforeEach(() => {
    closeTrip();
    loadTrip(empty());
  });

  it('adds a day, a route being edited, and rounded points', () => {
    dayWithRoute();
    const trip = sent();
    expect(trip.days).toHaveLength(1);
    expect(trip.days[0]!.routes).toHaveLength(1);
    expect(trip.days[0]!.routes[0]!.points.map((p) => p.lngLat)).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(editingRouteId()).toBe(trip.days[0]!.routes[0]!.id);
  });

  it('ends editing when another day is shown', () => {
    dayWithRoute();
    addDay();
    expect(editingRouteId()).toBeUndefined();
    selectDay(sent().days[0]!.id);
    expect(editingRouteId()).toBeUndefined();
  });

  it('makes stops of points and beside the route', () => {
    dayWithRoute();
    convertPoint(sent().days[0]!.routes[0]!.points[1]!.id);
    addFreeStop([1.5, 1.6]);
    const stops = sent().days[0]!.stops;
    expect(stops.map((s) => [s.name, s.pointId !== null])).toEqual([
      ['Stop 1', true],
      ['Stop 2', false],
    ]);
    updateStop(stops[0]!.id, { name: 'Lunch', kind: 'restaurant' });
    expect(sent().days[0]!.stops[0]).toMatchObject({ name: 'Lunch', kind: 'restaurant' });
  });

  it('undoes and redoes edits without losing the rest of the trip', () => {
    dayWithRoute();
    convertPoint(sent().days[0]!.routes[0]!.points[0]!.id);
    const stopId = sent().days[0]!.stops[0]!.id;
    updateStop(stopId, { name: 'Home' });
    expect(undoLabel()).toBe('Edit stop');
    undo();
    expect(sent().days[0]!.stops[0]!.name).toBe('Stop 1');
    redo();
    expect(sent().days[0]!.stops[0]!.name).toBe('Home');
    undo();
    undo();
    expect(sent().days[0]!.stops).toHaveLength(0);
    expect(sent().days[0]!.routes[0]!.points).toHaveLength(2);
    undo();
    undo();
    undo();
    expect(sent().days[0]!.routes).toHaveLength(0);
    expect(editingRouteId()).toBeUndefined();
    undo();
    expect(sent().days).toHaveLength(0);
    expect(undoLabel()).toBeUndefined();
  });

  it('keeps the saved version through an undo', () => {
    addDay();
    markSaved(2);
    addRoute();
    markSaved(3);
    undo();
    expect(sent().version).toBe(3);
    expect(sent().days[0]!.routes).toHaveLength(0);
  });
});
