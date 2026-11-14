import { describe, expect, it } from 'vitest';
import type { LngLat } from '../model/trip';
import { parseGpx, type GpxContent } from './gpx';
import { pointCount } from '../routing/legs';
import { decodePolyline } from '../routing/polyline';
import { routedOf } from '../routing/testing';
import { gpxToDayParts, ownWebsites, readDayParts, readRouteFile, waypointStops } from './import';

const GPX_11 = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="48.1" lon="11.5"><name>Café</name><desc>Good cake</desc><sym>Navaid, Black</sym><type>user</type></wpt>
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
      { lngLat: [11.5, 48.1], name: 'Café', description: 'Good cake', symbol: 'Navaid, Black', type: 'user', links: [] },
      { lngLat: [11.6, 48.2], name: undefined, description: 'No name', type: 'castle', links: [] },
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

  it('routes GPX routes, keeps a track as its line, makes stops of waypoints', () => {
    const parts = gpxToDayParts(parseGpx(GPX_11), options);
    const [planned, track] = parts.routes;
    expect([planned!.name, planned!.kind, planned!.profile, routedOf(planned!).points.map((p) => p.lngLat)]).toEqual(['Planned', 'routed', 'bicycle', [[11.5, 48.1], [11.7, 48.3]]]);
    expect(track).toMatchObject({ name: 'tour 2', kind: 'track', profile: 'bicycle' });
    expect(track!.kind === 'track' && decodePolyline(track!.line)).toEqual([[12, 47], [12.1, 47.1], [12.2, 47.2]]);
    // The café stands on the route's first point and is bound to it; the castle has no symbol, only a type.
    expect(parts.stops.map((s) => [s.name, s.symbol, s.notes, s.pointId])).toEqual([
      ['Café', 'Navaid, Black', 'Good cake', routedOf(planned!).points[0]!.id],
      ['Waypoint 2', null, 'No name', null],
    ]);
  });

  it("keeps a waypoint's Garmin symbol as the file names it, trimmed, and reads nothing from its type", () => {
    const waypoint = (inner: string) => `<wpt lat="48" lon="11">${inner}</wpt>`;
    const waypoints = ['<sym>Navaid, Green/Red</sym><type>user</type>', '<sym> Lodging </sym>', '<type>hotel</type>', '<sym>Custom 511</sym>', `<sym>${'x'.repeat(120)}</sym>`].map(waypoint).join('');
    const gpx = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${waypoints}</gpx>`;
    expect(gpxToDayParts(parseGpx(gpx), options).stops.map((s) => s.symbol)).toEqual(['Navaid, Green/Red', 'Lodging', null, 'Custom 511', 'x'.repeat(100)]);
  });

  it("takes the address and the phone numbers from Garmin's waypoint extension, read once", () => {
    const extension = (prefix: string, uri: string) => `
      <${prefix}:WaypointExtension xmlns:${prefix}="${uri}">
        <${prefix}:Address>
          <${prefix}:StreetAddress>58 Rue des Vignerons</${prefix}:StreetAddress>
          <${prefix}:StreetAddress>Bâtiment B</${prefix}:StreetAddress>
          <${prefix}:City>Marieulles</${prefix}:City>
          <${prefix}:State>Moselle</${prefix}:State>
          <${prefix}:Country>FRA</${prefix}:Country>
          <${prefix}:PostalCode>57420</${prefix}:PostalCode>
        </${prefix}:Address>
        <${prefix}:PhoneNumber>+33 3 87 69 91 98</${prefix}:PhoneNumber>
        <${prefix}:PhoneNumber Category="Mobile">+33 6 45 06 62 35</${prefix}:PhoneNumber>
        <${prefix}:PhoneNumber/>
      </${prefix}:WaypointExtension>`;
    const gpx = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <wpt lat="48" lon="11"><name>Winery</name><sym>Winery</sym><type>user</type><extensions>${extension('gpxx', 'http://www.garmin.com/xmlschemas/GpxExtensions/v3')}${extension('wptx1', 'http://www.garmin.com/xmlschemas/WaypointExtension/v1')}</extensions></wpt>
      <wpt lat="48" lon="11"><name>Plain</name></wpt>
    </gpx>`;
    expect(gpxToDayParts(parseGpx(gpx), options).stops.map((s) => [s.name, s.symbol, s.address, s.contact])).toEqual([
      ['Winery', 'Winery', '58 Rue des Vignerons, Bâtiment B, 57420 Marieulles, Moselle, FRA', '+33 3 87 69 91 98, Mobile: +33 6 45 06 62 35'],
      ['Plain', null, '', ''],
    ]);
  });

  it("keeps a Garmin route's points, each leg along the way Garmin calculated, its time left to the pace", () => {
    const [garmin, plain] = gpxToDayParts(parseGpx(GARMIN), options).routes.map(routedOf);
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
    const [route] = gpxToDayParts(gpx, options).routes.map(routedOf);
    expect(route!.points.map((p) => p.lngLat)).toEqual([
      [11, 48],
      [11.2, 48.3],
    ]);
    expect(Object.keys(route!.legs)).toEqual(['bicycle:allow/11,48;11.2,48.3']);
  });

  it('composes names and notes, closes up their blank runs and cuts them to what a trip holds', () => {
    const gpx = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <wpt lat="48" lon="11"><name>  Touratech
        PT </name><desc>Av. Infante D. Henrique  \n\n${'\n  '.repeat(30000)}\nEmail: info@touratech.pt\n</desc></wpt>
      <wpt lat="48" lon="11"><name>${'ö'.repeat(250)}</name><desc>${'ü'.repeat(25000)}</desc></wpt>
      <rte><name>${'x'.repeat(300)}</name><rtept lat="48" lon="11"/></rte>
      <wpt lat="48" lon="11"><name>Rho\u0308n</name></wpt>
    </gpx>`;
    const parts = gpxToDayParts(parseGpx(gpx), options);
    expect(parts.stops[0]).toMatchObject({ name: 'Touratech PT', notes: 'Av. Infante D. Henrique\n\nEmail: info@touratech.pt' });
    expect([parts.stops[1]!.name, parts.stops[1]!.notes, parts.routes[0]!.name].map((t) => t.length)).toEqual([200, 20000, 200]);
    expect(parts.stops[2]!.name).toBe('Rh\u00f6n');
  });

  it('names a single unnamed line after the file, drops repeated points, keeps every point of a long track', () => {
    const zigzag = (count: number): LngLat[] => Array.from({ length: count }, (_, i) => [i * 0.0001, (i % 2) * 0.0002]);
    const parts = gpxToDayParts({ waypoints: [], routes: [], tracks: [{ segments: [[[1, 1], [1.0000001, 1]], [[2, 2]]] }] }, options);
    expect(parts.routes.map((r) => [r.name, r.kind === 'track' && decodePolyline(r.line)])).toEqual([['tour', [[1, 1], [2, 2]]]]);
    const long = gpxToDayParts({ waypoints: [], routes: [], tracks: [{ segments: [zigzag(3000)] }] }, options);
    expect(pointCount(long.routes[0]!)).toBe(3000);
    expect(gpxToDayParts({ waypoints: [], routes: [], tracks: [] }, options)).toEqual({ routes: [], stops: [] });
  });
});

describe('a file of places', () => {
  const place = (name: string, links: string[], type = 'Inns') =>
    `<wpt lat="48" lon="8"><name>${name}</name>${links.map((href) => `<link href="${href}"/>`).join('')}<type>${type}</type></wpt>`;
  const file = (...places: string[]) => parseGpx(`<gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Our places</name></metadata>${places.join('')}</gpx>`);

  it('is read with its name, and each waypoint with its kind and its links in order', () => {
    const gpx = file(place('Post', ['https://list.example/post', 'https://post.example/']), place('Krone', [], 'Hotels'));
    expect(gpx.name).toBe('Our places');
    expect(gpx.waypoints.map((w) => [w.name, w.type, w.links])).toEqual([['Post', 'Inns', ['https://list.example/post', 'https://post.example/']], ['Krone', 'Hotels', []]]);
  });

  it('gives each place its own page and leaves out the list they all link to', () => {
    const gpx = file(place('Post', ['https://list.example/post', 'https://post.example/']), place('Krone', ['https://list.example/krone']), place('Adler', ['https://list.example/adler', 'http://adler.example/hof']));
    expect(ownWebsites(gpx.waypoints)).toEqual(['https://post.example/', '', 'http://adler.example/hof']);
    expect(waypointStops(gpx, () => 'id').map((stop) => stop.website)).toEqual(['https://post.example/', '', 'http://adler.example/hof']);
  });

  it('keeps the only site the places link to, and takes what is no web address for none', () => {
    const chain = file(place('North', ['https://chain.example/north']), place('South', ['https://chain.example/south']));
    expect(ownWebsites(chain.waypoints)).toEqual(['https://chain.example/north', 'https://chain.example/south']);
    expect(ownWebsites(file(place('Odd', ['not a link'])).waypoints)).toEqual(['']);
  });
});

describe('a file of routes', () => {
  const kml = '<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Vosges</name><Placemark><LineString><coordinates>7.1,48.5 7.2,48.6</coordinates></LineString></Placemark></Document></kml>';
  /** A zip that stores one file under a path, which is all a KMZ needs to be. */
  function stored(path: string, content: string): Blob {
    const name = new TextEncoder().encode(path);
    const data = new TextEncoder().encode(content);
    const header = (signature: number, more: number[]) => {
      const bytes = new DataView(new ArrayBuffer(4 + more.length * 2));
      bytes.setUint32(0, signature, true);
      more.forEach((value, i) => bytes.setUint16(4 + i * 2, value, true));
      return bytes;
    };
    const sizes = [data.length & 0xffff, data.length >>> 16, data.length & 0xffff, data.length >>> 16];
    const local = header(0x04034b50, [20, 0, 0, 0, 0, 0, 0, ...sizes, name.length, 0]);
    const central = header(0x02014b50, [20, 20, 0, 0, 0, 0, 0, 0, ...sizes, name.length, 0, 0, 0, 0, 0, 0, 0, 0]);
    const start = local.byteLength + name.length + data.length;
    const size = central.byteLength + name.length;
    const end = header(0x06054b50, [0, 0, 1, 1, size & 0xffff, size >>> 16, start & 0xffff, start >>> 16, 0]);
    return new Blob([local, name, data, central, name, end]);
  }

  it('is read as what its name says it is', async () => {
    expect((await readRouteFile(new File([kml], 'Vosges.KML'))).tracks[0]!.segments).toEqual([[[7.1, 48.5], [7.2, 48.6]]]);
    expect((await readRouteFile(new File(['<gpx version="1.1"><wpt lat="48" lon="7"/></gpx>'], 'places.gpx'))).waypoints.length).toBe(1);
  });

  it('is read as the other of GPX and KML where its name says the wrong one, and refused as what it is named where it is neither', async () => {
    expect((await readRouteFile(new File([kml], 'Vosges.gpx'))).tracks[0]!.segments).toEqual([[[7.1, 48.5], [7.2, 48.6]]]);
    expect((await readRouteFile(new File(['<gpx version="1.1"><wpt lat="48" lon="7"/></gpx>'], 'places.kml'))).waypoints.length).toBe(1);
    await expect(readRouteFile(new File(['nonsense'], 'Vosges.gpx'))).rejects.toThrow('not a GPX file');
    await expect(readRouteFile(new File(['<html/>'], 'Vosges.kml'))).rejects.toThrow('not a KML file');
  });

  it('is read from a KMZ, whose KML lies at its top', async () => {
    const parts = await readDayParts(new File([stored('doc.kml', kml)], 'Vosges.kmz'), 'motorcycle');
    expect(parts.routes.map((route) => [route.kind, route.name])).toEqual([['track', 'Vosges']]);
    await expect(readRouteFile(new File([stored('readme.txt', 'none')], 'empty.kmz'))).rejects.toThrow('holds no KML');
  });
});
