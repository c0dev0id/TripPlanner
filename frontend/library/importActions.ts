import type { TripSummary } from '../model/trip';
import { libraryFolders, relistFolders, relistTrips, runLibrary, setImportNote, showTab } from '../state/library';
import { runRidesJob } from '../state/rides';
import { pickFiles } from '../ui/pickFile';
import { importDropped, importIntoTrip, importRides } from './dropImport';
import { droppedSources, onFileDrop, type Dropped } from './fileDrop';
import { sourceOf, type ImportSource } from './folderImport';
import { kindAround } from './folders';
import { ROUTE_FILE_TYPES } from '../gpx/import';
import { zipEntries } from '../gpx/zip';

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

/** Keeps the GPX files dropped or picked as rides and shows the rides, where it is said how it goes. */
export function addRides(dropped: Dropped | Promise<Dropped>): Promise<void> {
  showTab('recordings');
  return runRidesJob(async (onProgress) => {
    const { files, inFolders } = await dropped;
    return importRides([...files, ...inFolders], onProgress);
  });
}

/**
 * The imports the library starts: what is dropped on a folder of the tree, and what is
 * picked from a folder's or a trip's menu; GPX files dropped on the library while it
 * shows the rides are handed to those. Each says how it goes and then what it made
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
  onFileDrop(
    (data, folderId) => void intoFolder(folderId, droppedSources(data)),
    (data) => void addRides(droppedSources(data)),
  );
  return {
    /** Asks for files of routes and zips of exported trips, among the collections for any file, and imports them into the folder. */
    addFiles: async (folderId: number | null) => {
      const kind = kindAround(libraryFolders() ?? [], folderId);
      const files = await pickFiles(kind === 'collections' ? {} : { accept: `${ROUTE_FILE_TYPES},.zip,application/zip` });
      if (files.length > 0) void intoFolder(folderId, { files: files.map(sourceOf), inFolders: [] });
    },
    /** Asks for a folder and imports all it holds into the folder. */
    addFolder: async (folderId: number | null) => {
      const files = await pickFiles({ folder: true });
      if (files.length > 0) void intoFolder(folderId, { files: [], inFolders: files.map(sourceOf) });
    },
    /**
     * Asks for files and adds them to the trip: files of routes as days, to a collection
     * as sections, and any other file as media; to a list of places the waypoints of
     * files of routes as places.
     */
    addToTrip: async (trip: TripSummary) => {
      const kind = kindAround(libraryFolders() ?? [], trip.folderId);
      const files = await pickFiles(kind === 'places' ? { accept: ROUTE_FILE_TYPES } : {});
      if (files.length > 0) void run((onProgress) => importIntoTrip(trip, files.map(sourceOf), kind, onProgress));
    },
  };
}
