import { describe, expect, it } from 'vitest';
import { placeCallouts, type Callout, type Named } from './callouts';

const place = (id: string, x: number, y: number): Named => ({ id, x, y, width: 100, height: 26 });
const box = { width: 800, height: 500 };
const rect = (c: Callout) => ({ left: c.left, top: c.top, right: c.left + c.width, bottom: c.top + c.height });
const meet = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe('placeCallouts', () => {
  it('sets a name up and to the right of its place, with a line to it', () => {
    const [name] = placeCallouts([place('a', 400, 300)], box, 10);
    expect(name!.left).toBeGreaterThan(400);
    expect(name!.top + name!.height).toBeLessThan(300);
    expect([name!.line.x2, name!.line.y2]).toEqual([name!.left, name!.top + name!.height]);
  });

  it('keeps names off each other, off the places and within the box', () => {
    const places = [place('a', 400, 300), place('b', 410, 304), place('c', 430, 296), place('d', 780, 40), place('e', 20, 480)];
    const names = placeCallouts(places, box, 10);
    expect(names.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    for (const [i, a] of names.entries()) {
      expect(a.left >= 0 && a.top >= 0 && a.left + a.width <= box.width && a.top + a.height <= box.height).toBe(true);
      for (const b of names.slice(i + 1)) expect(meet(rect(a), rect(b))).toBe(false);
      for (const p of places) expect(meet(rect(a), { left: p.x - 14, right: p.x + 14, top: p.y - 38, bottom: p.y + 2 })).toBe(false);
    }
  });

  it('leaves out what is outside the box, what has no room and what is beyond the most', () => {
    expect(placeCallouts([place('out', -50, 100), place('in', 400, 300)], box, 10).map((n) => n.id)).toEqual(['in']);
    expect(placeCallouts([place('a', 100, 100), place('b', 400, 300), place('c', 600, 400)], box, 2).map((n) => n.id)).toEqual(['a', 'b']);
    expect(placeCallouts([place('a', 400, 300)], box, 10, [{ left: 380, top: 200, right: 800, bottom: 290 }])[0]!.left).toBeLessThan(400);
    const crowd = Array.from({ length: 40 }, (_, i) => place(`p${i}`, 60, 60));
    expect(placeCallouts(crowd, { width: 120, height: 120 }, 40).length).toBeLessThan(40);
  });
});
