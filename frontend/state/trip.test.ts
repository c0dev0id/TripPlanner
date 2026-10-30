import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { routedOf } from '../routing/testing';
import { addDay, addFreeStop, addRoute, appendPoint, closeTrip, convertPoint, editingRouteId, loadTrip, markSaved, openTrip, redo, selectDay, selectedDay, undo, undoLabel, updateStop } from './trip';

const empty = (): Trip => ({ id: 1, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });

/** The open trip as the autosave sends it. */
const sent = (): Trip => JSON.parse(JSON.stringify(openTrip()));

/** A day with a route of two points, edited. */
function dayWithRoute(): string {
  addDay();
  addRoute();
  const routeId = editingRouteId()!;
  appendPoint(routeId, [1.00000049, 1]);
  appendPoint(routeId, [2, 2]);
  return routeId;
}

describe('the open trip', () => {
  beforeEach(() => {
    closeTrip();
    loadTrip(empty());
  });

  it('adds a day, a route being edited, and rounded points', () => {
    dayWithRoute();
    const trip = sent();
    expect(trip.days).toHaveLength(1);
    expect(trip.days[0]!.routes).toHaveLength(1);
    expect(routedOf(trip.days[0]!.routes[0]!).points.map((p) => p.lngLat)).toEqual([
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
    convertPoint(routedOf(sent().days[0]!.routes[0]!).points[1]!.id);
    addFreeStop([1.5, 1.6]);
    const stops = sent().days[0]!.stops;
    expect(stops.map((s) => [s.name, s.pointId !== null])).toEqual([
      ['Stop 1', true],
      ['Stop 2', false],
    ]);
    updateStop(stops[0]!.id, { name: 'Lunch', symbol: 'Restaurant' });
    expect(sent().days[0]!.stops[0]).toMatchObject({ name: 'Lunch', symbol: 'Restaurant' });
  });

  it('undoes and redoes edits without losing the rest of the trip', () => {
    dayWithRoute();
    convertPoint(routedOf(sent().days[0]!.routes[0]!).points[0]!.id);
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
    expect(routedOf(sent().days[0]!.routes[0]!).points).toHaveLength(2);
    undo();
    undo();
    undo();
    expect(sent().days[0]!.routes).toHaveLength(0);
    expect(editingRouteId()).toBeUndefined();
    undo();
    expect(sent().days).toHaveLength(0);
    expect(undoLabel()).toBeUndefined();
  });

  it('keeps every part an edit leaves alone, and the selected day through a save', () => {
    const routeId = dayWithRoute();
    addDay();
    const [first, second] = openTrip()!.days;
    const shown = selectedDay();
    markSaved(2);
    expect(selectedDay()).toBe(shown);
    selectDay(first!.id);
    appendPoint(routeId, [3, 3]);
    expect(openTrip()!.days[1]).toBe(second);
    expect(selectedDay()).not.toBe(first);
    undo();
    expect(openTrip()!.days[0]).toBe(first);
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
