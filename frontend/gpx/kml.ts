import { t } from '../i18n/t';
import type { LngLat } from '../model/trip';
import type { GpxContent } from './gpx';
import { children, parseXml, text } from './xml';

/**
 * A KML document read into what a GPX file holds, for everything that takes one. A
 * placemark's point is a waypoint, sorted under the folder it is in; its lines are a
 * track, a segment each, since KML knows no route to be calculated. Areas are left out.
 */

/** A position from "lng,lat[,alt]" or, in a `gx:coord`, "lng lat [alt]"; undefined where it is none or off the world. */
function position(tuple: string): LngLat | undefined {
  const [lng, lat] = tuple.split(/[\s,]+/).map(Number);
  return lng !== undefined && lat !== undefined && Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 ? [lng, lat] : undefined;
}

const positions = (tuples: readonly string[]): LngLat[] => tuples.map(position).filter((p): p is LngLat => p !== undefined);

/** The positions of an element's `coordinates`, which are separated by blanks. */
const coordinates = (element: Element): LngLat[] => positions((text(element, 'coordinates') ?? '').split(/\s+/));

/** The positions of a `gx:Track`, a `gx:coord` each. */
const trackPoints = (track: Element): LngLat[] => positions(children(track, 'coord').map((coord) => coord.textContent?.trim() ?? ''));

/** What a placemark's geometry holds, through any `MultiGeometry` in it: its points, its lines, and when the first tracked point was recorded. */
function geometry(element: Element): { points: LngLat[]; lines: LngLat[][]; time?: string } {
  const found: { points: LngLat[]; lines: LngLat[][]; time?: string } = { points: [], lines: [] };
  const add = (line: LngLat[]) => line.length > 0 && found.lines.push(line);
  for (const child of Array.from(element.children)) {
    if (child.localName === 'Point') found.points.push(...coordinates(child));
    else if (child.localName === 'LineString') add(coordinates(child));
    else if (child.localName === 'Track' || child.localName === 'MultiTrack') {
      const tracks = child.localName === 'Track' ? [child] : children(child, 'Track');
      tracks.forEach((track) => add(trackPoints(track)));
      found.time ??= tracks.map((track) => text(track, 'when')).find(Boolean);
    } else if (child.localName === 'MultiGeometry') {
      const inner = geometry(child);
      found.points.push(...inner.points);
      found.lines.push(...inner.lines);
      found.time ??= inner.time;
    }
  }
  return found;
}

/** A description as text, with the web addresses it links to: KML writes them as HTML more often than not. */
function described(html: string | undefined): { description?: string; links: string[] } {
  if (!html) return { links: [] };
  const body = new DOMParser().parseFromString(html.replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '$&\n'), 'text/html').body;
  const links = Array.from(body.querySelectorAll('a[href]')).flatMap((a) => (/^https?:\/\//i.test(a.getAttribute('href')!) ? a.getAttribute('href')! : []));
  return { description: body.textContent?.trim() || undefined, links };
}

/** Reads a KML document; throws for anything else. */
export function parseKml(xml: string): GpxContent {
  const root = parseXml(xml);
  if (root?.localName !== 'kml') throw new Error(t('This is not a KML file.'));
  const content: GpxContent = { name: undefined, waypoints: [], routes: [], tracks: [] };
  const read = (container: Element, folder: string | undefined) => {
    for (const child of Array.from(container.children)) {
      if (child.localName === 'Document') {
        content.name ??= text(child, 'name');
        read(child, folder);
      } else if (child.localName === 'Folder') read(child, text(child, 'name') ?? folder);
      else if (child.localName === 'Placemark') {
        const name = text(child, 'name');
        const { points, lines, time } = geometry(child);
        const said = { ...described(text(child, 'description')), address: text(child, 'address'), phone: text(child, 'phoneNumber') };
        content.waypoints.push(...points.map((lngLat) => ({ lngLat, name, type: folder, ...said })));
        if (lines.length > 0) content.tracks.push({ name, segments: lines, time });
      }
    }
  };
  read(root, undefined);
  return content;
}
