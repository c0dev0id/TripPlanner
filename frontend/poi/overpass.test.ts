import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LngLat } from '../model/trip';
import { POI_CATEGORIES } from './categories';
import { findPois, parsePois, poiQuery } from './overpass';

const category = (id: string) => POI_CATEGORIES.find((c) => c.id === id)!;

describe('poiQuery', () => {
  it('asks for each category within its distance of a spot', () => {
    const query = poiQuery(
      [
        { category: category('fuel'), metres: 5000 },
        { category: category('hotel'), metres: 20000 },
      ],
      { spot: [8.123456789, 49.5] },
    );
    expect(query).toBe(
      '[out:json][timeout:60][bbox:49.32014,7.84548,49.67986,8.40143];(nwr["amenity"="fuel"](around:5000,49.50000,8.12346););out center 500;(nwr["tourism"~"^(hotel|guest_house|motel)$"](around:20000,49.50000,8.12346););out center 500;',
    );
  });

  it('leaves out parking that is not open to the public', () => {
    expect(poiQuery([{ category: category('parking'), metres: 200 }], { spot: [8, 49] })).toContain('nwr["amenity"~"^(parking|motorcycle_parking)$"]["access"!~"^(private|no)$"](around:200,');
  });

  it('asks along each line, without the points a quarter of the distance does not need', () => {
    // A point 0.0005° of latitude, some 55 m, off the straight line between its neighbours.
    const bent: LngLat[] = [
      [8, 49],
      [8.01, 49.0005],
      [8.02, 49],
    ];
    const other: LngLat[] = [
      [9, 50],
      [9.1, 50],
    ];
    const along = (metres: number) => poiQuery([{ category: category('fuel'), metres }], { lines: [bent, other] });
    expect(along(200)).toContain('(nwr["amenity"="fuel"](around:200,49.00000,8.00000,49.00050,8.01000,49.00000,8.02000);nwr["amenity"="fuel"](around:200,50.00000,9.00000,50.00000,9.10000););out center 500;');
    expect(along(2000)).toContain('(around:2000,49.00000,8.00000,49.00000,8.02000);');
  });
});

describe('parsePois', () => {
  it('reads nodes at their position and ways at their centre, each in its category', () => {
    const pois = parsePois({
      elements: [
        { type: 'node', id: 1, lat: 49.1, lon: 8.1, tags: { amenity: 'fuel', brand: 'Aral' } },
        { type: 'way', id: 2, center: { lat: 49.2, lon: 8.2 }, tags: { tourism: 'guest_house', name: 'Zur Post' } },
        { type: 'way', id: 3, tags: { amenity: 'cafe' } },
        { type: 'node', id: 4, lat: 49.3, lon: 8.3, tags: { amenity: 'bench' } },
      ],
    });
    expect(pois).toEqual([
      { id: 'node/1', category: category('fuel'), lngLat: [8.1, 49.1], tags: { amenity: 'fuel', brand: 'Aral' } },
      { id: 'way/2', category: category('hotel'), lngLat: [8.2, 49.2], tags: { tourism: 'guest_house', name: 'Zur Post' } },
    ]);
  });

  it('throws when the server gave up or sent something else', () => {
    expect(() => parsePois({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 61 seconds.' })).toThrow();
    expect(() => parsePois('<html>')).toThrow();
  });
});

describe('findPois', () => {
  const fuel = [{ category: category('fuel'), metres: 200 }];
  const node = (id: number) => ({ type: 'node', id, lat: 49, lon: 8, tags: { amenity: 'fuel' } });
  const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  // One degree of longitude on the equator is some 111 km: three stretches of at most 50 km.
  const line: LngLat[] = [0, 0.4, 0.8, 1].map((lng) => [lng, 0]);
  const fetched = vi.fn<typeof fetch>();
  /** What `progress` heard: the ids found so far, and how many queries of how many were done. */
  let heard: [string[], number, number][];
  const find = (area: Parameters<typeof findPois>[1], signal = new AbortController().signal) => findPois(fuel, area, signal, (found, done, total) => heard.push([found.pois.map((p) => p.id), done, total]));

  beforeEach(() => {
    heard = [];
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetched);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetched.mockReset();
  });

  it('asks along a line stretch by stretch, a second apart, and hands over what it found so far, each place once', async () => {
    fetched
      .mockResolvedValueOnce(answer({ elements: [node(1), node(2)] }))
      .mockResolvedValueOnce(answer({ elements: [node(2), node(3)] }))
      .mockResolvedValueOnce(answer({ elements: [] }));
    const search = find({ lines: [line] });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetched).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1001);
    await search;
    expect(fetched).toHaveBeenCalledTimes(3);
    expect(heard).toEqual([
      [[], 0, 3],
      [['node/1', 'node/2'], 1, 3],
      [['node/1', 'node/2', 'node/3'], 2, 3],
      [['node/1', 'node/2', 'node/3'], 3, 3],
    ]);
  });

  it('sends a query the server ran out of time on or was too busy for again after five seconds', async () => {
    fetched
      .mockResolvedValueOnce(answer({ elements: [], remark: 'runtime error: Query timed out' }))
      .mockResolvedValueOnce(answer({}, 502))
      .mockResolvedValueOnce(answer({ elements: [node(1)] }));
    const search = find({ spot: [8, 49] });
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetched).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5001);
    await search;
    expect(fetched).toHaveBeenCalledTimes(3);
    expect(heard.at(-1)).toEqual([['node/1'], 1, 1]);
  });

  it('gives up after three more tries, with what the stretches before found handed over, and at once on any other failure', async () => {
    fetched.mockResolvedValueOnce(answer({ elements: [node(1)] })).mockImplementation(async () => answer({}, 504));
    const busy = expect(find({ lines: [line] })).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(20_000);
    await busy;
    expect(fetched).toHaveBeenCalledTimes(5);
    expect(heard.at(-1)).toEqual([['node/1'], 1, 3]);
    fetched.mockReset().mockResolvedValueOnce(answer({}, 400));
    await expect(find({ spot: [8, 49] })).rejects.toThrow();
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it('counts a server that does not answer within 75 seconds as busy, and asks again', async () => {
    const never = (_: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    fetched.mockImplementationOnce(never).mockResolvedValueOnce(answer({ elements: [node(1)] }));
    const search = find({ spot: [8, 49] });
    await vi.advanceTimersByTimeAsync(74_999);
    expect(fetched).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_001);
    await search;
    expect(fetched).toHaveBeenCalledTimes(2);
    expect(heard.at(-1)).toEqual([['node/1'], 1, 1]);
  });

  it('stops waiting when the search is aborted', async () => {
    fetched.mockResolvedValue(answer({ elements: [] }));
    const stop = new AbortController();
    const search = expect(find({ lines: [line] }, stop.signal)).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(500);
    stop.abort();
    await search;
    expect(fetched).toHaveBeenCalledTimes(1);
  });
});
