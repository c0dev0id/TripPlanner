import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { routedOf } from '../routing/testing';
import { activeRouteId, addDay, closeDaysPane, daysPaneOpen, openDaysPane, mergeDaysInto, pasteDays, addFreeStop, addRoute, appendPoint, closeTrip, convertPoint, editingRoute, editingRouteId, isDayMarked, isMarkInTrip, isTripMarked, loadTrip, markFolder, markSaved, markInOpenTrip, markTrip, openTrip, redo, savedTrip, selectDay, selectedDay, takeUpRouteOf, undo, undoLabel, updateStop } from './trip';

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

  it('pastes days after a day and answers the ids it gave them, in their order', () => {
    addDay();
    addDay();
    const [first, second] = sent().days;
    const made = pasteDays([{ ...second!, name: 'B' }, { ...first!, name: 'A' }], first!.id);
    expect(sent().days.map((day) => day.id)).toEqual([first!.id, ...made, second!.id]);
    expect(made.map((id) => sent().days.find((day) => day.id === id)!.name)).toEqual(['B', 'A']);
  });

  it('merges days into another as one step: their stops move and the days go', () => {
    addDay();
    addFreeStop([1, 1]);
    addDay();
    addFreeStop([2, 2]);
    const [into, merged] = sent().days;
    mergeDaysInto([merged!.id], into!.id);
    expect(sent().days.map((day) => day.stops.map((stop) => stop.lngLat))).toEqual([[[1, 1], [2, 2]]]);
    undo();
    expect(sent().days.map((day) => day.stops.length)).toEqual([1, 1]);
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
    markSaved(openTrip()!, 2);
    expect(selectedDay()).toBe(shown);
    selectDay(first!.id);
    appendPoint(routeId, [3, 3]);
    expect(openTrip()!.days[1]).toBe(second);
    expect(selectedDay()).not.toBe(first);
    undo();
    expect(openTrip()!.days[0]).toBe(first);
  });

  it('remembers the trip as the server has it: as loaded, then as last saved', () => {
    const loaded = savedTrip();
    addDay();
    expect(savedTrip()).toBe(loaded);
    const sentTrip = openTrip()!;
    addDay();
    markSaved(sentTrip, 2);
    expect(savedTrip()).toBe(sentTrip);
    expect(openTrip()!.days).toHaveLength(2);
    closeTrip();
    expect(savedTrip()).toBeUndefined();
  });

  it('gives the mark to the day picked, and back to the trip, which closes the day', () => {
    addDay();
    const dayId = openTrip()!.days[0]!.id;
    expect(isDayMarked(dayId)).toBe(true);
    expect(isTripMarked()).toBe(false);
    markTrip();
    expect(selectedDay()).toBeUndefined();
    expect(isTripMarked()).toBe(true);
    // A folder takes the mark from the trip and its day, which stay open, until one of them is clicked.
    selectDay(dayId);
    markFolder();
    expect([isTripMarked(), isDayMarked(dayId), isMarkInTrip()]).toEqual([false, false, false]);
    expect(selectedDay()?.id).toBe(dayId);
    markInOpenTrip();
    expect(isDayMarked(dayId)).toBe(true);
    markFolder();
    markTrip();
    expect([isTripMarked(), isMarkInTrip(), selectedDay()]).toEqual([true, true, undefined]);
  });

  it('opens the pane of the days for a day shown, and keeps it as it is for another trip', () => {
    expect(daysPaneOpen()).toBe(false);
    addDay();
    const dayId = openTrip()!.days[0]!.id;
    expect(daysPaneOpen()).toBe(true);
    closeDaysPane();
    expect([daysPaneOpen(), selectedDay()]).toEqual([false, undefined]);
    // Opened on a trip of one day, the pane shows that day; a trip of several shows none.
    openDaysPane();
    expect(selectedDay()?.id).toBe(dayId);
    const two = { ...empty(), id: 2, days: [openTrip()!.days[0]!, { ...openTrip()!.days[0]!, id: 'second' }] };
    loadTrip(two);
    expect([daysPaneOpen(), selectedDay()]).toEqual([true, undefined]);
    loadTrip({ ...two, id: 3, days: [two.days[1]!] });
    expect(selectedDay()?.id).toBe('second');
    closeDaysPane();
    loadTrip(two);
    expect(daysPaneOpen()).toBe(false);
    loadTrip(two, 'second');
    expect(daysPaneOpen()).toBe(true);
    closeTrip();
    expect(daysPaneOpen()).toBe(false);
  });

  it('keeps the saved version through an undo', () => {
    addDay();
    markSaved(openTrip()!, 2);
    addRoute();
    markSaved(openTrip()!, 3);
    undo();
    expect(sent().version).toBe(3);
    expect(sent().days[0]!.routes).toHaveLength(0);
  });

  it('takes up a route of a collection without editing it', () => {
    closeTrip();
    loadTrip({ ...empty(), kind: 'collection', days: [{ id: 'd', name: 'S', date: null, notes: '', routes: [{ id: 'r', name: '', kind: 'track', profile: 'motorcycle', optional: false, color: null, line: '' }], stops: [] }] });
    takeUpRouteOf('d', 'r');
    expect([selectedDay()?.id, activeRouteId(), editingRouteId(), editingRoute()]).toEqual(['d', 'r', undefined, undefined]);
    selectDay(undefined);
    expect(activeRouteId()).toBeUndefined();
  });
});
