import type { LngLat } from '../model/trip';
import { children, parseXml, text } from './xml';

/** What a GPX 1.0 or 1.1 file holds: waypoints, routes (`rte`) and tracks (`trk`) with their segments. */
export interface GpxContent {
  waypoints: { lngLat: LngLat; name?: string; description?: string; type?: string }[];
  /**
   * `ways` holds for each point the points of the way a Garmin device or BaseCamp
   * calculated from it on to the next, where the file has them; none otherwise.
   */
  routes: { name?: string; points: LngLat[]; ways: LngLat[][] }[];
  tracks: { name?: string; segments: LngLat[][] }[];
}

function position(element: Element): LngLat | undefined {
  const lat = Number(element.getAttribute('lat'));
  const lng = Number(element.getAttribute('lon'));
  return element.hasAttribute('lat') && element.hasAttribute('lon') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 ? [lng, lat] : undefined;
}

const positions = (elements: Element[]) => elements.map(position).filter((p): p is LngLat => p !== undefined);

/** The points Garmin's extension gives a route point for the way on to the next (`gpxx:RoutePointExtension`, `gpxx:rpt`). */
function garminWay(rtept: Element): Element[] {
  return children(rtept, 'extensions').flatMap((e) => children(e, 'RoutePointExtension')).flatMap((e) => children(e, 'rpt'));
}

function route(rte: Element): GpxContent['routes'][number] {
  const rtepts = children(rte, 'rtept').filter((p) => position(p) !== undefined);
  return { name: text(rte, 'name'), points: positions(rtepts), ways: rtepts.map((p) => positions(garminWay(p))) };
}

/** Reads a GPX document; throws for anything else. */
export function parseGpx(xml: string): GpxContent {
  const root = parseXml(xml);
  if (root?.localName !== 'gpx') throw new Error('This is not a GPX file.');
  return {
    waypoints: children(root, 'wpt').flatMap((w) => {
      const lngLat = position(w);
      return lngLat ? [{ lngLat, name: text(w, 'name'), description: text(w, 'desc') ?? text(w, 'cmt'), type: text(w, 'type') }] : [];
    }),
    routes: children(root, 'rte').map(route),
    tracks: children(root, 'trk').map((t) => ({ name: text(t, 'name'), segments: children(t, 'trkseg').map((segment) => positions(children(segment, 'trkpt'))) })),
  };
}
