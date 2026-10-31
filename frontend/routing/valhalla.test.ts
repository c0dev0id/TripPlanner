import { describe, expect, it } from 'vitest';
import { fetchLeg, fetchSurfaces, parseRouteResponse, routeRequest, type LegRequest } from './valhalla';

describe('routeRequest', () => {
  it('asks for one leg with the motorcycle costing and the motorway dial for the road profile', () => {
    expect(routeRequest({ profile: 'motorcycle', highways: 'avoid', from: [11.5, 48.1], to: [11.6, 48.2] })).toEqual({
      locations: [
        { lon: 11.5, lat: 48.1 },
        { lon: 11.6, lat: 48.2 },
      ],
      costing: 'motorcycle',
      costing_options: { motorcycle: { use_highways: 0 } },
      units: 'kilometers',
    });
  });

  it('asks for the bicycle and pedestrian costings without the dial', () => {
    expect(routeRequest({ profile: 'bicycle', highways: 'prefer', from: [1, 1], to: [2, 2] })).toMatchObject({ costing: 'bicycle' });
    expect(routeRequest({ profile: 'pedestrian', highways: 'allow', from: [1, 1], to: [2, 2] }).costing_options).toBeUndefined();
  });
});

describe('parseRouteResponse', () => {
  it('takes the shape, the length in metres and the time from the trip', () => {
    expect(parseRouteResponse({ trip: { summary: { length: 1.2346, time: 99.4 }, legs: [{ shape: 'abc' }] } })).toEqual({
      geometry: 'abc',
      distanceM: 1235,
      durationS: 99,
    });
  });

  it('throws with the server message, or a plain one', () => {
    expect(() => parseRouteResponse({ error_code: 442, error: 'No path could be found for input' })).toThrow('No path could be found for input');
    expect(() => parseRouteResponse({ trip: {} })).toThrow('Routing failed (no route).');
    expect(() => parseRouteResponse('nope')).toThrow('Unexpected answer');
  });
});

describe('fetchLeg', () => {
  const leg: LegRequest = { profile: 'motorcycle', highways: 'allow', from: [1, 1], to: [2, 2] };
  const now = async () => {};

  it('reports a non-JSON answer by its status', async () => {
    const fetchFn = (async () => new Response('gateway timeout', { status: 504 })) as typeof fetch;
    await expect(fetchLeg(leg, fetchFn, now)).rejects.toThrow('status 504');
  });

  it('posts the request as JSON and returns the routed leg', async () => {
    let sent: RequestInit | undefined;
    const fetchFn = (async (_url: unknown, init?: RequestInit) => {
      sent = init;
      return Response.json({ trip: { summary: { length: 0.01, time: 2 }, legs: [{ shape: 'xyz' }] } });
    }) as typeof fetch;
    await expect(fetchLeg(leg, fetchFn, now)).resolves.toEqual({ geometry: 'xyz', distanceM: 10, durationS: 2 });
    expect(sent?.method).toBe('POST');
    expect(JSON.parse(sent?.body as string)).toMatchObject({ costing: 'motorcycle', costing_options: { motorcycle: { use_highways: 0.5 } } });
  });
});

describe('fetchSurfaces', () => {
  it('asks in pieces and reads each point\'s road surface, none where a point or a piece matched no road', async () => {
    const bodies: { shape: unknown[] }[] = [];
    const answers = [
      { edges: [{ surface: 'paved_smooth' }, { surface: 'gravel' }], matched_points: [{ edge_index: 0, type: 'matched' }, { edge_index: 1, type: 'interpolated' }, { edge_index: 4294967295, type: 'unmatched' }] },
      { error_code: 444, error: 'Map Match algorithm failed' },
    ];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(answers[bodies.length - 1]));
    }) as unknown as typeof fetch;
    const points = Array.from({ length: 1003 }, (_, i): [number, number] => [11 + i / 1e4, 47]);
    const surfaces = await fetchSurfaces(points, fetchFn, async () => {});
    expect(bodies.map((b) => b.shape.length)).toEqual([1000, 3]);
    expect(surfaces.slice(0, 3)).toEqual(['paved_smooth', 'gravel', null]);
    expect(surfaces.length).toBe(1003);
    expect(surfaces.slice(1000)).toEqual([null, null, null]);
  });

  it('fails with the server\'s message where no piece matched', async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ error_code: 444, error: 'Map Match algorithm failed' }))) as unknown as typeof fetch;
    await expect(fetchSurfaces([[11, 47], [11.001, 47]], fetchFn, async () => {})).rejects.toThrow('Map Match algorithm failed');
  });
});
