import { beforeEach, expect, it, vi } from 'vitest';
import type { Day, Route, Trip } from '../model/trip';
import { encodePolyline } from '../routing/polyline';
import { keepPinsOfOpenTrip, pinnedRows } from './pinnedLines';
import { pinRoutes, unpinTrips } from './pins';
import { closeTrip, loadTrip } from './trip';

// The library, the preferences and the open trip's recordings read themselves when they are imported or a trip is loaded.
vi.mock('../api', async (original) => ({ ...(await original<typeof import('../api')>()), listTrips: async () => [], listFolders: async () => [], fetchPreferences: async () => ({}), listRecordings: async () => [] }));

const track = (id: string, name: string, line: string): Route => ({ id, name, kind: 'track', profile: 'motorcycle', optional: false, color: null, line });
const day = (id: string, name: string, routes: Route[]): Day => ({ id, name, date: null, notes: '', routes, stops: [] });
const drawn = encodePolyline([
  [8, 47],
  [8.1, 47.1],
]);
const trip: Trip = { id: 1, kind: 'trip', name: 'Alps', description: '', state: 'planned', version: 1, days: [day('d1', 'Arrival', [track('a', '', drawn)]), day('d2', '', [track('b', 'Pass', '')])] };

const called = () => pinnedRows().map((row) => [row.name, ...row.where]);

beforeEach(() => {
  closeTrip();
  unpinTrips([1]);
  loadTrip(trip);
});

it('lists what is pinned of the open trip by its name and where it is found, the unnamed by their number', () => {
  pinRoutes(['a', 'b'], true);
  expect(called()).toEqual([
    ['Route 1', 'Alps', 'Arrival'],
    ['Pass', 'Alps', 'Day 2'],
  ]);
});

it('keeps listing what has a line once its trip is left, and lets go of it from the list', () => {
  pinRoutes(['a', 'b'], true);
  keepPinsOfOpenTrip();
  closeTrip();
  expect(called()).toEqual([['Route 1', 'Alps', 'Arrival']]);
  pinnedRows()[0]!.unpin();
  expect(pinnedRows()).toEqual([]);
});
