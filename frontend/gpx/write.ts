import type { LngLat } from '../model/trip';
import type { GpxContent } from './gpx';

const escaped = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const element = (name: string, value: string | undefined): string => (value ? `<${name}>${escaped(value)}</${name}>` : '');
const at = ([lng, lat]: LngLat): string => `lat="${lat}" lon="${lng}"`;

/**
 * What a file of routes holds, as a GPX 1.1 file, for a file of another format to be kept
 * as GPX: the waypoints with name, description, symbol, kind and links, the routes by
 * their points, the tracks by their segments. What GPX has no element of its own for is
 * left out.
 */
export function gpxText(content: GpxContent): string {
  const waypoints = content.waypoints.map(
    (w) => `<wpt ${at(w.lngLat)}>${element('name', w.name)}${element('desc', w.description)}${w.links.map((link) => `<link href="${escaped(link)}"/>`).join('')}${element('sym', w.symbol)}${element('type', w.type)}</wpt>`,
  );
  const routes = content.routes.map((r) => `<rte>${element('name', r.name)}${r.points.map((p) => `<rtept ${at(p)}/>`).join('')}</rte>`);
  const tracks = content.tracks.map((t) => `<trk>${element('name', t.name)}${t.segments.map((segment) => `<trkseg>${segment.map((p) => `<trkpt ${at(p)}/>`).join('')}</trkseg>`).join('')}</trk>`);
  const metadata = content.name ? `<metadata>${element('name', content.name)}</metadata>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Trip Planner" xmlns="http://www.topografix.com/GPX/1/1">${[metadata, ...waypoints, ...routes, ...tracks].join('\n')}</gpx>\n`;
}
