import { t } from '../i18n/t';
import { addRecordingOnce, changeTrip, createTrip, errorMessage, fetchTrip, listTrips, saveTrip } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts, waypointStops, type DayParts } from '../gpx/import';
import { asName, newId, type FolderKind, type Stop, type Trip, type TripSummary } from '../model/trip';
import { addParts, moveDay } from '../routing/dayEdit';
import { readRecording, type RecordedTrack } from '../recording/track';
import { counted } from '../ui/format';
import type { Dropped } from './fileDrop';
import { dateIn, importFolder, isGpxPath, planFolderImport, readPlannedDays, withImportedDay, type ImportMode, type ImportSource } from './folderImport';
import { archiveFolders, inFolders } from './tripArchive';

/** The month a ride was recorded in, as YYYY-MM: from the time of its first point that has one, else from a date in the file's name, else from when the file was last changed. */
export function recordedMonth(track: RecordedTrack, file: File): string {
  const time = track.series.time?.find((ms) => ms !== null);
  return (time != null ? new Date(time).toISOString() : (dateIn(file.name) ?? new Date(file.lastModified).toISOString())).slice(0, 7);
}

/** The collection of the name in the folder: the one among the trips listed, or a new one. */
const collectionIn = async (trips: readonly TripSummary[], folderId: number | null, name: string): Promise<number> =>
  trips.find((trip) => trip.kind === 'collection' && trip.folderId === folderId && trip.name === name)?.id ?? (await createTrip(name, folderId, 'collection')).id;

/**
 * Keeps the GPX files among `files`, of one track each, as recordings, the files as they
 * are: in the collection `tripId`, or in the folder `folderId` in the collection of the
 * year a ride was recorded in, there on the section of its month; collection and section
 * are made where they are missing. A file the user keeps already, on whatever day, is
 * left out. The answer says how many were kept and how many were there already, and
 * what could not be read or kept; the import goes on past those.
 */
async function importRecordings(files: readonly ImportSource[], into: { folderId: number | null } | { tripId: number }, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const sources = files.filter((source) => isGpxPath(source.path));
  const errors: string[] = [];
  let kept = 0;
  let known = 0;
  const trips = 'tripId' in into || sources.length === 0 ? [] : await listTrips();
  const collections = new Map<string, number>();
  const sections = new Map<string, { tripId: number; dayId: string }>();
  const sectionOf = async (month: string) => {
    const year = month.slice(0, 4);
    const tripId = 'tripId' in into ? into.tripId : (collections.get(year) ?? (await collectionIn(trips, into.folderId, year)));
    collections.set(year, tripId);
    const trip = await fetchTrip(tripId);
    let dayId = trip.days.find((day) => day.name === month)?.id;
    if (!dayId) {
      const withSection = withImportedDay(trip, { name: month, date: null }, []);
      dayId = withSection.days.at(-1)!.id;
      // The months stand in their order: the new one before the first section that comes after it.
      const at = trip.days.findIndex((day) => day.name > month);
      await saveTrip(at < 0 ? withSection : moveDay(withSection, dayId, at), trip);
    }
    return { tripId, dayId };
  };
  for (const [n, source] of sources.entries()) {
    onProgress(t('Importing {i} of {n}: {name}', { i: n + 1, n: sources.length, name: source.path }));
    try {
      const file = await source.open();
      const gpx = await file.text();
      const track = readRecording(gpx);
      const month = recordedMonth(track, file);
      const section = sections.get(month) ?? (await sectionOf(month));
      sections.set(month, section);
      if (await addRecordingOnce(section.tripId, section.dayId, asName(track.name ?? file.name.replace(/\.gpx$/i, '')) || t('Recording'), gpx)) kept++;
      else known++;
    } catch (error) {
      errors.push(`${source.path}: ${errorMessage(error)}`);
    }
  }
  const texts = [kept > 0 && t('{trips} imported.', { trips: counted(kept, 'recording') }), known > 0 && t('{what} kept already.', { what: counted(known, 'recording') })].filter(Boolean);
  return { text: texts.length > 0 ? texts.join(' ') : t('No GPX files and no exported trips in there.'), errors };
}

