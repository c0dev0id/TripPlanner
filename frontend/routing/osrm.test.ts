import { describe, expect, it } from 'vitest';
import { fetchLeg, parseRouteResponse, routeUrl } from './osrm';

describe('routeUrl', () => {
  it('asks for one leg as polyline6 with the profile in the path', () => {
    expect(routeUrl('bike', [11.5, 48.1], [11.6, 48.2])).toBe(
      'https://routing.openstreetmap.de/routed-bike/route/v1/driving/11.5,48.1;11.6,48.2?overview=full&geometries=polyline6',
    );
  });
});

describe('parseRouteResponse', () => {
  it('takes geometry, length and time from the first route', () => {
    expect(parseRouteResponse({ code: 'Ok', routes: [{ geometry: 'abc', distance: 1234.6, duration: 99.4 }] })).toEqual({
      geometry: 'abc',
      distanceM: 1235,
      durationS: 99,
    });
  });

  it('throws with the server message, or a plain one', () => {
    expect(() => parseRouteResponse({ code: 'NoRoute', message: 'Impossible route.' })).toThrow('Impossible route.');
    expect(() => parseRouteResponse({ code: 'InvalidQuery' })).toThrow('Routing failed (InvalidQuery).');
    expect(() => parseRouteResponse('nope')).toThrow('Unexpected answer');
  });
});

describe('fetchLeg', () => {
  it('reports a non-JSON answer by its status', async () => {
    const fetchFn = (async () => new Response('gateway timeout', { status: 504 })) as typeof fetch;
    await expect(fetchLeg({ profile: 'car', from: [1, 1], to: [2, 2] }, fetchFn)).rejects.toThrow('status 504');
  });

  it('returns the routed leg', async () => {
    const fetchFn = (async () => Response.json({ code: 'Ok', routes: [{ geometry: 'xyz', distance: 10, duration: 2 }] })) as typeof fetch;
    await expect(fetchLeg({ profile: 'car', from: [1, 1], to: [2, 2] }, fetchFn)).resolves.toEqual({ geometry: 'xyz', distanceM: 10, durationS: 2 });
  });
});
