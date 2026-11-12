import { describe, expect, it } from 'vitest';
import { daysToSend } from './delta';
import type { Day, Route, Trip } from './trip';

const route = (id: string): Route => ({ id, name: '', kind: 'track', profile: 'motorcycle', optional: false, color: null, line: '' });
const day = (id: string, routes: Route[]): Day => ({ id, name: '', date: null, notes: '', routes, stops: [] });
const trip = (days: Day[]): Trip => ({ id: 1, kind: 'trip', name: 'Alps', description: '', state: 'planned', version: 1, days });

describe('daysToSend', () => {
  const saved = trip([day('d1', [route('r1'), route('r2')]), day('d2', [route('r3')])]);

  it('sends every day whole without a saved trip', () => {
    expect(daysToSend(saved.days, undefined)).toEqual(saved.days);
  });

  it('sends a day that is the one saved as its id alone', () => {
    expect(daysToSend(saved.days, saved)).toEqual([
      { id: 'd1', unchanged: true },
      { id: 'd2', unchanged: true },
    ]);
  });

  it('sends a changed day whole, its untouched routes as their ids', () => {
    const [first, second] = saved.days as [Day, Day];
    const edited = { ...first, name: 'South', routes: [first.routes[0]!, { ...first.routes[1]!, name: 'Loop' }] };
    expect(daysToSend([edited, second], saved)).toEqual([
      { ...edited, routes: [{ id: 'r1', unchanged: true }, edited.routes[1]] },
      { id: 'd2', unchanged: true },
    ]);
  });

  it('sends a route moved to another day as its id there', () => {
    const [first, second] = saved.days as [Day, Day];
    const moved = first.routes[1]!;
    const sent = daysToSend([{ ...first, routes: [first.routes[0]!] }, { ...second, routes: [moved, ...second.routes] }], saved);
    expect(sent.map((d) => ('routes' in d ? d.routes : d))).toEqual([
      [{ id: 'r1', unchanged: true }],
      [
        { id: 'r2', unchanged: true },
        { id: 'r3', unchanged: true },
      ],
    ]);
  });

  it('sends a part of equal content that is another object whole', () => {
    const copy = { ...saved.days[1]!, routes: [{ ...saved.days[1]!.routes[0]! }] };
    expect(daysToSend([saved.days[0]!, copy], saved)).toEqual([{ id: 'd1', unchanged: true }, copy]);
  });

  it('takes a changed day as `sent` gives it, with the routes of the day itself', () => {
    const edited = { ...saved.days[0]!, name: 'South' };
    const sent = daysToSend([edited], saved, (d, index) => ({ ...d, notes: `sent ${index}` }));
    expect(sent).toEqual([{ ...edited, notes: 'sent 0', routes: [{ id: 'r1', unchanged: true }, { id: 'r2', unchanged: true }] }]);
  });
});
