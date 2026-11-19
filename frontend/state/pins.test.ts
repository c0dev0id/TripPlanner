import { beforeEach, describe, expect, it } from 'vitest';
import type { Trip } from '../model/trip';
import { isRecordingPinned, isRoutePinned, keepPins, pinRecordings, pinRoutes, pinnedLinesAside, pinnedRoutes, unpinTrips, type KeptPin, type PinnedLine } from './pins';
import { closeTrip, loadTrip } from './trip';

const empty = (id: number): Trip => ({ id, kind: 'trip', name: 'T', description: '', state: 'planned', version: 1, days: [] });
const line = (color: string): PinnedLine => ({ points: [[8, 47]], color });
const kept = (color: string): KeptPin => ({ ...line(color), name: color, where: ['T', 'Day 1'] });
const none = () => undefined;

describe('the pins', () => {
  beforeEach(() => {
    closeTrip();
    unpinTrips([1, 2]);
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

  it('stay when another trip is opened, drawn from their copies while their trip is not open', () => {
    pinRoutes(['a'], true);
    pinRecordings([7], true);
    expect(pinnedLinesAside()).toEqual([]);
    keepPins(() => kept('red'), () => kept('blue'));
    loadTrip(empty(2));
    expect([isRoutePinned('a'), isRecordingPinned(7)]).toEqual([true, true]);
    expect(pinnedLinesAside()).toEqual([line('red'), line('blue')]);
    expect(pinnedRoutes().get('a')).toEqual({ tripId: 1, kept: kept('red') });
    loadTrip(empty(1));
    expect(pinnedLinesAside()).toEqual([]);
  });

  it('take a new copy each time their trip is left, and leave the copies of other trips alone', () => {
    pinRoutes(['a'], true);
    keepPins(() => kept('red'), none);
    loadTrip(empty(2));
    pinRoutes(['b'], true);
    keepPins(() => kept('green'), none);
    closeTrip();
    expect(pinnedLinesAside()).toEqual([line('red'), line('green')]);
  });

  it('go where their trip is left and they have no line any more', () => {
    pinRoutes(['a', 'gone'], true);
    keepPins((id) => (id === 'a' ? kept('red') : undefined), none);
    expect([isRoutePinned('a'), isRoutePinned('gone')]).toEqual([true, false]);
  });

  it('go with a trip that is deleted', () => {
    pinRoutes(['a'], true);
    keepPins(() => kept('red'), none);
    loadTrip(empty(2));
    pinRoutes(['b'], true);
    unpinTrips([1]);
    expect([isRoutePinned('a'), isRoutePinned('b'), pinnedLinesAside()]).toEqual([false, true, []]);
  });
});
