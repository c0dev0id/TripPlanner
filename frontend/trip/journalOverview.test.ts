import { describe, expect, it } from 'vitest';
import type { Entry } from '../model/journal';
import type { Trip } from '../model/trip';
import { journalOverview } from './journalOverview';

const entry = (id: number, on: Partial<Pick<Entry, 'dayId' | 'stopId' | 'routeId'>>): Entry => ({
  id,
  tripId: 1,
  dayId: null,
  stopId: null,
  routeId: null,
  text: `note ${id}`,
  file: null,
  takenAt: null,
  lngLat: null,
  createdAt: '2026-10-27T10:00:00Z',
  ...on,
});

const trip: Trip = {
  id: 1,
  name: 'Alps',
  description: '',
  state: 'planned',
  version: 1,
  days: [
    {
      id: 'd1',
      name: '',
      date: null,
      notes: '',
      routes: [{ id: 'r1', name: 'Pass road', kind: 'routed', profile: 'motorcycle', highways: 'allow', optional: false, points: [], legs: {} }],
      stops: [
        { id: 's1', name: 'Hut', kind: 'cafe', lngLat: [10, 47], pointId: null, arriveAt: null, pauseMinutes: null, optional: false, address: '', contact: '', bookingReference: '', notes: '' },
        { id: 's2', name: 'Home', kind: 'other', lngLat: [11, 47], pointId: null, arriveAt: null, pauseMinutes: null, optional: false, address: '', contact: '', bookingReference: '', notes: '' },
      ],
    },
    { id: 'd2', name: '', date: null, notes: '', routes: [], stops: [] },
  ],
};

describe('the journal overview', () => {
  it('lists the trip, then each day with its routes and stops, leaving out what has no entry', () => {
    const entries = [entry(1, { stopId: 's2' }), entry(2, {}), entry(3, { routeId: 'r1' }), entry(4, { stopId: 's1' })];
    const parts = journalOverview(trip, entries);
    expect(parts.map((p) => `${p.kind}:${p.label}:${p.entries.map((e) => e.id).join(',')}`)).toEqual(['trip:On the trip:2', 'day:Day 1:', 'route:Pass road:3', 'stop:Hut:4', 'stop:Home:1']);
  });

  it('lists a day for its own entries alone', () => {
    expect(journalOverview(trip, [entry(1, { dayId: 'd2' })]).map((p) => p.label)).toEqual(['Day 2']);
    expect(journalOverview(trip, [])).toEqual([]);
  });
});
