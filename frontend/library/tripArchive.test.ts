import { describe, expect, it } from 'vitest';
import type { Day } from '../model/trip';
import { archiveFolders, inFolders, withNewIds } from './tripArchive';

describe('archiveFolders', () => {
  it('finds the folders that hold an exported trip', () => {
    const folders = archiveFolders(['export/Alps/trip.json', 'export/Alps/Day-1.gpx', 'export/Alps/journal/3-a.jpg', 'export/loose.gpx', 'export/trip.json.txt']);
    expect(folders).toEqual(['export/Alps']);
    expect(inFolders('export/Alps/recordings/1-ride.gpx', folders)).toBe(true);
    expect(inFolders('export/Alps 2/ride.gpx', folders)).toBe(false);
    expect(inFolders('export/loose.gpx', folders)).toBe(false);
  });

  it('takes the folder picked itself for one', () => {
    expect(archiveFolders(['trip.json', 'Day-1.gpx'])).toEqual(['']);
    expect(inFolders('Day-1.gpx', [''])).toBe(true);
  });
});

describe('withNewIds', () => {
  const day: Day = {
    id: 'd',
    name: 'One',
    date: null,
    notes: '',
    routes: [
      { id: 'r', name: '', kind: 'routed', profile: 'motorcycle', highways: 'allow', optional: false, color: null, points: [{ id: 'p0', lngLat: [8, 47] }, { id: 'p1', lngLat: [8.1, 47] }], legs: {} },
      { id: 't', name: '', kind: 'track', profile: 'motorcycle', optional: false, color: null, line: 'abc' },
    ],
    stops: [
      { id: 's0', name: 'Bound', symbol: null, lngLat: [8.1, 47], pointId: 'p1', address: '', contact: '', bookingReference: '', notes: '', arriveAt: null, pauseMinutes: null, optional: false },
      { id: 's1', name: 'Lost', symbol: null, lngLat: [9, 47], pointId: 'gone', address: '', contact: '', bookingReference: '', notes: '', arriveAt: null, pauseMinutes: null, optional: false },
    ],
  };

  it('renews every id and keeps a stop on its point', () => {
    let n = 0;
    const { days, ids } = withNewIds([day], () => `n${n++}`);
    const [renewed] = days;
    expect(new Set([...ids.keys()])).toEqual(new Set(['d', 'r', 'p0', 'p1', 't', 's0', 's1']));
    expect(new Set(ids.values()).size).toBe(7);
    expect(renewed!.id).toBe(ids.get('d'));
    const routed = renewed!.routes[0]!;
    expect(routed.kind === 'routed' && routed.points.map((p) => p.id)).toEqual([ids.get('p0'), ids.get('p1')]);
    expect(renewed!.stops[0]).toMatchObject({ id: ids.get('s0'), pointId: ids.get('p1'), name: 'Bound' });
    expect(renewed!.stops[1]!.pointId).toBeNull();
    expect(day.id).toBe('d');
  });
});
