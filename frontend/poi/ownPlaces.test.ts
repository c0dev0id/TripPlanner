import { describe, expect, it } from 'vitest';
import { ROUTE_PALETTE } from '../model/routeLook';
import { ownKindsOf, type OwnPlace } from './ownPlaces';

const place = (id: string, list: string, dayId: string, kind: string): OwnPlace => ({
  id, name: id, symbol: null, lngLat: [8, 49], address: '', contact: '', website: '', notes: '', tripId: 1, list, dayId, kind,
});

describe('the kinds of own places', () => {
  it('counts the places of each kind, in the order the places come in', () => {
    const kinds = ownKindsOf([place('a', 'Alps', 'd1', 'Passes'), place('b', 'Alps', 'd1', 'Passes'), place('c', 'Alps', 'd2', 'Hotels')]);
    expect(kinds.map(({ name, count }) => [name, count])).toEqual([['Passes', 2], ['Hotels', 1]]);
  });

  it('keeps kinds of the same name in different lists apart', () => {
    const kinds = ownKindsOf([place('a', 'Alps', 'd1', 'Hotels'), place('b', 'Vosges', 'd2', 'Hotels')]);
    expect(kinds.map(({ list, dayId }) => [list, dayId])).toEqual([['Alps', 'd1'], ['Vosges', 'd2']]);
  });

  it('gives each kind the palette\'s next colour, starting over when it runs out', () => {
    const kinds = ownKindsOf(Array.from({ length: ROUTE_PALETTE.length + 1 }, (_, i) => place(`p${i}`, 'Alps', `d${i}`, `Kind ${i}`)));
    expect(kinds[1]!.color).toBe(ROUTE_PALETTE[1]!.color);
    expect(kinds[ROUTE_PALETTE.length]!.color).toBe(ROUTE_PALETTE[0]!.color);
  });
});
