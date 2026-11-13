import type { TripSummary } from '../model/trip';
import { libraryFolders, relistFolders, relistTrips, runLibrary, setImportNote } from '../state/library';
import { pickFiles } from '../ui/pickFile';
import { importDropped, importIntoTrip } from './dropImport';
import { droppedSources, onFileDrop, type Dropped } from './fileDrop';
import { sourceOf, type ImportSource } from './folderImport';
import { kindAround } from './folders';
import { zipEntries } from './zip';

type Outcome = { text: string; errors: string[] };

/**
 * What is imported together: the GPX files and the folders as they are, and each zip
 * among the files as the folders it holds, apart from the rest, since two zips may hold
 * the same paths.
 */
async function unpacked(dropped: Dropped): Promise<Dropped[]> {
  const isZip = (source: ImportSource) => /\.zip$/i.test(source.path);
  const rest: Dropped = { files: dropped.files.filter((source) => !isZip(source)), inFolders: dropped.inFolders };
  const zips: Dropped[] = [];
  for (const zip of dropped.files.filter(isZip)) {
    const entries = await zipEntries(await zip.open());
    zips.push({ files: [], inFolders: entries.map((entry) => ({ path: entry.path, open: async () => new File([await entry.read()], entry.path.slice(entry.path.lastIndexOf('/') + 1)) })) });
  }
  return rest.files.length + rest.inFolders.length > 0 || zips.length === 0 ? [rest, ...zips] : zips;
}

/**
 * The imports the library starts: what is dropped on a folder of the tree, and what is
 * picked from a folder's or a trip's menu. Each says how it goes and then what it made
 * and could not read. The open trip is left first and the library listed afresh after;
 * while one import runs, another is not started.
 */
export function libraryImports(onLeave: () => Promise<void>) {
  let running = false;
  const run = async (work: (onProgress: (text: string) => void) => Promise<Outcome>) => {
    if (running) return;
    running = true;
    await onLeave();
    await runLibrary(async () => setImportNote(await work((text) => setImportNote({ text, errors: [] }))));
    running = false;
    relistFolders();
    relistTrips();
  };
  /** Imports into a folder, null for the top, as the folder's kind says. */
  const intoFolder = (folderId: number | null, dropped: Dropped | Promise<Dropped>) =>
    run(async (onProgress) => {
      const outcomes: Outcome[] = [];
      for (const part of await unpacked(await dropped)) outcomes.push(await importDropped(part, folderId, kindAround(libraryFolders() ?? [], folderId), onProgress));
      return { text: outcomes.map((outcome) => outcome.text).join(' '), errors: outcomes.flatMap((outcome) => outcome.errors) };
    });
  onFileDrop((data, folderId) => void intoFolder(folderId, droppedSources(data)));
  return {
    /** Asks for GPX files and zips of exported trips and imports them into the folder. */
    addFiles: async (folderId: number | null) => {
      const files = await pickFiles({ accept: '.gpx,.zip,application/gpx+xml,application/zip' });
      if (files.length > 0) void intoFolder(folderId, { files: files.map(sourceOf), inFolders: [] });
    },
    /** Asks for a folder and imports all it holds into the folder. */
    addFolder: async (folderId: number | null) => {
      const files = await pickFiles({ folder: true });
      if (files.length > 0) void intoFolder(folderId, { files: [], inFolders: files.map(sourceOf) });
    },
    /** Asks for GPX files and adds them to the trip as days, to the collection as sections, or to a collection among the recordings as recordings. */
    addToTrip: async (trip: TripSummary) => {
      const files = await pickFiles({ accept: '.gpx,application/gpx+xml' });
      if (files.length > 0) void run((onProgress) => importIntoTrip(trip, files.map(sourceOf), kindAround(libraryFolders() ?? [], trip.folderId) === 'recordings', onProgress));
    },
  };
}
