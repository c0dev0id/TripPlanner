import { t } from '../i18n/t';
import { changeTrip, createTrip, errorMessage, keepRide, keepStashFile, listTrips } from '../api';
import { readRouteFile, ROUTE_FILE, waypointStops } from '../gpx/import';
import { isGpxText } from '../gpx/gpx';
import { gpxText } from '../gpx/write';
import { asName, newId, type FolderKind, type Stop, type Trip, type TripSummary } from '../model/trip';
import { addParts } from '../routing/dayEdit';
import { recordingName } from '../recording/track';
import { counted } from '../ui/format';
import type { Dropped } from './fileDrop';
import { addDaysAndMedia, foldersUnder, importFolder, isGpxPath, isMediaPath, isRoutePath, planFolderImport, readPlannedDays, withImportedDay, type ImportSource } from './folderImport';
import { archiveFolders, inFolders } from './tripArchive';

/** The collection of the name in the folder: the one among the trips listed, or a new one. */
const collectionIn = async (trips: readonly TripSummary[], folderId: number | null, name: string): Promise<number> =>
  trips.find((trip) => trip.kind === 'collection' && trip.folderId === folderId && trip.name === name)?.id ?? (await createTrip(name, folderId, 'collection')).id;

/** What an import brought, in a sentence: "3 days and 2 attachments imported." */
function importedText(made: readonly (string | false)[]): string {
  const said = made.filter((part) => part !== false);
  const last = said.at(-1)!;
  return t('{trips} imported.', { trips: said.length > 1 ? t('{a} and {b}', { a: said.slice(0, -1).join(', '), b: last }) : last });
}

/** Runs `work` on each file in turn, saying how far the import is; what fails is reported under the file's path, and the import goes on. */
async function eachFile(sources: readonly ImportSource[], onProgress: (text: string) => void, errors: string[], work: (source: ImportSource) => Promise<void>): Promise<void> {
  for (const [n, source] of sources.entries()) {
    onProgress(t('Importing {i} of {n}: {name}', { i: n + 1, n: sources.length, name: source.path }));
    try {
      await work(source);
    } catch (error) {
      errors.push(`${source.path}: ${errorMessage(error)}`);
    }
  }
}

/** How many of a noun were kept and how many were there already, or `none` where there were neither. */
export function keptText(kept: number, known: number, noun: string, none: string): string {
  const texts = [kept > 0 && t('{trips} imported.', { trips: counted(kept, noun) }), known > 0 && t('{what} kept already.', { what: counted(known, noun) })].filter(Boolean);
  return texts.length > 0 ? texts.join(' ') : none;
}

/**
 * Keeps the GPX files among `files`, of one track each, as rides, the files as they are,
 * each named after its track or else its file. A file the user keeps already is left
 * out. The answer says how many were kept and how many were there already, and what
 * could not be read or kept; the import goes on past those.
 */
export async function importRides(files: readonly ImportSource[], onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const errors: string[] = [];
  let kept = 0;
  let known = 0;
  await eachFile(files.filter((source) => isGpxPath(source.path)), onProgress, errors, async (source) => {
    const file = await source.open();
    const gpx = await file.text();
    const { added } = await keepRide(asName(recordingName(gpx) ?? file.name.replace(/\.gpx$/i, '')) || t('Recording'), gpx);
    if (added) kept++;
    else known++;
  });
  return { text: keptText(kept, known, 'ride', t('No GPX files in there.')), errors };
}

/** A place to be kept, with the kind it is of. */
interface KindedPlace {
  kind: string;
  stop: Stop;
}

/** The places the list does not hold yet, by their name where they stand, each once. */
function newPlaces(list: Trip, places: readonly KindedPlace[]): KindedPlace[] {
  const at = (stop: Stop) => `${stop.name}|${stop.lngLat.join(',')}`;
  const held = new Set(list.days.flatMap((day) => day.stops.map(at)));
  return places.filter(({ stop }) => {
    const key = at(stop);
    if (held.has(key)) return false;
    held.add(key);
    return true;
  });
}

/** The list with the places added, those of a kind to its section, made where the list has none of that name. */
function withPlaces(list: Trip, places: readonly KindedPlace[]): Trip {
  const byKind = new Map<string, Stop[]>();
  for (const { kind, stop } of places) {
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind)!.push(stop);
  }
  return [...byKind].reduce((to, [kind, stops]) => {
    const section = to.days.find((day) => day.name === kind);
    return section ? addParts(to, section.id, { routes: [], stops }) : withImportedDay(to, { name: kind, date: null }, [{ routes: [], stops }]);
  }, list);
}

/**
 * Keeps the files of routes among what was dropped on a folder of the Stash, or picked
 * for it: a GPX file as it is, a KML or KMZ file as the GPX it is turned into, each
 * named after its file. The files of a dropped folder go into folders as their paths
 * say, made where the Stash has none of the name. A file kept already, wherever in the
 * Stash, is left out, and so is any other kind of file. The answer says how many were
 * kept and how many were there already, and what could not be read or kept.
 */
