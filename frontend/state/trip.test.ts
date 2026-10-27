import { unwrap } from 'solid-js/store';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { addDay, addStop, closeTrip, loadTrip, markSaved, openTrip, redo, renamePlace, selectedDay, undo, undoLabel } from './trip';

const empty = (): Trip => ({ id: 1, name: 'T', description: '', startsOn: null, version: 1, places: [], days: [] });

/** The open trip as the autosave sends it. */
const sent = (): Trip => JSON.parse(JSON.stringify(unwrap(openTrip())));

describe('the trip store', () => {
  beforeEach(() => {
    closeTrip();
    loadTrip(empty());
  });

  it('adds a day and stops to it', () => {
    addDay();
    addStop([1, 1]);
    addStop([2, 2]);
    const trip = sent();
    expect(trip.days).toHaveLength(1);
    expect(trip.days[0]!.stops).toHaveLength(2);
    expect(trip.days[0]!.routes).toHaveLength(1);
    expect(trip.places.map((p) => p.name)).toEqual(['Stop 1', 'Stop 2']);
    expect(selectedDay()?.id).toBe(trip.days[0]!.id);
  });

  it('undoes and redoes edits without losing the rest of the trip', () => {
    addDay();
    addStop([1, 1]);
    addStop([2, 2]);
    const placeId = sent().places[0]!.id;
    renamePlace(placeId, 'Home');
    expect(sent().places[0]!.name).toBe('Home');
    expect(undoLabel()).toBe('Rename stop');
    undo();
    expect(sent().places[0]!.name).toBe('Stop 1');
    expect(sent().days[0]!.stops).toHaveLength(2);
    redo();
    expect(sent().places[0]!.name).toBe('Home');
    expect(sent().days[0]!.stops).toHaveLength(2);
    expect(sent().days[0]!.routes).toHaveLength(1);
    undo();
    undo();
    expect(sent().days[0]!.stops).toHaveLength(1);
    expect(sent().days[0]!.routes).toHaveLength(0);
    undo();
    expect(sent().days[0]!.stops).toHaveLength(0);
    undo();
    expect(sent().days).toHaveLength(0);
    expect(undoLabel()).toBeUndefined();
  });

  it('keeps the saved version through an undo', () => {
    addDay();
    markSaved(2);
    addStop([1, 1]);
    markSaved(3);
    undo();
    expect(sent().version).toBe(3);
    expect(sent().days[0]!.stops).toHaveLength(0);
  });
});
