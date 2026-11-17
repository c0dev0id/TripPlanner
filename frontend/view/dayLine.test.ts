import { describe, expect, it } from 'vitest';
import type { Day } from '../model/trip';
import { dayLinePath } from './dayLine';

const track = (id: string, line: string): Day['routes'][number] => ({ id, name: '', kind: 'track', profile: 'motorcycle', optional: false, color: null, line });
const day = (routes: Day['routes']): Day => ({ id: 'd', name: '', date: null, notes: '', routes, stops: [] });

describe('a day\'s small line', () => {
  it('fits the day\'s routes into the box, north up', () => {
    // From 0,0 north to 0,1, then east to 1,1, as a polyline of six decimals.
    const path = dayLinePath(day([track('a', '??_c`|@??_c`|@')]), 100, 100);
    expect(path).toBe('M0.0 100.0L0.0 0.0L100.0 0.0');
  });

  it('is empty for a day that goes nowhere', () => {
    expect(dayLinePath(day([]), 100, 100)).toBe('');
  });
});
