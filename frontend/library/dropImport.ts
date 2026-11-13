import { t } from '../i18n/t';
import { changeTrip, createTrip, errorMessage, listTrips } from '../api';
import { parseGpx, type GpxContent } from '../gpx/gpx';
import { gpxToDayParts, type DayParts } from '../gpx/import';
import { asName, newId, type FolderKind } from '../model/trip';
import { counted } from '../ui/format';
import type { Dropped } from './fileDrop';
import { dateIn, importFolder, isGpxPath, planFolderImport, withImportedDay, type ImportMode, type ImportSource } from './folderImport';
import { archiveFolders, inFolders } from './tripArchive';

/** The year a recording was made in: from its first track point's time, else from a date in the file's name, else from when the file was last changed. */
export function recordedYear(gpx: GpxContent, file: File): string {
  const time = gpx.tracks.find((track) => track.time)?.time;
  return time?.match(/^\d{4}/)?.[0] ?? dateIn(file.name)?.slice(0, 4) ?? String(new Date(file.lastModified).getFullYear());
}

/**
 * Adds GPX files as sections, each named after its file, to collections in the folder
 * `folderId`: the collection `collectionOf` names for the file, made where the folder has
 * none of that name. What cannot be read or saved is reported, and the import goes on.
 */
async function importSections(
  sources: readonly ImportSource[],
  folderId: number | null,
  collectionOf: (gpx: GpxContent, file: File) => string,
  onProgress: (text: string) => void,
): Promise<{ sections: number; errors: string[] }> {
  const result = { sections: 0, errors: [] as string[] };
  const read = new Map<string, { name: string; parts: DayParts }[]>();
  for (const [n, source] of sources.entries()) {
    onProgress(t('Importing {i} of {n}: {name}', { i: n + 1, n: sources.length, name: source.path }));
    try {
      const file = await source.open();
      const gpx = parseGpx(await file.text());
      const name = file.name.replace(/\.gpx$/i, '');
      const collection = asName(collectionOf(gpx, file));
      read.set(collection, [...(read.get(collection) ?? []), { name: asName(name), parts: gpxToDayParts(gpx, { fileName: name, profile: 'motorcycle', newId }) }]);
    } catch (error) {
      result.errors.push(`${source.path}: ${errorMessage(error)}`);
    }
  }
  if (read.size === 0) return result;
  const trips = await listTrips();
  for (const [collection, sections] of read) {
    try {
      const existing = trips.find((trip) => trip.kind === 'collection' && trip.folderId === folderId && trip.name === collection);
      await changeTrip(existing?.id ?? (await createTrip(collection, folderId, 'collection')).id, (trip) => sections.reduce((to, section) => withImportedDay(to, { name: section.name, date: null }, [section.parts]), trip));
      result.sections += sections.length;
    } catch (error) {
      result.errors.push(`${collection}: ${errorMessage(error)}`);
    }
  }
  return result;
}

/** Imports dropped files and folders as picked ones are, the files organized as `files` says and the folders as `folders`; exported trips among the folders come back as they were. */
function importTree(dropped: Dropped, modes: { files?: ImportMode; folders: ImportMode }, folderId: number | null, onProgress: (text: string) => void) {
  const loose = modes.files ? dropped.files : [];
  const sources = [...loose, ...dropped.inFolders];
  const archives = archiveFolders(dropped.inFolders.map((source) => source.path));
  const paths = (of: (i: number) => boolean) => sources.map((source, i) => (of(i) ? source.path : ''));
  const plan = [
    ...(modes.files ? planFolderImport(paths((i) => i < loose.length), modes.files) : []),
    ...planFolderImport(paths((i) => i >= loose.length && !inFolders(sources[i]!.path, archives)), modes.folders),
  ];
  return importFolder(sources, plan, archives, folderId, onProgress);
}

/**
 * Imports what was dropped on the folder `folderId`, null for the top, as the kind of the
 * top folder around it says. Among recordings, every GPX file becomes a section of the
 * collection of the year it was recorded in. Among collections, files become sections of
 * the collection “Imported” and a folder of files a collection, in the folders above it.
 * Anywhere else a file becomes a trip and a folder of files a trip of its own. The
 * answer says what was made and what could not be read or saved.
 */
export async function importDropped(dropped: Dropped, folderId: number | null, kind: FolderKind, onProgress: (text: string) => void): Promise<{ text: string; errors: string[] }> {
  const gpx = (sources: readonly ImportSource[]) => sources.filter((source) => isGpxPath(source.path));
  const made: string[] = [];
  const errors: string[] = [];
  if (kind !== 'folder') {
    const sections = await importSections(kind === 'recordings' ? gpx([...dropped.files, ...dropped.inFolders]) : gpx(dropped.files), folderId, kind === 'recordings' ? recordedYear : () => t('Imported'), onProgress);
    if (sections.sections > 0) made.push(counted(sections.sections, 'section'));
    errors.push(...sections.errors);
  }
  if (kind !== 'recordings') {
    const trees = await importTree(dropped, kind === 'collections' ? { folders: 'planning-material' } : { files: 'trip-per-file', folders: 'trip-per-folder' }, folderId, onProgress);
    if (trees.trips > 0) made.push(counted(trees.trips, kind === 'collections' ? 'collection' : 'trip'));
    errors.push(...trees.errors);
  }
  if (made.length === 0) return { text: t('No GPX files and no exported trips in there.'), errors };
  return { text: t('{trips} imported.', { trips: made.length > 1 ? t('{a} and {b}', { a: made[0]!, b: made[1]! }) : made[0]! }), errors };
}
