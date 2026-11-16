import { t } from '../i18n/t';
import { fetchStashGpx, fetchStashMedia } from '../api';
import { filesIn } from '../model/paste';
import type { LngLat, TripSummary } from '../model/trip';
import { libraryFolders, relistFolders, relistTrips, runLibrary, setImportNote, showTab } from '../state/library';
import type { CopiedFolder, StashFile } from '../model/stash';
import { listKeptFiles, relistStash, stashFiles } from '../state/stash';
import { runRidesJob } from '../state/rides';
import { counted } from '../ui/format';
import { pickFiles } from '../ui/pickFile';
import { importDropped, importIntoTrip, importRides } from './dropImport';
import { droppedSources, onFileDrop, type Dropped } from './fileDrop';
import { importFolder, sourceOf, type ImportSource } from './folderImport';
import { ends } from './grouping';
import { planStashDays, planStashTrips } from './stashTrips';
import { kindAround } from '../model/folders';
import { ROUTE_FILE_TYPES } from '../gpx/import';
import { zipEntries } from '../gpx/zip';

type Outcome = { text: string; errors: string[] };

/** How often a running import lists what it has kept so far. */
const RELIST_EVERY_MS = 10_000;

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

/** A file of the Stash as a source to import: its GPX as the Stash keeps it, under its name, with its media, each read when it is needed. */
const stashSource = (file: StashFile): ImportSource => {
  const name = `${file.name.replaceAll('/', '_')}.gpx`;
  return { path: name, open: async () => new File([await fetchStashGpx(file.id)], name), media: file.media.map((one) => ({ path: `${file.name}: ${one.name}`, open: () => fetchStashMedia(file.id, one) })) };
};

/** Where the files of the Stash start, by which a ride there and back is known to start at home. */
const departures = (): LngLat[] =>
  (stashFiles() ?? []).flatMap((file) => {
    const { start } = ends(file);
    return start ? [start] : [];
  });

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
  const run = async (work: (onProgress: (text: string) => void, onKept: (file: StashFile) => void) => Promise<Outcome>) => {
    if (running) return;
    running = true;
    await onLeave();
    // A long import shows what it has kept so far: now and then while it runs, the folders are listed afresh and the files the Stash kept meanwhile are listed after the others.
    const kept: StashFile[] = [];
    let listedAt = Date.now();
    const onProgress = (text: string) => {
      setImportNote({ text, errors: [] });
      if (Date.now() - listedAt < RELIST_EVERY_MS) return;
      listedAt = Date.now();
      relistFolders();
      if (kept.length > 0) listKeptFiles(kept.splice(0));
    };
    await runLibrary(async () => setImportNote(await work(onProgress, (file) => kept.push(file))));
    running = false;
    relistFolders();
    relistTrips();
    relistStash();
  };
  /** Imports into a folder, null for the top, as the folder's kind says. */
  const intoFolder = (folderId: number | null, dropped: Dropped | Promise<Dropped>) =>
    run(async (onProgress, onKept) => {
      const outcomes: Outcome[] = [];
      for (const part of await unpacked(await dropped)) outcomes.push(await importDropped(part, folderId, kindAround(libraryFolders() ?? [], folderId), onProgress, onKept));
      return { text: outcomes.map((outcome) => outcome.text).join(' '), errors: outcomes.flatMap((outcome) => outcome.errors) };
    });
  onFileDrop(
    (data, folderId) => void intoFolder(folderId, droppedSources(data)),
    (data) => void addRides(droppedSources(data)),
  );
  /** Adds files to a trip, as its kind says: files of routes as days and any other file as media; to a list of places the waypoints as places. */
  const intoTrip = (trip: TripSummary, files: readonly ImportSource[]) => {
    const kind = kindAround(libraryFolders() ?? [], trip.folderId);
    return run((onProgress) => importIntoTrip(trip, files, kind, onProgress));
  };
  return {
    /** Imports files of the Stash into the folder, as files picked for it are: each a trip, or among the places a list of its waypoints. */
    pasteFiles: (folderId: number | null, files: readonly StashFile[]) => intoFolder(folderId, { files: files.map(stashSource), inFolders: [] }),
    /** Makes trips of files and folders of the Stash in the folder, null for the top: a file a trip of one day, a folder a trip of its files or a folder of trips (see planStashTrips). */
    pasteAsTrips: (folderId: number | null, files: readonly StashFile[], folders: readonly CopiedFolder[]) =>
      run(async (onProgress) => {
        const planned = planStashTrips(folders, files, departures());
        const made = await importFolder(planned.files.map(stashSource), planned.plan, [], folderId, onProgress);
        return { text: made.trips > 0 ? t('{trips} imported.', { trips: counted(made.trips, 'trip') }) : t('No GPX or KML files or exported trips found.'), errors: made.errors };
      }),
    /** Adds files of the Stash, and those in the folders copied with them, to the trip as days, made of the files as a folder pasted among the trips makes its trip's (see daysOf). */
    pasteAsDays: (trip: TripSummary, files: readonly StashFile[], folders: readonly CopiedFolder[]) => {
      const all = [...files, ...folders.flatMap(filesIn)];
      return run((onProgress) => importIntoTrip(trip, all.map(stashSource), 'folder', onProgress, planStashDays(all, departures())));
    },
    /** Keeps the waypoints of files of the Stash as places of the list, as those of files picked for it are. */
    pasteFilesIntoList: (list: TripSummary, files: readonly StashFile[]) => run((onProgress) => importIntoTrip(list, files.map(stashSource), 'places', onProgress)),
    /** Asks for files of routes and zips, of exported trips or of such files, and imports them into the folder. */
    addFiles: async (folderId: number | null) => {
      const files = await pickFiles({ accept: `${ROUTE_FILE_TYPES},.zip,application/zip` });
      if (files.length > 0) void intoFolder(folderId, { files: files.map(sourceOf), inFolders: [] });
    },
    /** Asks for a folder and imports all it holds into the folder. */
    addFolder: async (folderId: number | null) => {
      const files = await pickFiles({ folder: true });
      if (files.length > 0) void intoFolder(folderId, { files: [], inFolders: files.map(sourceOf) });
    },
    /**
     * Asks for files and adds them to the trip: files of routes as days and any other
     * file as media; to a list of places the waypoints of files of routes as places.
     */
    addToTrip: async (trip: TripSummary) => {
      const files = await pickFiles(kindAround(libraryFolders() ?? [], trip.folderId) === 'places' ? { accept: ROUTE_FILE_TYPES } : {});
      if (files.length > 0) void intoTrip(trip, files.map(sourceOf));
    },
  };
}
