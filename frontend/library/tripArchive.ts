import { addEntry, addRecording, createTrip, errorMessage, fetchTrip, saveTrip } from '../api';
import type { EntryTarget } from '../model/journal';
import { newId, type LngLat, type Trip } from '../model/trip';
import { withNewPartIds } from '../routing/dayEdit';

/**
 * A trip as the export wrote it into a folder: `trip.json` with the trip's document, its
 * journal and its recordings, and beside it the files those name.
 */

const ARCHIVE_FILE = 'trip.json';

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
  // An exported trip may still be in the library, and ids are the library's as a whole.
  const ids = new Map<string, string>();
  const days = archive.trip.days.map((day) => {
    const renewed = withNewPartIds(day, newId);
    const id = newId();
    for (const [old, made] of [[day.id, id], ...renewed.ids]) ids.set(old!, made!);
    return { ...renewed.day, id };
  });
  const made = await fetchTrip((await createTrip(archive.trip.name, folderId, archive.trip.kind)).id);
  await saveTrip({ ...made, description: archive.trip.description, state: archive.trip.state, days });
  const note = (what: string, error: unknown) => errors.push(`${archive.trip.name} / ${what}: ${errorMessage(error)}`);
  for (const entry of archive.journal ?? []) {
    try {
      const file = entry.file === null ? undefined : await read(entry.file);
      // An entry on a part that is not there goes on the trip.
      const key = (['dayId', 'stopId', 'routeId'] as const).find((k) => entry[k] !== null && ids.has(entry[k]));
      const target = (key ? { [key]: ids.get(entry[key]!) } : {}) as EntryTarget;
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