/** The list with the places added, each to the section of its kind, made where the list has none of that name; a place the list holds already, by its name where it stands, is left out. */
function withPlaces(list: Trip, places: readonly { kind: string; stop: Stop }[]): Trip {
  const at = (stop: Stop) => `${stop.name}|${stop.lngLat.join(',')}`;
  const held = new Set(list.days.flatMap((day) => day.stops.map(at)));
  return places.reduce((to, { kind, stop }) => {
    if (held.has(at(stop))) return to;
    held.add(at(stop));
    const section = to.days.find((day) => day.name === kind);
    return section ? addParts(to, section.id, { routes: [], stops: [stop] }) : withImportedDay(to, { name: kind, date: null }, [{ routes: [], stops: [stop] }]);
  }, list);
}

/**
 * Keeps the waypoints of the GPX files among `files` as places: in the list `tripId`, or
 * in the folder `folderId` in a list per file, named as the file names itself or after
 * the file, made where the folder has none of that name. In a list, a place goes to the
 * section of its kind, as the file sorts its waypoints, or to “Places” where it has
 * none. A place the list holds already is left out, so that a file can be loaded again
 * when it has grown. Routes and tracks are no places and are left out, which is said.
 */
async function importPlaces(files: readonly ImportSource[], into: { folderId: number | null } | { tripId: number }, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const sources = files.filter((source) => isGpxPath(source.path));
  const errors: string[] = [];
  let kept = 0;
  let known = 0;
  const trips = 'tripId' in into || sources.length === 0 ? [] : await listTrips();
  const lists = new Map<string, number>();
  for (const [n, source] of sources.entries()) {
    onProgress(t('Importing {i} of {n}: {name}', { i: n + 1, n: sources.length, name: source.path }));
    try {
      const file = await source.open();
      const gpx = parseGpx(await file.text());
      if (gpx.routes.length + gpx.tracks.length > 0) errors.push(`${source.path}: ${t('Its routes and tracks were left out: a list holds places.')}`);
      const places = waypointStops(gpx, newId).map((stop, i) => ({ kind: asName(gpx.waypoints[i]!.type ?? '') || t('Places'), stop }));
      if (places.length === 0) continue;
      const name = asName(gpx.name ?? file.name.replace(/\.gpx$/i, '')) || t('Places');
      const tripId = 'tripId' in into ? into.tripId : (lists.get(name) ?? (await collectionIn(trips, into.folderId, name)));
      lists.set(name, tripId);
      let before = 0;
      let after = 0;
      await changeTrip(tripId, (list) => {
        const added = withPlaces(list, places);
        before = list.days.reduce((count, day) => count + day.stops.length, 0);
        after = added.days.reduce((count, day) => count + day.stops.length, 0);
        return added;
      });
      kept += after - before;
      known += places.length - (after - before);
    } catch (error) {
      errors.push(`${source.path}: ${errorMessage(error)}`);
    }
  }
  const texts = [kept > 0 && t('{trips} imported.', { trips: counted(kept, 'place') }), known > 0 && t('{what} kept already.', { what: counted(known, 'place') })].filter(Boolean);
  return { text: texts.length > 0 ? texts.join(' ') : t('No places in there.'), errors };
}

/**
 * Adds GPX files as sections, each named after its file, to the collection “Imported” in
 * the folder `folderId`, made where the folder has none. What cannot be read or saved is
 * reported, and the import goes on.
 */
async function importSections(sources: readonly ImportSource[], folderId: number | null, onProgress: (text: string) => void): Promise<{ sections: number; errors: string[] }> {
  const result = { sections: 0, errors: [] as string[] };
  const sections: { name: string; parts: DayParts }[] = [];
  for (const [n, source] of sources.entries()) {
    onProgress(t('Importing {i} of {n}: {name}', { i: n + 1, n: sources.length, name: source.path }));
    try {
      const file = await source.open();
      const name = file.name.replace(/\.gpx$/i, '');
      sections.push({ name: asName(name), parts: gpxToDayParts(parseGpx(await file.text()), { fileName: name, profile: 'motorcycle', newId }) });
    } catch (error) {
      result.errors.push(`${source.path}: ${errorMessage(error)}`);
    }
  }
  if (sections.length === 0) return result;
  const collection = t('Imported');
  try {
    await changeTrip(await collectionIn(await listTrips(), folderId, collection), (trip) => sections.reduce((to, section) => withImportedDay(to, { name: section.name, date: null }, [section.parts]), trip));
    result.sections = sections.length;
  } catch (error) {
    result.errors.push(`${collection}: ${errorMessage(error)}`);
  }
  return result;
}

