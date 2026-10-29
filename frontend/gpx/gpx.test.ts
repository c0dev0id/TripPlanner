import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { parseGpx, type GpxContent } from './gpx';
import { gpxToDayParts } from './import';

const GPX_11 = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="48.1" lon="11.5"><name>Café</name><desc>Good cake</desc><type>cafe</type></wpt>
  <wpt lat="48.2" lon="11.6"><cmt>No name</cmt><type>castle</type></wpt>
  <wpt lat="95" lon="11.6"><name>Broken</name></wpt>
  <rte><name>Planned</name><rtept lat="48.1" lon="11.5"/><rtept lat="48.3" lon="11.7"/></rte>
  <trk>
    <trkseg><trkpt lat="47.0" lon="12.0"/><trkpt lat="47.1" lon="12.1"/></trkseg>
    <trkseg><trkpt lat="47.2" lon="12.2"/></trkseg>
  </trk>
</gpx>`;

const GARMIN = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3">
  <rte>
    <name>Pass road</name>
    <rtept lat="48" lon="11">
      <extensions>
        <gpxx:RoutePointExtension>
          <gpxx:rpt lat="48.1" lon="11.1"><gpxx:Subclass>000000000000FFFFFFFFFFFFFFFFFFFFFFFF</gpxx:Subclass></gpxx:rpt>
          <gpxx:rpt lat="48.2" lon="11.1"/>
        </gpxx:RoutePointExtension>
      </extensions>
    </rtept>
    <rtept lat="48.3" lon="11.2"/>
  </rte>
  <rte><rtept lat="1" lon="1"/><rtept lat="2" lon="2"/></rte>
</gpx>`;

describe('parseGpx', () => {
  it('reads waypoints, routes and tracks, leaving out positions off the world', () => {
    const gpx = parseGpx(GPX_11);
    expect(gpx.waypoints).toEqual([
      { lngLat: [11.5, 48.1], name: 'Café', description: 'Good cake', type: 'cafe' },
      { lngLat: [11.6, 48.2], name: undefined, description: 'No name', type: 'castle' },
    ]);
    expect(gpx.routes).toEqual([{ name: 'Planned', points: [[11.5, 48.1], [11.7, 48.3]], ways: [[], []] }]);
    expect(gpx.tracks).toEqual([{ name: undefined, segments: [[[12, 47], [12.1, 47.1]], [[12.2, 47.2]]] }]);
  });

  it("reads the way Garmin calculated for a route point", () => {
    expect(parseGpx(GARMIN).routes[0]!.ways).toEqual([[[11.1, 48.1], [11.1, 48.2]], []]);
  });

  it('refuses what is no GPX', () => {
    expect(() => parseGpx('<kml/>')).toThrow('This is not a GPX file.');
    expect(() => parseGpx('nonsense')).toThrow('This is not a GPX file.');
  });
});

describe('gpxToDayParts', () => {
  let n = 0;
  const options = { fileName: 'tour', profile: 'bicycle' as const, newId: () => `id${n++}` };

  it('routes GPX routes, joins track points by straight lines, makes stops of waypoints', () => {
    const parts = gpxToDayParts(parseGpx(GPX_11), options);
    expect(parts.routes.map((r) => [r.name, r.kind, r.profile, r.points.map((p) => p.straight === true)])).toEqual([
      ['Planned', 'routed', 'bicycle', [false, false]],
      ['tour 2', 'track', 'bicycle', [false, true, true]],
    ]);
    // The café stands on the route's first point and is bound to it; the castle is no kind of ours.
    expect(parts.stops.map((s) => [s.name, s.kind, s.notes, s.pointId])).toEqual([
      ['Café', 'cafe', 'Good cake', parts.routes[0]!.points[0]!.id],
      ['Waypoint 2', 'other', 'No name', null],
    ]);
  });

  it('takes a start, an end, a meeting point and an info point by their type, as the export writes them', () => {
    const waypoint = (type: string) => `<wpt lat="48" lon="11"><type>${type}</type></wpt>`;
    const gpx = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${waypoint('start')}${waypoint('meeting')}${waypoint('info')}${waypoint('end')}</gpx>`;
    expect(gpxToDayParts(parseGpx(gpx), options).stops.map((s) => s.kind)).toEqual(['start', 'meeting', 'info', 'end']);
  });

  it("takes Garmin's symbols for information, a restaurant and a gas station as those kinds, any other as a plain stop", () => {
    const waypoint = (symbol: string, type = 'user') => `<wpt lat="48" lon="11"><sym>${symbol}</sym><type>${type}</type></wpt>`;
    const symbols = ['Information', 'Restaurant', 'Gas Station', 'Pizza', 'Lodging', 'information', 'constructor'].map((s) => waypoint(s)).join('');
    const gpx = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${symbols}${waypoint('Restaurant', 'hotel')}</gpx>`;
    expect(gpxToDayParts(parseGpx(gpx), options).stops.map((s) => s.kind)).toEqual(['info', 'restaurant', 'fuel', 'other', 'other', 'other', 'other', 'hotel']);
  });

  it("keeps a Garmin route's points, each leg along the way Garmin calculated, its time left to the pace", () => {
    const [garmin, plain] = gpxToDayParts(parseGpx(GARMIN), options).routes;
    expect(garmin!.name).toBe('Pass road');
    expect(garmin!.points.map((p) => p.lngLat)).toEqual([
      [11, 48],
      [11.2, 48.3],
    ]);
    const [key, leg] = Object.entries(garmin!.legs)[0]!;
    expect(key).toBe('bicycle:allow/11,48;11.2,48.3');
    // Three segments of 13, 11 and 13 km along the way, not the 36 km straight from end to end.
    expect(leg.distanceM).toBeGreaterThan(37_000);
    expect(leg.distanceM).toBeLessThan(38_500);
    expect(leg.durationS).toBeNull();
    expect(plain!.legs).toEqual({});
  });

  it('joins the way of a Garmin route point that repeats the one before to the leg it lies on', () => {
    const gpx: GpxContent = { waypoints: [], tracks: [], routes: [{ points: [[11, 48], [11, 48], [11.2, 48.3]], ways: [[], [[11.1, 48.1]], []] }] };
    const [route] = gpxToDayParts(gpx, options).routes;
    expect(route!.points.map((p) => p.lngLat)).toEqual([
      [11, 48],
      [11.2, 48.3],
    ]);
    expect(Object.keys(route!.legs)).toEqual(['bicycle:allow/11,48;11.2,48.3']);
  });

  it('names a single unnamed line after the file, drops repeated points, keeps every point of a long track', () => {
    const zigzag = (count: number): LngLat[] => Array.from({ length: count }, (_, i) => [i * 0.0001, (i % 2) * 0.0002]);
    const parts = gpxToDayParts({ waypoints: [], routes: [], tracks: [{ segments: [[[1, 1], [1.0000001, 1]], [[2, 2]]] }] }, options);
    expect(parts.routes.map((r) => [r.name, r.points.map((p) => p.lngLat)])).toEqual([['tour', [[1, 1], [2, 2]]]]);
    const long = gpxToDayParts({ waypoints: [], routes: [], tracks: [{ segments: [zigzag(3000)] }] }, options);
    expect(long.routes[0]!.points).toHaveLength(3000);
    expect(gpxToDayParts({ waypoints: [], routes: [], tracks: [] }, options)).toEqual({ routes: [], stops: [] });
  });
});
