import { fetchStashGpx } from '../api';
import { parseGpx } from '../gpx/gpx';
import { stashPartToDayParts } from '../gpx/import';
import type { StashFile, StashItem, StashPart } from '../model/stash';
import { newId } from '../model/trip';
import { stopsOf, type CopiedRoute } from '../routing/dayEdit';
import { kindedWaypoints, type KindedPlace } from './dropImport';

/** A file of the Stash with what is taken of it: all its routes and tracks, or those named. */
export interface Picked {
  file: StashFile;
  items?: readonly StashItem[];
}

/**
 * The routes and tracks picked from files of the Stash, read from the files as an
 * import reads them, as copies to paste into a day: a route with its points and the way
 * Garmin gave between them, a track with its line, and with each its own stops for the
 * file's waypoints, where those are taken, else those alone that stand on its points.
 */
export async function stashCopies(picked: readonly StashPart[]): Promise<CopiedRoute[]> {
  const copies: CopiedRoute[] = [];
  for (const part of picked) {
    const read = stashPartToDayParts(await parseGpx(await fetchStashGpx(part.file.id)), part, 'motorcycle', newId);
    copies.push(...read.routes.map((route) => ({ route, stops: stopsOf(route, read.stops), from: { date: null, name: part.file.name } })));
  }
  return copies;
}

/** The waypoints of the files whose waypoints are taken, as places for a list of places: each of no route, with the kind its file sorts it under. */
export async function stashPlaces(parts: readonly StashPart[]): Promise<KindedPlace[]> {
  const places: KindedPlace[] = [];
  for (const { file } of parts.filter((part) => part.waypoints)) places.push(...kindedWaypoints(await parseGpx(await fetchStashGpx(file.id))));
  return places;
}
