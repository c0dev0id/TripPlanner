import { fetchStashGpx } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts, waypointStops } from '../gpx/import';
import type { StashFile, StashItem } from '../model/stash';
import { asName, newId, type Stop } from '../model/trip';
import { stopsBoundTo, type CopiedRoute } from '../routing/dayEdit';

/** A file of the Stash with what is taken of it: all its routes and tracks, or those named. */
export interface Picked {
  file: StashFile;
  items?: readonly StashItem[];
}

/**
 * The routes and tracks picked from files of the Stash, read from the files as an
 * import reads them, as copies to paste into a day: a route with its points and the way
 * Garmin gave between them, a track with its line, and with each the waypoints that
 * stand on its points.
 */
export async function stashCopies(picked: readonly Picked[]): Promise<CopiedRoute[]> {
  const copies: CopiedRoute[] = [];
  for (const { file, items } of picked) {
    const gpx = parseGpx(await fetchStashGpx(file.id));
    const taken = (kind: StashItem['kind']) => (_: unknown, position: number) => !items || items.some((item) => item.kind === kind && item.position === position);
    const parts = gpxToDayParts({ ...gpx, routes: gpx.routes.filter(taken('route')), tracks: gpx.tracks.filter(taken('track')) }, { fileName: file.name, profile: 'motorcycle', newId });
    copies.push(...parts.routes.map((route) => ({ route, stops: stopsBoundTo(route, parts.stops), from: { date: null, name: file.name } })));
  }
  return copies;
}

/** The waypoints of files of the Stash as stops to paste into a day or a list of places, each standing free, and for each the kind its file sorts it under, empty for none. */
export async function stashStops(files: readonly StashFile[]): Promise<{ stops: Stop[]; kinds: string[] }> {
  const stops: Stop[] = [];
  const kinds: string[] = [];
  for (const file of files) {
    const gpx = parseGpx(await fetchStashGpx(file.id));
    stops.push(...waypointStops(gpx, newId));
    kinds.push(...gpx.waypoints.map((waypoint) => asName(waypoint.type ?? '')));
  }
  return { stops, kinds };
}
