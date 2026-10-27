import { describe, expect, it } from 'vitest';
import type { Route, RoutedLeg } from '../model/trip';
import { addLeg, appendPoint, changeProfile, insertPoint, movePoint, removePoint, setStraight } from './routeEdit';

const routed = (geometry: string): RoutedLeg => ({ geometry, distanceM: 1, durationS: 1 });

const base: Route = {
  id: 'r',
  name: '',
  kind: 'routed',
  profile: 'car',
  optional: false,
  points: [
    { id: 'a', lngLat: [1, 1] },
    { id: 'b', lngLat: [2, 2] },
    { id: 'c', lngLat: [3, 3] },
  ],
  legs: { 'car/1,1;2,2': routed('ab'), 'car/2,2;3,3': routed('bc') },
};

describe('route edits', () => {
  it('appends a point and keeps every leg', () => {
    const r = appendPoint(base, { id: 'd', lngLat: [4, 4] });
    expect(r.points.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(r.legs).toEqual(base.legs);
  });

  it('inserts a point and keeps only the legs it does not split', () => {
    const r = insertPoint(base, 1, { id: 'x', lngLat: [1.5, 1.5] });
    expect(r.points.map((p) => p.id)).toEqual(['a', 'x', 'b', 'c']);
    expect(r.legs).toEqual({ 'car/2,2;3,3': routed('bc') });
  });

  it('splits a straight leg into two straight legs', () => {
    const straight = { ...base, points: base.points.map((p) => (p.id === 'b' ? { ...p, straight: true } : p)) };
    const r = insertPoint(straight, 1, { id: 'x', lngLat: [1.5, 1.5] });
    expect(r.points.map((p) => [p.id, p.straight === true])).toEqual([
      ['a', false],
      ['x', true],
      ['b', true],
      ['c', false],
    ]);
  });

  it('drops both legs next to a moved point', () => {
    const r = movePoint(base, 'b', [2.5, 2.5]);
    expect(r.points[1]!.lngLat).toEqual([2.5, 2.5]);
    expect(r.legs).toEqual({});
  });

  it('drops the legs of a removed point', () => {
    const r = removePoint(base, 'b');
    expect(r.points.map((p) => p.id)).toEqual(['a', 'c']);
    expect(r.legs).toEqual({});
  });

  it('makes a leg straight and routed again, dropping its geometry either way', () => {
    const straight = setStraight(base, 'b', true);
    expect(straight.points[1]).toEqual({ id: 'b', lngLat: [2, 2], straight: true });
    expect(straight.legs).toEqual({ 'car/2,2;3,3': routed('bc') });
    const back = setStraight(straight, 'b', false);
    expect(back.points[1]).toEqual({ id: 'b', lngLat: [2, 2] });
    expect(back.legs).toEqual({ 'car/2,2;3,3': routed('bc') });
  });

  it('drops every leg when the profile changes', () => {
    const r = changeProfile(base, 'bike');
    expect(r.profile).toBe('bike');
    expect(r.legs).toEqual({});
  });

  it('stores needed legs and ignores outdated results', () => {
    const r = movePoint(base, 'c', [9, 9]);
    expect(addLeg(r, 'car/2,2;9,9', routed('new')).legs).toEqual({ 'car/1,1;2,2': routed('ab'), 'car/2,2;9,9': routed('new') });
    expect(addLeg(r, 'car/2,2;3,3', routed('stale'))).toBe(r);
    const straight = setStraight(base, 'b', true);
    expect(addLeg(straight, 'car/1,1;2,2', routed('ab'))).toBe(straight);
  });

  it('does not modify its input', () => {
    movePoint(base, 'b', [5, 5]);
    expect(base.points[1]!.lngLat).toEqual([2, 2]);
    expect(Object.keys(base.legs)).toHaveLength(2);
  });
});
