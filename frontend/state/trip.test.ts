import { beforeEach, describe, expect, it } from 'vitest';
import type { RoutedRoute, Trip } from '../model/trip';
import { routedLegs } from '../routing/legs';
import { decodePolyline, encodePolyline } from '../routing/polyline';
import { answerQuestion, question } from '../ui/confirm';
import { routedOf } from '../routing/testing';
import { activeRouteId, addDay, setStopSymbols, removeStop, movePoint, convertRouteToTrack, convertTrackToRoute, closeDaysPane, daysPaneOpen, openDaysPane, mergeDaysInto, pasteDays, addFreeStop, addRoute, appendPoint, closeTrip, convertPoint, editingRoute, editingRouteId, isDayMarked, isMarkInTrip, isTripMarked, loadTrip, markFolder, markSaved, markInOpenTrip, markTrip, openTrip, redo, savedTrip, selectDay, selectedDay, takeUpRouteOf, undo, undoLabel, updateStop } from './trip';

const empty = (): Trip => ({ id: 1, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });

/** The open trip as the autosave sends it. */
const sent = (): Trip => JSON.parse(JSON.stringify(openTrip()));

/** A day with a route of two points, edited. */
function dayWithRoute(): string {
  addDay();
  addRoute(selectedDay()!.id);
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
    convertPoint(sent().days[0]!.routes[0]!.id, routedOf(sent().days[0]!.routes[0]!).points[1]!.id);
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

  it('edits the stops and routes of a day that is not the selected one', () => {
    dayWithRoute();
    const [first] = openTrip()!.days;
    convertPoint(first!.routes[0]!.id, routedOf(first!.routes[0]!).points[1]!.id);
    const stopId = openTrip()!.days[0]!.stops[0]!.id;
    addDay();
    expect(selectedDay()!.id).not.toBe(first!.id);
    updateStop(stopId, { name: 'Lunch' });
    setStopSymbols([stopId], 'Restaurant');
    addRoute(first!.id);
    expect(openTrip()!.days[0]).toMatchObject({ stops: [{ name: 'Lunch', symbol: 'Restaurant' }], routes: [{}, {}] });
    // A route added to another day than the selected one is not taken up.
    expect(editingRouteId()).toBeUndefined();
    removeStop(stopId);
    expect(openTrip()!.days[0]!.stops).toEqual([]);
  });

  it('undoes and redoes edits without losing the rest of the trip', () => {
    dayWithRoute();
    convertPoint(sent().days[0]!.routes[0]!.id, routedOf(sent().days[0]!.routes[0]!).points[0]!.id);
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
    addRoute(selectedDay()!.id);
    markSaved(openTrip()!, 3);
    undo();
    expect(sent().version).toBe(3);
    expect(sent().days[0]!.routes).toHaveLength(0);
  });

  it('converts a route to a track and a track to a route beside it, leaving what it was made of', () => {
    addDay();
    addRoute(selectedDay()!.id);
    const routeId = openTrip()!.days[0]!.routes[0]!.id;
    appendPoint(routeId, [8, 49]);
    appendPoint(routeId, [8.1, 49.1]);
    const route = openTrip()!.days[0]!.routes[0]!;
    convertRouteToTrack(routeId);
    const [first, track] = openTrip()!.days[0]!.routes;
    expect([first, track!.kind, track!.id === routeId]).toEqual([route, 'track', false]);
    convertTrackToRoute(track!.id, 10);
    expect(openTrip()!.days[0]!.routes.map((r) => r.kind)).toEqual(['routed', 'track', 'routed']);
    expect(openTrip()!.days[0]!.routes[1]).toBe(track);
    undo();
    undo();
    expect(openTrip()!.days[0]!.routes).toEqual([route]);
  });

  it('asks before the first edit that loses a route\'s original way, and keeps it as a track where that is asked for', async () => {
    const route: RoutedRoute = { id: 'r', name: 'Loop', kind: 'routed', profile: 'motorcycle', highways: 'allow', optional: false, color: null, points: [{ id: 'a', lngLat: [8, 49] }, { id: 'b', lngLat: [8.1, 49] }, { id: 'c', lngLat: [8.2, 49] }], legs: {} };
    const fromFile = { geometry: encodePolyline([[8, 49], [8.05, 49.05], [8.1, 49]]), distanceM: 1, durationS: null };
    const loop: RoutedRoute = { ...route, legs: Object.fromEntries(routedLegs(route).map((leg) => [leg.key, fromFile])) };
    closeTrip();
    loadTrip({ ...empty(), days: [{ id: 'd', name: '', date: null, notes: '', routes: [loop], stops: [] }] });
    const routes = () => openTrip()!.days[0]!.routes;
    // Refused, the edit is not made; asked again, it is made without the original, and no more is asked of that route.
    movePoint('r', 'b', [8.1, 49.01]);
    expect([routes(), question()?.actions]).toEqual([[loop], ['Change without', 'Keep the original']]);
    answerQuestion();
    await Promise.resolve();
    expect(routes()).toEqual([loop]);
    // An edit that loses nothing of it is not asked about.
    appendPoint('r', [8.3, 49]);
    expect([routes()[0] === loop, question()]).toEqual([false, undefined]);
    undo();
    movePoint('r', 'b', [8.1, 49.01]);
    answerQuestion('Keep the original');
    await Promise.resolve();
    await Promise.resolve();
    expect(routes().map((r) => [r.kind, r.name])).toEqual([
      ['routed', 'Loop'],
      ['track', 'Loop'],
    ]);
    expect(routedOf(routes()[0]!).points[1]!.lngLat).toEqual([8.1, 49.01]);
    const track = routes()[1]!;
    expect(track.kind === 'track' && decodePolyline(track.line)).toHaveLength(5);
    movePoint('r', 'c', [8.2, 49.01]);
    expect([question(), routedOf(routes()[0]!).points[2]!.lngLat]).toEqual([undefined, [8.2, 49.01]]);
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
