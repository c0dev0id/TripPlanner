import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Trip } from '../model/trip';
import { dropOn, dropTarget } from '../ui/carry';
import { clearClip, copyParts, dropsOnPart, heldParts, pasteItems } from './clipboard';
import { addDay, addRoute, addStopBeside, closeTrip, loadTrip, openTrip, selectDay, selectedDayId } from './trip';

// The library and the open trip's media list themselves when they are imported or a trip is loaded.
vi.mock('../api', async (original) => ({ ...(await original<typeof import('../api')>()), listTrips: async () => [], listFolders: async () => [], listMedia: async () => [], listRecordings: async () => [] }));

const empty = (): Trip => ({ id: 1, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });
const days = () => openTrip()!.days;

/** Two days with a route each, a stop beside the route of the first. */
function twoDays(): { first: string; second: string; stop: string } {
  addDay();
  addRoute(selectedDayId()!);
  addStopBeside([1, 1]);
  addDay();
  addRoute(selectedDayId()!);
  const [first, second] = days();
  selectDay(first!.id);
  return { first: first!.id, second: second!.id, stop: first!.stops[0]!.id };
}

/** What a drop of a stop, as a drag holds it, onto a day does. */
function dropStopOnDay(stop: string, day: string) {
  const row = document.createElement('li');
  dropsOnPart(row, 'day', () => day);
  return dropOn(row, heldParts('a stop', 'stop', [stop])!);
}

describe('what a drag carries', () => {
  beforeEach(() => {
    closeTrip();
    clearClip();
    loadTrip(empty());
  });

  it('is dropped as a cut is pasted: a stop moves to the route of the day it is dropped on', () => {
    const { first, second, stop } = twoDays();
    const drop = dropStopOnDay(stop, second);
    expect(drop).toBeTypeOf('function');
    drop!();
    expect(days().map((day) => day.stops.map((s) => s.routeId === day.routes[0]!.id))).toEqual([[], [true]]);
    expect(days().map((day) => day.id)).toEqual([first, second]);
  });

  it('leaves the clipboard as it was', () => {
    const { first, second, stop } = twoDays();
    copyParts('day', [first]);
    dropStopOnDay(stop, second)!();
    expect(pasteItems('day', second)).toHaveLength(1);
  });

  it('is refused where the drop would change nothing, and passes by a place that is for another kind of thing', () => {
    const { first, stop } = twoDays();
    expect(dropStopOnDay(stop, first)).toBeNull();
    const folder = document.createElement('li');
    dropTarget<number[]>(folder, 'items', () => () => undefined);
    expect(dropOn(folder, heldParts('a stop', 'stop', [stop])!)).toBeUndefined();
  });
});

describe('a paste of what was cut', () => {
  beforeEach(() => {
    closeTrip();
    clearClip();
    loadTrip(empty());
  });

  it('is offered on another day and not on the day it is on already', () => {
    const { first, second, stop } = twoDays();
    copyParts('stop', [stop], true);
    expect(pasteItems('day', first)).toEqual([]);
    expect(pasteItems('day', second)).toHaveLength(1);
  });

  it('is not offered on a day without a route or a track, which takes no stops', () => {
    const { stop } = twoDays();
    addDay();
    copyParts('stop', [stop]);
    expect(pasteItems('day', days()[2]!.id)).toEqual([]);
    expect(pasteItems('route', days()[1]!.routes[0]!.id)).toHaveLength(1);
  });
});
