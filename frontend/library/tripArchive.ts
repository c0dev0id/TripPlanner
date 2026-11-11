import { addEntry, addRecording, createTrip, fetchTrip, saveTrip } from '../api';
import type { EntryTarget } from '../model/journal';
import { newId, type Day, type LngLat, type Trip } from '../model/trip';

/**
 * A trip as the export wrote it into a folder: `trip.json` with the trip's document, its
 * journal and its recordings, and beside it the files those name.
 */

export const ARCHIVE_FILE = 'trip.json';

interface Archive {
  format: 'trip-planner';
  trip: Pick<Trip, 'kind' | 'name' | 'description' | 'state' | 'days'>;
  journal: { dayId: string | null; stopId: string | null; routeId: string | null; text: string; file: string | null; fileName: string | null; lngLat: LngLat | null; createdAt: string }[];
  recordings: { dayId: string; name: string; file: string }[];
}

/** The folders among the paths that hold an exported trip, by their path; empty for the folder picked itself. */
export function archiveFolders(paths: readonly string[]): string[] {
  return paths.filter((path) => path === ARCHIVE_FILE || path.endsWith(`/${ARCHIVE_FILE}`)).map((path) => path.slice(0, Math.max(0, path.length - ARCHIVE_FILE.length - 1)));
}

/** Whether the path lies in one of the folders. */
export const inFolders = (path: string, folders: readonly string[]): boolean => folders.some((folder) => folder === '' || path.startsWith(`${folder}/`));

/**
 * The days under new ids, of the days, routes, route points and stops alike, with the new
 * id of each old one: an exported trip may still be in the library, and ids are the
 * library's as a whole.
 */
export function withNewIds(days: readonly Day[], makeId: () => string = newId): { days: Day[]; ids: Map<string, string> } {
  const ids = new Map<string, string>();
  const renew = (id: string): string => {
    const made = makeId();
    ids.set(id, made);
    return made;
  };
  const renewed = days.map((day) => {
    const routes = day.routes.map((route) => (route.kind === 'track' ? { ...route, id: renew(route.id) } : { ...route, id: renew(route.id), points: route.points.map((point) => ({ ...point, id: renew(point.id) })) }));
    // A stop bound to a point that is not there stands free.
    const stops = day.stops.map((stop) => ({ ...stop, id: renew(stop.id), pointId: (stop.pointId !== null && ids.get(stop.pointId)) || null }));
    return { ...day, id: renew(day.id), routes, stops };
  });
  return { days: renewed, ids };
}

/**
 * Makes the trip exported into a folder anew in the library's folder `folderId`, with its
 * journal and recordings; `read` gives a file of the folder by its path in it, or nothing
 * where it is missing. An entry or a recording that cannot be put back is told in the
 * errors, and the import goes on.
 *
 * @throws where `trip.json` is none of ours or the trip cannot be saved
 */
export async function importArchive(read: (path: string) => Promise<Blob | undefined>, folderId: number | null, errors: string[]): Promise<void> {
  const archive = JSON.parse(await (await read(ARCHIVE_FILE))!.text()) as Archive;
  if (archive.format !== 'trip-planner' || !Array.isArray(archive.trip?.days)) throw new Error(`${ARCHIVE_FILE} is no exported trip.`);
  const { days, ids } = withNewIds(archive.trip.days);
  const made = await fetchTrip((await createTrip(archive.trip.name, folderId, archive.trip.kind)).id);
  await saveTrip({ ...made, description: archive.trip.description, state: archive.trip.state, days });
  const note = (what: string, error: unknown) => errors.push(`${archive.trip.name} / ${what}: ${error instanceof Error ? error.message : String(error)}`);
  for (const entry of archive.journal ?? []) {
    try {
      const file = entry.file === null ? undefined : await read(entry.file);
      const part = (key: 'dayId' | 'stopId' | 'routeId') => (entry[key] !== null ? ids.get(entry[key]) : undefined);
      const target: EntryTarget = part('dayId') ? { dayId: part('dayId')! } : part('stopId') ? { stopId: part('stopId')! } : part('routeId') ? { routeId: part('routeId')! } : {};
      await addEntry(made.id, target, entry.text, file && new File([file], entry.fileName ?? 'file'), entry.lngLat ?? undefined, entry.createdAt);
    } catch (error) {
      note(entry.fileName ?? entry.text.slice(0, 40), error);
    }
  }
  for (const recording of archive.recordings ?? []) {
    try {
      const dayId = ids.get(recording.dayId);
      const gpx = await read(recording.file);
      if (!dayId || !gpx) throw new Error('its day or its file is missing');
      await addRecording(made.id, dayId, recording.name, await gpx.text());
    } catch (error) {
      note(recording.name, error);
    }
  }
}