/** Imports dropped files as a trip each, and the files in dropped folders organized as `foldersAs` says; exported trips among the folders come back as they were. */
function importTree(loose: readonly ImportSource[], inDropped: readonly ImportSource[], foldersAs: ImportMode, folderId: number | null, onProgress: (text: string) => void) {
  const sources = [...loose, ...inDropped];
  const archives = archiveFolders(inDropped.map((source) => source.path));
  const paths = (of: (i: number) => boolean) => sources.map((source, i) => (of(i) ? source.path : ''));
  const plan = [...planFolderImport(paths((i) => i < loose.length), 'trip-per-file'), ...planFolderImport(paths((i) => i >= loose.length && !inFolders(sources[i]!.path, archives)), foldersAs)];
  return importFolder(sources, plan, archives, folderId, onProgress);
}

/**
 * Adds GPX files to a trip at its end: to a collection a section per file, to a trip the
 * days a folder of the files would make; to a collection among the recordings, as the
 * `kind` of the top folder around it says, as recordings on the sections of their months,
 * and to a list of places as places. The answer says what was added and what could not
 * be read.
 */
export async function importIntoTrip(trip: TripSummary, files: readonly ImportSource[], kind: FolderKind, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  if (kind === 'recordings') return importRecordings(files, { tripId: trip.id }, onProgress);
  if (kind === 'places') return importPlaces(files, { tripId: trip.id }, onProgress);
  const errors: string[] = [];
  const collection = trip.kind === 'collection';
  onProgress(t('Importing {i} of {n}: {name}', { i: 1, n: 1, name: trip.name }));
  const planned = planFolderImport(files.map((file) => file.path), collection ? 'planning-material' : 'trips');
  const days = await readPlannedDays(files, planned.flatMap((trip) => trip.days), !collection, errors);
  if (days.length === 0) return { text: t('No GPX files and no exported trips in there.'), errors };
  await changeTrip(trip.id, (loaded) => days.reduce((to, { day, parts }) => withImportedDay(to, day, parts), loaded));
  return { text: t('{trips} imported.', { trips: counted(days.length, collection ? 'section' : 'day') }), errors };
}

/**
 * Imports what was dropped on the folder `folderId`, null for the top, or picked for it,
 * as the kind of the top folder around it says. Among recordings, every GPX file is kept
 * as a recording in the collection of the year it was recorded in. Among collections, files
 * become sections of the collection “Imported” and a folder of files a collection, in the
 * folders above it. Among places, the waypoints of every GPX file become places of a list.
 * Anywhere else a file becomes a trip, a folder of files a trip of its
 * own, and a folder that also holds folders a folder of trips. The answer says what was
 * made and what could not be read or saved.
 */
export async function importDropped(dropped: Dropped, folderId: number | null, kind: FolderKind, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  if (kind === 'recordings') return importRecordings([...dropped.files, ...dropped.inFolders], { folderId }, onProgress);
  if (kind === 'places') return importPlaces([...dropped.files, ...dropped.inFolders], { folderId }, onProgress);
  const made: string[] = [];
  const errors: string[] = [];
  if (kind === 'collections') {
    const sections = await importSections(dropped.files.filter((source) => isGpxPath(source.path)), folderId, onProgress);
    if (sections.sections > 0) made.push(counted(sections.sections, 'section'));
    errors.push(...sections.errors);
  }
  const trees = await importTree(kind === 'collections' ? [] : dropped.files, dropped.inFolders, kind === 'collections' ? 'planning-material' : 'trips', folderId, onProgress);
  if (trees.trips > 0) made.push(counted(trees.trips, kind === 'collections' ? 'collection' : 'trip'));
  errors.push(...trees.errors);
  if (made.length === 0) return { text: t('No GPX files and no exported trips in there.'), errors };
  return { text: t('{trips} imported.', { trips: made.length > 1 ? t('{a} and {b}', { a: made[0]!, b: made[1]! }) : made[0]! }), errors };
}
