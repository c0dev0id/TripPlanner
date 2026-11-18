import { describe, expect, it } from 'vitest';
import { bestBearing, cardDays, cardMark, dayEnds, destinationsOf } from './shareCard';
import type { Day, LngLat, Route, Trip } from './trip';

const track = (id: string, line: LngLat[]): Route => ({ id, name: '', kind: 'straight', profile: 'motorcycle', highways: 'allow', optional: false, color: null, points: line.map((lngLat, i) => ({ id: `${id}${i}`, lngLat, kind: 'via' })), legs: {} }) as unknown as Route;
const day = (id: string, routes: Route[]): Day => ({ id, name: '', date: null, notes: '', routes, stops: [] });
const trip = (days: Day[]): Trip => ({ id: 1, kind: 'trip', name: 'Vosges', description: '', state: 'planned', version: 1, days });

const HOME: LngLat = [8.5, 49.3];
const AWAY: LngLat = [6.9, 48.0];
const three = trip([day('d1', [track('out', [HOME, AWAY])]), day('d2', [track('loop', [AWAY, [7.1, 48.1], AWAY]), track('hidden', [AWAY, [9, 50]])]), day('d3', [track('back', [AWAY, HOME])]), day('d4', [])]);

describe('the card of a shared trip', () => {
  it('has the lines the page shows, by day', () => {
    const days = cardDays(three, ['hidden']);
    expect(days.map((lines) => lines.length)).toEqual([1, 1, 1]);
    expect(dayEnds(days)).toEqual([HOME, AWAY, AWAY, AWAY, AWAY, HOME]);
  });

  it('names where the days begin and end once while the trip stays there', async () => {
    const asked: LngLat[] = [];
    const nameAt = async (at: LngLat) => {
      asked.push(at);
      return at[0] > 8 ? 'Hockenheim' : 'La Bresse';
    };
    expect(await destinationsOf(dayEnds(cardDays(three, ['hidden'])), nameAt)).toEqual(['Hockenheim', 'La Bresse', 'Hockenheim']);
    expect(asked).toEqual([HOME, AWAY]);
    // A place without a name is left out, and what it stands between is not joined.
    expect(await destinationsOf([HOME, [0, 0], HOME], async (at) => (at[0] === 0 ? undefined : 'Hockenheim'))).toEqual(['Hockenheim']);
  });

  it('turns the map so that the lines lie across the picture', () => {
    const aspect = 1200 / 630;
    // A loop wider than high lies across already; one higher than wide is turned towards lying across, as far as its corners gain by it.
    const loop = (width: number, height: number): LngLat[] => [[8, 48], [8 + width, 48], [8 + width, 48 + height], [8, 48 + height], [8, 48]];
    expect(bestBearing([loop(2, 0.5)], aspect, 45)).toBe(0);
    expect(Math.abs(bestBearing([loop(0.4, 2)], aspect, 45))).toBeGreaterThan(45);
  });

  it('marks what the card shows', () => {
    const days = cardDays(three, []);
    expect(cardMark('Vosges', days)).toMatch(/^[0-9a-z]{1,7}$/);
    expect(cardMark('Vosges', days)).toBe(cardMark('Vosges', cardDays(three, [])));
    expect(cardMark('Vogesen', days)).not.toBe(cardMark('Vosges', days));
    expect(cardMark('Vosges', cardDays(three, ['hidden']))).not.toBe(cardMark('Vosges', days));
  });
});
