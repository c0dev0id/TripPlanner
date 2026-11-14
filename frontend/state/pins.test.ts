import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { isRecordingPinned, isRoutePinned, pinRecordings, pinRoutes } from './pins';
import { closeTrip, loadTrip } from './trip';

const empty = (id: number): Trip => ({ id, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });

describe('the pins', () => {
  beforeEach(() => {
    closeTrip();
    loadTrip(empty(1));
  });

  it('hold nothing until a route or a recording is pinned, and let go of it again', () => {
    expect([isRoutePinned('a'), isRecordingPinned(7)]).toEqual([false, false]);
    pinRoutes(['a', 'b'], true);
    pinRoutes(['b'], false);
    pinRecordings([7, 8], true);
    pinRecordings([8], false);
    expect([isRoutePinned('a'), isRoutePinned('b'), isRecordingPinned(7), isRecordingPinned(8)]).toEqual([true, false, true, false]);
  });

  it('go with the trip', () => {
    pinRoutes(['a'], true);
    pinRecordings([7], true);
    loadTrip(empty(2));
    expect([isRoutePinned('a'), isRecordingPinned(7)]).toEqual([false, false]);
  });
});
