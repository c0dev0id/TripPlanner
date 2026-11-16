import { describe, expect, it, vi } from 'vitest';
import type { LngLat } from '../model/trip';
import { autoname, type Named } from './autoname';

const PLACES: Record<string, string> = { '8,49': 'Hockenheim', '9,49': 'Walldorf' };
vi.mock('./nominatim', () => ({ placeNameAt: async (at: LngLat) => PLACES[at.join(',')] }));

/** Something to name that runs along the positions and notes the names it is given. */
const thing = (name: string, line: LngLat[], given: string[] = []): Named & { given: string[] } => ({ name, line: () => line, rename: (to) => given.push(to), given });

describe('autoname', () => {
  it('names a thing after the places it begins and ends in and says how far it is', async () => {
    const ride = thing('Track 1', [[8, 49], [8.5, 49], [9, 49]]);
    const said: string[] = [];
    expect(await autoname([ride], 'route', (text) => said.push(text))).toEqual({ text: '1 route renamed.', errors: [] });
    expect(ride.given).toEqual(['Hockenheim - Walldorf']);
    expect(said).toEqual(['Renaming 1 of 1: Track 1']);
  });

  it('leaves what bears the name already and counts it', async () => {
    const named = thing('Hockenheim - Walldorf', [[8, 49], [9, 49]]);
    expect((await autoname([named], 'ride', () => {})).text).toBe('1 ride renamed.');
    expect(named.given).toEqual([]);
  });

  it('says which could not be named and goes on past them', async () => {
    const nowhere = thing('Lost', [[1, 1], [9, 49]]);
    const empty = thing('Empty', []);
    const fine = thing('Fine', [[9, 49], [8, 49]]);
    expect(await autoname([nowhere, empty, fine], 'route', () => {})).toEqual({
      text: '1 route renamed.',
      errors: ['Lost: No place name found for its start or end.', 'Empty: No place name found for its start or end.'],
    });
    expect(fine.given).toEqual(['Walldorf - Hockenheim']);
  });
});
