import { describe, expect, it } from 'vitest';
import type { Day, RoutedRoute, Stop } from '../model/trip';
import { tripFromSections } from './tripFromSections';

const route = (id: string, name = ''): RoutedRoute => ({ id, name, kind: 'routed', profile: 'motorcycle', highways: 'allow', optional: false, color: null, legs: {}, points: [{ id: `${id}-a`, lngLat: [8, 47] }, { id: `${id}-b`, lngLat: [8.1, 47.1] }] });
const stop = (id: string, pointId: string | null): Stop => ({ id, name: id, lngLat: [8, 47], pointId, symbol: null, address: '', contact: '', bookingReference: '', website: '', notes: '', arriveAt: null, pauseMinutes: null, optional: false });
const section = (id: string, name: string, routes: RoutedRoute[] = [route(`${id}-r`)], stops: Stop[] = [], notes = ''): Day => ({ id, name, date: null, notes, routes, stops });

/** Ids n1, n2, … in the order asked for. */
const counter = () => {
  let n = 0;
  return () => `n${++n}`;
};

describe('a trip from sections', () => {
  it('makes a day of each section, in their order, under the name given', () => {
    const made = tripFromSections('Vosges', [section('a', 'North'), section('b', 'South')], counter());
    expect(made.name).toBe('Vosges');
    expect(made.days.map((day) => [day.name, day.date, day.routes.length])).toEqual([['North', null, 1], ['South', null, 1]]);
  });

  it('dates the days on from a date in the name, which the trip is named without', () => {
    const made = tripFromSections('2024-06-01 Vosges', [section('a', 'North'), section('b', 'South')], counter());
    expect([made.name, ...made.days.map((day) => day.date)]).toEqual(['Vosges', '2024-06-01', '2024-06-02']);
  });

  it('puts sections with a date in their name on the day of that date, several of a date on one day, dated days first', () => {
    const made = tripFromSections('Alps', [section('a', 'Loop'), section('b', '2024-07-02 Morning'), section('c', '2024-07-01 Way there'), section('d', '2024-07-02 Evening')], counter());
    expect(made.days.map((day) => [day.date, day.name, day.routes.map((r) => r.name)])).toEqual([
      ['2024-07-01', 'Way there', ['']],
      ['2024-07-02', '', ['2024-07-02 Morning', '2024-07-02 Evening']],
      [null, 'Loop', ['']],
    ]);
  });

  it('keeps the names routes have where sections share a day, and joins the sections\' notes', () => {
    const made = tripFromSections('Alps', [section('a', '2024-07-02 Morning', [route('r1', 'Pass')], [], 'early'), section('b', '2024-07-02 Evening', [route('r2')], [], 'late')], counter());
    expect([made.days[0]!.routes.map((r) => r.name), made.days[0]!.notes]).toEqual([['Pass', '2024-07-02 Evening'], 'early\n\nlate']);
  });

  it('gives everything new ids, stops following their points, and says where each section went', () => {
    const made = tripFromSections('Alps', [section('a', 'North', [route('r1')], [stop('s1', 'r1-b'), stop('s2', null)])], counter());
    const day = made.days[0]!;
    const copy = day.routes[0] as RoutedRoute;
    const ids = [day.id, copy.id, ...copy.points.map((p) => p.id), ...day.stops.map((s) => s.id)];
    expect(ids.filter((id) => !/^n\d+$/.test(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(day.stops.map((s) => s.pointId)).toEqual([copy.points[1]!.id, null]);
    expect([...made.dayOf]).toEqual([['a', day.id]]);
  });
});
