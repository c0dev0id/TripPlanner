import { describe, expect, it } from 'vitest';
import type { Entry } from './journal';
import { blocksOf, byTimeTaken, chaptersOf, losesParts } from './journalDocument';
import type { Day, Trip } from './trip';

const entry = (id: number, on: Partial<Entry> = {}): Entry => ({
  id,
  tripId: 1,
  dayId: null,
  stopId: null,
  routeId: null,
  text: '',
  file: null,
  takenAt: null,
  lngLat: null,
  takenLngLat: null,
  createdAt: '2026-11-17T10:00:00Z',
  kind: 'journal',
  url: null,
  position: id,
  ...on,
});
const photo = { name: 'a.jpg', mediaType: 'image/jpeg', size: 10, image: true, width: 4, height: 3 };
const pdf = { name: 'a.pdf', mediaType: 'application/pdf', size: 10, image: false, width: null, height: null };
const day = (id: string, routeId: string, stopId: string): Day => ({
  id,
  name: '',
  date: null,
  notes: '',
  routes: [{ id: routeId, name: '', kind: 'routed', profile: 'motorcycle', highways: 'allow', optional: false, color: null, points: [], legs: {} }],
  stops: [{ id: stopId, name: '', symbol: null, lngLat: [0, 0], pointId: null, address: '', contact: '', bookingReference: '', website: '', notes: '', arriveAt: null, pauseMinutes: null, optional: false }],
});
const trip = (days: Day[]): Trip => ({ id: 1, kind: 'trip', name: 'Alps', description: '', state: 'planned', version: 1, days });

describe('the journal as a document', () => {
  it('reads the trip\'s own entries first, then a chapter for every day, each by position', () => {
    const entries = [
      entry(1, { dayId: 'd2', position: 2 }),
      entry(2, { routeId: 'r1', position: 5 }),
      entry(3, { position: 1 }),
      entry(4, { stopId: 's2', position: 0 }),
      entry(5, { dayId: 'd1', position: 5 }),
      entry(6, { stopId: 'gone', position: 0 }),
    ];
    const chapters = chaptersOf(trip([day('d1', 'r1', 's1'), day('d2', 'r2', 's2'), day('d3', 'r3', 's3')]), entries);
    expect(chapters.map((c) => [c.day?.id, c.entries.map((e) => e.id)])).toEqual([
      [undefined, [6, 3]],
      ['d1', [2, 5]],
      ['d2', [4, 1]],
      ['d3', []],
    ]);
  });

  it('makes one gallery of photos that follow each other', () => {
    const blocks = blocksOf([entry(1, { text: 'Off' }), entry(2, { file: photo }), entry(3, { file: photo, text: 'The pass' }), entry(4, { file: pdf }), entry(5, { file: photo }), entry(6, { text: 'Home' })]);
    expect(blocks.map((b) => (b.kind === 'gallery' ? b.entries.map((e) => e.id) : `${b.kind} ${b.entry.id}`))).toEqual(['text 1', [2, 3], 'file 4', [5], 'text 6']);
  });

  it('orders what says when it was taken by that and leaves the rest where it stood', () => {
    const entries = [entry(1, { takenAt: '2027-06-12T15:00:00' }), entry(2, { text: 'Lunch' }), entry(3, { takenAt: '2027-06-12T09:00:00' }), entry(4), entry(5, { takenAt: '2027-06-12T12:00:00' })];
    expect(byTimeTaken(entries).map((e) => e.id)).toEqual([3, 2, 5, 4, 1]);
  });

  it('says when a trip no longer holds a part it held', () => {
    const before = trip([day('d1', 'r1', 's1'), day('d2', 'r2', 's2')]);
    expect(losesParts(before, before)).toBe(false);
    expect(losesParts(before, trip([...before.days, day('d3', 'r3', 's3')]))).toBe(false);
    expect(losesParts(before, trip([before.days[0]!]))).toBe(true);
    expect(losesParts(before, trip([before.days[0]!, { ...before.days[1]!, stops: [] }]))).toBe(true);
    expect(losesParts(before, trip([{ ...before.days[0]!, routes: [...before.days[0]!.routes, ...before.days[1]!.routes] }, { ...before.days[1]!, routes: [] }]))).toBe(false);
  });
});