export async function importIntoStash(dropped: Dropped, folderId: number, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const errors: string[] = [];
  let kept = 0;
  let known = 0;
  const folderIn = await foldersUnder(folderId);
  await eachFile([...dropped.files, ...dropped.inFolders].filter((source) => isRoutePath(source.path)), onProgress, errors, async (source) => {
    const file = await source.open();
    // A file named as GPX is kept as it is where it is one; one that holds KML under that name is turned into GPX as a KML file is.
    const text = isGpxPath(source.path) ? await file.text() : '';
    const gpx = isGpxText(text) ? text : gpxText(await readRouteFile(file));
    // A file dropped loose has no folders in its path and goes into the folder itself.
    const folder = await folderIn(source.path.split('/').slice(0, -1).map(asName));
    const { added } = await keepStashFile(folder, asName(file.name.replace(ROUTE_FILE, '')) || t('File'), gpx);
    if (added) kept++;
    else known++;
  });
  return { text: keptText(kept, known, 'file', t('No GPX or KML files in there.')), errors };
}

/**
 * Keeps the waypoints of the files of routes among `files` as places: in the list `tripId`, or
 * in the folder `folderId` in a list per file, named as the file names itself or after
 * the file, made where the folder has none of that name. In a list, a place goes to the
 * section of its kind, as the file sorts its waypoints, or to “Places” where it has
 * none. A place the list holds already is left out, so that a file can be loaded again
 * when it has grown. Routes and tracks are no places and are left out, which is said.
 */
async function importPlaces(files: readonly ImportSource[], into: { folderId: number | null } | { tripId: number }, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const sources = files.filter((source) => isRoutePath(source.path));
  const errors: string[] = [];
  let kept = 0;
  let known = 0;
  const trips = 'tripId' in into || sources.length === 0 ? [] : await listTrips();
  const lists = new Map<string, number>();
  await eachFile(sources, onProgress, errors, async (source) => {
    const file = await source.open();
    const gpx = await readRouteFile(file);
    if (gpx.routes.length + gpx.tracks.length > 0) errors.push(`${source.path}: ${t('Its routes and tracks were left out: a list holds places.')}`);
    const places = waypointStops(gpx, newId).map((stop, i) => ({ kind: asName(gpx.waypoints[i]!.type ?? '') || t('Places'), stop }));
    if (places.length === 0) return;
    const name = asName(gpx.name ?? file.name.replace(ROUTE_FILE, '')) || t('Places');
    const tripId = 'tripId' in into ? into.tripId : (lists.get(name) ?? (await collectionIn(trips, into.folderId, name)));
    lists.set(name, tripId);
    let added: KindedPlace[] = [];
    await changeTrip(tripId, (list) => withPlaces(list, (added = newPlaces(list, places))));
    kept += added.length;
    known += places.length - added.length;
  });
  return { text: keptText(kept, known, 'place', t('No places in there.')), errors };
}

/** Imports dropped files as a trip each, and the files in dropped folders as trips by their folders; exported trips among the folders come back as they were. */
function importTree(loose: readonly ImportSource[], inDropped: readonly ImportSource[], folderId: number | null, onProgress: (text: string) => void) {
  const sources = [...loose, ...inDropped];
  const archives = archiveFolders(inDropped.map((source) => source.path));
  const paths = (of: (i: number) => boolean) => sources.map((source, i) => (of(i) ? source.path : ''));
  const plan = [...planFolderImport(paths((i) => i < loose.length), 'trip-per-file'), ...planFolderImport(paths((i) => i >= loose.length && !inFolders(sources[i]!.path, archives)), 'trips')];
  return importFolder(sources, plan, archives, folderId, onProgress);
}

/**
 * Adds files to a trip: the days a folder of the files would make, at its end, and any
 * other file as media with its first day; to a list of places, as the `kind` of the top
 * folder around it says, the files' waypoints as places. The answer says what was added
 * and what could not be read.
 */
export async function importIntoTrip(trip: TripSummary, files: readonly ImportSource[], kind: FolderKind, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  if (kind === 'places') return importPlaces(files, { tripId: trip.id }, onProgress);
  const errors: string[] = [];
  onProgress(t('Importing {i} of {n}: {name}', { i: 1, n: 1, name: trip.name }));
  const planned = planFolderImport(files.map((file) => file.path), 'trips');
  const days = await readPlannedDays(files, planned.flatMap((trip) => trip.days), errors);
  const media = files.filter((file) => isMediaPath(file.path));
  if (days.length + media.length === 0) return { text: t('No GPX or KML files and no exported trips in there.'), errors };
  if (!(await addDaysAndMedia(trip.id, days, media, errors))) errors.push(t('The trip has no day to keep files with.'));
  return { text: importedText([days.length > 0 && counted(days.length, 'day'), media.length > 0 && counted(media.length, 'attachment')]), errors };
}

/**
 * Imports what was dropped on the folder `folderId`, null for the top, or picked for it,
 * as the kind of the top folder around it says. In the Stash the files of routes are
 * kept as files. Among places, the waypoints of every GPX file become places of a list.
 * Anywhere else a file becomes a trip, a folder of files a trip of its own, and a folder
 * that also holds folders a folder of trips. The answer says what was made and what
 * could not be read or saved.
 */
export async function importDropped(dropped: Dropped, folderId: number | null, kind: FolderKind, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  if (kind === 'places') return importPlaces([...dropped.files, ...dropped.inFolders], { folderId }, onProgress);
  if (kind === 'collections') return importIntoStash(dropped, folderId!, onProgress);
  const trees = await importTree(dropped.files, dropped.inFolders, folderId, onProgress);
  if (trees.trips === 0) return { text: t('No GPX or KML files and no exported trips in there.'), errors: trees.errors };
  return { text: importedText([counted(trees.trips, 'trip')]), errors: trees.errors };
}
