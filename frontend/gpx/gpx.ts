import type { LngLat } from '../model/trip';
import { children, parseXml, text } from './xml';

/** What a GPX 1.0 or 1.1 file holds: waypoints, routes (`rte`) and tracks (`trk`) with their segments. */
export interface GpxContent {
  /** `symbol` is the icon a Garmin device shows for the waypoint (`sym`); `address` and `phone` come from Garmin's waypoint extension. */
  waypoints: { lngLat: LngLat; name?: string; description?: string; symbol?: string; address?: string; phone?: string }[];
  /**
   * `ways` holds for each point the points of the way a Garmin device or BaseCamp
   * calculated from it on to the next, where the file has them; none otherwise.
   */
  routes: { name?: string; points: LngLat[]; ways: LngLat[][] }[];
  tracks: { name?: string; segments: LngLat[][] }[];
}

/** A point's position from its `lat` and `lon`; undefined where they are missing or off the world. */
export function position(element: Element): LngLat | undefined {
  const lat = Number(element.getAttribute('lat'));
  const lng = Number(element.getAttribute('lon'));
  return element.hasAttribute('lat') && element.hasAttribute('lon') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 ? [lng, lat] : undefined;
}

const positions = (elements: Element[]) => elements.map(position).filter((p): p is LngLat => p !== undefined);

/** The points Garmin's extension gives a route point for the way on to the next (`gpxx:RoutePointExtension`, `gpxx:rpt`). */
function garminWay(rtept: Element): Element[] {
  return children(rtept, 'extensions').flatMap((e) => children(e, 'RoutePointExtension')).flatMap((e) => children(e, 'rpt'));
}

/**
 * The address and the phone numbers in Garmin's waypoint extension (`WaypointExtension_t`
 * in GpxExtensionsv3.xsd and WaypointExtensionv1.xsd), each as one line; a number's
 * category, such as Mobile, goes before it. Garmin writes the same extension in both
 * namespaces; the first is read.
 */
function garminContact(wpt: Element): { address?: string; phone?: string } {
  const extension = children(wpt, 'extensions').flatMap((e) => children(e, 'WaypointExtension'))[0];
  if (!extension) return {};
  const address = children(extension, 'Address')[0];
  const lines = address
    ? [...children(address, 'StreetAddress').map((e) => e.textContent?.trim()), [text(address, 'PostalCode'), text(address, 'City')].filter(Boolean).join(' '), text(address, 'State'), text(address, 'Country')]
    : [];
  const phones = children(extension, 'PhoneNumber').map((e) => {
    const number = e.textContent?.trim();
    const category = e.getAttribute('Category');
    return number && (category ? `${category}: ${number}` : number);
  });
  return { address: lines.filter(Boolean).join(', ') || undefined, phone: phones.filter(Boolean).join(', ') || undefined };
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
      return lngLat ? [{ lngLat, name: text(w, 'name'), description: text(w, 'desc') ?? text(w, 'cmt'), symbol: text(w, 'sym'), ...garminContact(w) }] : [];
    }),
    routes: children(root, 'rte').map(route),
    tracks: children(root, 'trk').map((t) => ({ name: text(t, 'name'), segments: children(t, 'trkseg').map((segment) => positions(children(segment, 'trkpt'))) })),
  };
}
