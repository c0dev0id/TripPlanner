import { t } from '../i18n/t';
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

/** The one track of a recording's file; throws for a file that is no GPX file of one track. */
function trackIn(xml: string): Element {
  const root = parseXml(xml);
  if (root?.localName !== 'gpx') throw new Error(t('This is not a GPX file.'));
  const tracks = children(root, 'trk');
  if (tracks.length !== 1 || children(root, 'rte').length > 0) throw new Error(t('A recording is a GPX file of one track.'));
  return tracks[0]!;
}

/** The name a recording's file gives its track, read without its points; throws for a file that is no recording. */
export const recordingName = (xml: string): string | undefined => text(trackIn(xml), 'name');

/**
 * Reads a recording: a GPX file of one track, its segments one after the other; waypoints,
 * such as an app's start and end points, are left aside. Throws for any other file.
 */
export function readRecording(xml: string): RecordedTrack {
  const track = trackIn(xml);
  const trackpoints = children(track, 'trkseg')
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
  return { name: text(track, 'name'), points: trackpoints.map((p) => position(p)!), series };
}
