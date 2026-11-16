import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Trip } from '../model/trip';
import { carriedParts, clearClip, copyParts, dropOnPart, pasteItems } from './clipboard';
import { addDay, addFreeStop, closeTrip, loadTrip, openTrip, selectDay } from './trip';

// The library and the open trip's media list themselves when they are imported or a trip is loaded.
vi.mock('../api', async (original) => ({ ...(await original<typeof import('../api')>()), listTrips: async () => [], listFolders: async () => [], listMedia: async () => [], listRecordings: async () => [] }));

const empty = (): Trip => ({ id: 1, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });
const days = () => openTrip()!.days;

/** Two days, a free stop on the first. */
function twoDays(): { first: string; second: string; stop: string } {
  addDay();
  addFreeStop([1, 1]);
  addDay();
  const [first, second] = days();
  selectDay(first!.id);
  return { first: first!.id, second: second!.id, stop: first!.stops[0]!.id };
}

describe('what a drag carries', () => {
  beforeEach(() => {
    closeTrip();
    clearClip();
    loadTrip(empty());
  });

  it('is dropped as a cut is pasted: a stop moves to the day it is dropped on', () => {
    const { first, second, stop } = twoDays();
    const drop = dropOnPart(carriedParts('stop', [stop]), 'day', second);
    expect(drop).toBeTypeOf('function');
    drop!();
    expect(days().map((day) => day.stops.map((s) => s.id))).toEqual([[], [stop]]);
    expect(days().map((day) => day.id)).toEqual([first, second]);
  });

  it('leaves the clipboard as it was', () => {
    const { first, second, stop } = twoDays();
    copyParts('day', [first]);
    dropOnPart(carriedParts('stop', [stop]), 'day', second)!();
    expect(pasteItems('day', second)).toHaveLength(1);
  });

  it('is refused where the drop would change nothing, and is not for a place that is for something else', () => {
    const { first, stop } = twoDays();
    expect(dropOnPart(carriedParts('stop', [stop]), 'day', first)).toBeNull();
    expect(dropOnPart(carriedParts('day', [first]), 'day', first)).toBeNull();
    expect(dropOnPart({ items: [] }, 'day', first)).toBeUndefined();
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
});
