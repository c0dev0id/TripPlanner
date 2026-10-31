import { position } from '../gpx/gpx';
import { children, parseXml, text } from '../gpx/xml';
import type { LngLat } from '../model/trip';

/** A recording as its GPX file holds it: the track's positions in order, and per point what the file measured there. */
export interface RecordedTrack {
  name?: string;
  points: LngLat[];
  /**
   * Values per point, aligned with `points`, null where a point lacks one: `time` in
   * milliseconds since the epoch, `ele` in metres, and every number in a point's
   * extensions under its local name, in the file's units (Ridelink writes speed, course,
   * lean_angle and acc_x, acc_y, acc_z).
   */
  series: Record<string, (number | null)[]>;
}

/** The elements inside an element that hold no others: the values of an extension, however deep. */
const leaves = (element: Element): Element[] => Array.from(element.getElementsByTagName('*')).filter((e) => e.childElementCount === 0);

/**
 * Reads a recording: a GPX file of one track, its segments one after the other; waypoints,
 * such as an app's start and end points, are left aside. Throws for any other file.
 */
export function readRecording(xml: string): RecordedTrack {
  const root = parseXml(xml);
  if (root?.localName !== 'gpx') throw new Error('This is not a GPX file.');
  const tracks = children(root, 'trk');
  if (tracks.length !== 1 || children(root, 'rte').length > 0) throw new Error('A recording is a GPX file of one track.');
  const trackpoints = children(tracks[0]!, 'trkseg')
    .flatMap((segment) => children(segment, 'trkpt'))
    .filter((p) => position(p) !== undefined);
  const series: RecordedTrack['series'] = {};
  const put = (key: string, i: number, value: number) => {
    (series[key] ??= new Array<number | null>(trackpoints.length).fill(null))[i] = value;
  };
  trackpoints.forEach((p, i) => {
    const ele = Number(text(p, 'ele') ?? NaN);
    if (Number.isFinite(ele)) put('ele', i, ele);
    const time = Date.parse(text(p, 'time') ?? '');
    if (Number.isFinite(time)) put('time', i, time);
    for (const leaf of children(p, 'extensions').flatMap(leaves)) {
      const value = Number(leaf.textContent?.trim() || NaN);
      if (Number.isFinite(value)) put(leaf.localName, i, value);
    }
  });
  return { name: text(tracks[0]!, 'name'), points: trackpoints.map((p) => position(p)!), series };
}

const escaped = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A GPX file of one track along the points, for a line of the planner kept as a recording. */
export function trackGpx(name: string, points: readonly LngLat[]): string {
  const trackpoints = points.map(([lng, lat]) => `<trkpt lat="${lat}" lon="${lng}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trip Planner" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${escaped(name)}</name><trkseg>
${trackpoints}
</trkseg></trk>
</gpx>
`;
}
