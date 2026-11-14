import { t } from '../i18n/t';
import { addMedia, changeTrip, createFolder, createTrip, errorMessage, listFolders } from '../api';
import { readDayParts, ROUTE_FILE, type DayParts } from '../gpx/import';
import { asName, newId, type Trip, type TripKind } from '../model/trip';
import { addDay, addParts, dayAfter, updateDay } from '../routing/dayEdit';
import { importArchive } from './tripArchive';

/**
 * How a folder tree is organized: a trip per folder that holds GPX files alone, with a
 * day per file or date, and a trip per file of a folder that also holds folders of them;
 * a trip per file, the folders plain folders; or planning material, a collection per
 * folder of GPX files with a section per file.
 */
export type ImportMode = 'trips' | 'trip-per-file' | 'planning-material';

/** A trip or a collection the import makes. */
export interface PlannedTrip {
  kind: TripKind;
  /** The names of the folders it goes into, from the picked folder down. */
  folders: string[];
  name: string;
  days: PlannedDay[];
  /** The other files of its folder, kept with it as media, as indexes into the paths planned from. */
  media: number[];
}

export interface PlannedDay {
  date: string | null;
  name: string;
  /** The day's files, as indexes into the paths planned from. */
  files: number[];
}

/**
 * The first real date in a name, as YYYY-MM-DD, with the text it was written as: YYYYMMDD
 * at the start of the name, or YYYY-MM-DD or YYYY_MM_DD anywhere in it.
 */
function findDate(name: string): { date: string; text: string } | undefined {
  const written = [...name.matchAll(/^(\d{4})(\d{2})(\d{2})(?!\d)/g), ...name.matchAll(/(\d{4})([-_])(\d{2})\2(\d{2})/g)].sort((a, b) => a.index - b.index);
  for (const match of written) {
    const [year, month, day] = match.length === 4 ? match.slice(1) : [match[1], match[3], match[4]];
    const date = `${year}-${month}-${day}`;
    if (new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0, 10) === date) return { date, text: match[0] };
  }
  return undefined;
}

/** The first real date in a name, as YYYY-MM-DD; see findDate for how it may be written. */
export const dateIn = (name: string): string | undefined => findDate(name)?.date;

/** The name without its date and the separators around it; empty where nothing else is left. */
function withoutDate(name: string): string {
  const found = findDate(name);
  const rest = found ? name.replace(found.text, ' ') : name;
  return rest.replace(/^[\s_.,–-]+|[\s_.,–-]+$/g, '').replace(/\s{2,}/g, ' ');
}

/** Names in the order a person reads them: "day 2" before "day 10". */
const byName = new Intl.Collator(undefined, { numeric: true }).compare;

/**
 * A picked file's path within the picked folder, its name alone where the browser gives
 * none; composed (NFC), since macOS writes names decomposed and names must compare as typed.
 */
export const pickedPath = (file: File): string => (file.webkitRelativePath || file.name).normalize('NFC');

/**
 * Finds the folder the names lead to from the folder `parentId` down, null for the top,
 * making each one the library has none of; it lists the folders once and remembers
 * those it makes.
 */
export async function foldersUnder<Top extends number | null>(parentId: Top): Promise<(names: readonly string[]) => Promise<number | Top>> {
  const folders = await listFolders();
  return async (names) => {
    let id: number | Top = parentId;
    for (const name of names) {
      // The special folders are no match for a folder of the tree that happens to have their name.
      const found = folders.find((f) => f.parentId === id && f.name === name && f.kind === 'folder');
      const folder = found ?? (await createFolder(name, id));
      if (!found) folders.push(folder);
      id = folder.id;
    }
    return id;
  };
}

/** A file to import by its path in the folder picked or in the zip, read when it is needed. */
export interface ImportSource {
  path: string;
  open: () => Promise<File>;
}

/** A picked or dropped file as a source. */
export const sourceOf = (file: File): ImportSource => ({ path: pickedPath(file), open: async () => file });

/** Whether the path is a GPX file's that is not hidden. */
export const isGpxPath = (path: string): boolean => /^[^.][^/]*\.gpx$/i.test(path.slice(path.lastIndexOf('/') + 1));

/** Whether the path is that of a file routes are read from, GPX, KML or KMZ, that is not hidden. */
export const isRoutePath = (path: string): boolean => /^[^.][^/]*$/.test(path.slice(path.lastIndexOf('/') + 1)) && ROUTE_FILE.test(path);

/** Whether the path names a file kept as media: any that is neither hidden nor a file of routes. */
export const isMediaPath = (path: string): boolean => /^[^.][^/]*$/.test(path.slice(path.lastIndexOf('/') + 1)) && !ROUTE_FILE.test(path);

/**
 * The trips or collections a picked folder tree makes, from the files' paths relative to
 * it, organized as `mode` says: the GPX files in name order, hidden files left out. The
 * other files of a folder that makes one trip or collection are its media; beside trips
 * made a file each they are left out. The names are fitted to what the library holds.
 */
export function planFolderImport(paths: readonly string[], mode: ImportMode): PlannedTrip[] {
  const byFolder = new Map<string, number[]>();
  const mediaIn = new Map<string, number[]>();
  /** The file names without their extension, by path. */
  const stems: string[] = [];
  paths.forEach((path, i) => {
    const cut = path.lastIndexOf('/');
    const file = path.slice(cut + 1);
    const folder = path.slice(0, Math.max(0, cut));
    if (isMediaPath(path)) mediaIn.set(folder, [...(mediaIn.get(folder) ?? []), i]);
    if (!isRoutePath(path)) return;
    stems[i] = file.replace(ROUTE_FILE, '');
    if (byFolder.has(folder)) byFolder.get(folder)!.push(i);
    else byFolder.set(folder, [i]);
  });
  const stem = (i: number) => stems[i]!;
  const folders = [...byFolder.keys()].sort(byName);
  /** Whether the folder also holds folders of GPX files, at any depth: it is then no trip itself, but a folder of trips. */
  const holdsFolders = (folder: string) => folders.some((other) => other !== folder && other.startsWith(folder === '' ? '' : `${folder}/`));
  const planned = folders.flatMap((folder) => {
    const segments = folder.split('/');
    const files = byFolder.get(folder)!.sort((a, b) => byName(stem(a), stem(b)));
    const media = mediaIn.get(folder) ?? [];
    if (mode === 'planning-material') return [{ ...collectionOfFolder(segments, files, stem), media }];
    if (mode === 'trip-per-file' || holdsFolders(folder)) return files.map((i) => tripOfFile(segments.filter(Boolean), stem(i), i));
    return [{ ...tripOfFolder(segments, files, stem), media }];
  });
  return planned.map((t) => ({ ...t, folders: t.folders.map(asName), name: asName(t.name), days: t.days.map((d) => ({ ...d, name: asName(d.name) })) }));
}

/**
 * A folder of GPX files as a trip, named after it without its date, inside the folders
 * above it. Files with a date in their name make one day per date; the others a day each,
 * dated on from the folder's date after the dated days, or undated where the folder has
 * none. Days follow their dates, undated ones last.
 */
export function tripOfFolder(segments: string[], files: number[], stem: (i: number) => string): PlannedTrip {
  const folderName = segments.at(-1)!;
  const dated = new Map<string, number[]>();
  const undated: number[] = [];
  for (const i of files) {
    const date = dateIn(stem(i));
    if (!date) undated.push(i);
    else if (dated.has(date)) dated.get(date)!.push(i);
    else dated.set(date, [i]);
  }
  const dayOf = (date: string | null, of: number[]): PlannedDay => ({ date, name: of.length === 1 ? withoutDate(stem(of[0]!)) : '', files: of });
  const days = [...dated.keys()].sort().map((date) => dayOf(date, dated.get(date)!));
  const start = dateIn(folderName);
  const lastDated = days.at(-1)?.date;
  let next = start && (lastDated && lastDated >= start ? dayAfter(lastDated) : start);
  for (const i of undated) {
    days.push(dayOf(next ?? null, [i]));
    if (next) next = dayAfter(next);
  }
  return { kind: 'trip', folders: segments.slice(0, -1), name: withoutDate(folderName) || folderName || t('Imported trip'), days, media: [] };
}

/** A GPX file as a trip of one day, named after the file without its date, dated by it; in the folders it is in. */
function tripOfFile(folders: string[], stem: string, file: number): PlannedTrip {
  return { kind: 'trip', folders, name: withoutDate(stem) || stem, days: [{ date: dateIn(stem) ?? null, name: '', files: [file] }], media: [] };
}

/** A folder of GPX files as a collection named after it, inside the folders above it, with a section per file named after it. */
function collectionOfFolder(segments: string[], files: number[], stem: (i: number) => string): PlannedTrip {
  return { kind: 'collection', folders: segments.slice(0, -1), name: segments.at(-1) || t('Imported'), days: files.map((i) => ({ date: null, name: stem(i), files: [i] })), media: [] };
}

/** The trip with a day added at its end, named and dated, holding what the GPX files gave. */
export function withImportedDay(trip: Trip, day: { name: string; date: string | null }, parts: readonly DayParts[]): Trip {
  const id = newId();
  return parts.reduce((to, p) => addParts(to, id, p), updateDay(addDay(trip, id), id, (d) => ({ ...d, name: day.name, date: day.date })));
}

/**
 * Where the files that come with a trip are kept: with a trip's first day, none where it
 * has no day; in a collection in the section for them, found by its name or added at the end.
 */
export function withMediaDay(trip: Trip): { trip: Trip; dayId: string | undefined } {
  const named = t('Additional Media');
  const found = trip.kind === 'trip' ? trip.days[0] : trip.days.find((day) => day.name === named);
  if (found || trip.kind === 'trip') return { trip, dayId: found?.id };
  const made = withImportedDay(trip, { name: named, date: null }, []);
  return { trip: made, dayId: made.days.at(-1)!.id };
}

/**
 * Adds the days read from files to the trip and keeps the other files with it, where
 * withMediaDay says; a file the server does not take is reported, and the rest goes on.
 * Whether a day was there to keep them with.
 */
export async function addDaysAndMedia(tripId: number, days: readonly { day: PlannedDay; parts: DayParts[] }[], media: readonly ImportSource[], errors: string[]): Promise<boolean> {
  let mediaDay: string | undefined;
  await changeTrip(tripId, (trip) => {
    const filled = days.reduce((to, { day, parts }) => withImportedDay(to, day, parts), trip);
    if (media.length === 0) return filled;
    const kept = withMediaDay(filled);
    mediaDay = kept.dayId;
    return kept.trip;
  });
  if (!mediaDay) return media.length === 0;
  for (const source of media) {
    try {
      await addMedia(tripId, mediaDay, await source.open());
    } catch (error) {
      errors.push(`${source.path}: ${errorMessage(error)}`);
    }
  }
  return true;
}

/**
 * The planned days with what their GPX files hold, read now; a file that cannot be read is
 * reported, and a day left without one is left out. For a trip (`ofTrip`), so is a file of
 * waypoints alone: it is a list of places, and no day to ride.
 */
export async function readPlannedDays(sources: readonly ImportSource[], planned: readonly PlannedDay[], ofTrip: boolean, errors: string[]): Promise<{ day: PlannedDay; parts: DayParts[] }[]> {
  const days: { day: PlannedDay; parts: DayParts[] }[] = [];
  for (const day of planned) {
    const parts: DayParts[] = [];
    for (const i of day.files) {
      const source = sources[i]!;
      try {
        const read = await readDayParts(await source.open(), 'motorcycle');
        if (ofTrip && read.routes.length === 0 && read.stops.length > 0) throw new Error(t('This file holds places and no route: add it to the folder for places.'));
        parts.push(read);
      } catch (error) {
        errors.push(`${source.path}: ${errorMessage(error)}`);
      }
    }
    if (parts.length > 0) days.push({ day, parts });
  }
  return days;
}

/** What an import did: how many trips or collections it made, and what it could not read or save. */
interface ImportResult {
  trips: number;
  errors: string[];
}

/**
 * Makes the planned trips from the sources, and the trips exported into the folders
 * `archives` anew, inside the folder `parentId` (none for the top): the folders each goes
 * into are found by name or created, the trip is created and its days saved as one
 * document, the other files of its folder kept with it as media. A day or a trip left
 * without a GPX file is left out; what cannot be read or saved is reported, and the
 * import goes on.
 */
export async function importFolder(
  sources: readonly ImportSource[],
  plan: readonly PlannedTrip[],
  archives: readonly string[],
  parentId: number | null,
  onProgress: (text: string) => void,
): Promise<ImportResult> {
  const result: ImportResult = { trips: 0, errors: [] };
  if (plan.length + archives.length === 0) return result;
  const folderIn = await foldersUnder(parentId);
  const total = plan.length + archives.length;
  const byPath = new Map(sources.map((source) => [source.path, source]));
  for (const [n, folder] of archives.entries()) {
    const above = folder.split('/');
    const name = above.pop()!;
    onProgress(t('Importing {i} of {n}: {name}', { i: n + 1, n: total, name }));
    try {
      await importArchive(async (path) => byPath.get(folder === '' ? path : `${folder}/${path}`)?.open(), await folderIn(above.map(asName)), result.errors);
      result.trips++;
    } catch (error) {
      result.errors.push(`${folder}: ${errorMessage(error)}`);
    }
  }
  for (const [n, planned] of plan.entries()) {
    onProgress(t('Importing {i} of {n}: {name}', { i: archives.length + n + 1, n: total, name: planned.name }));
    const days = await readPlannedDays(sources, planned.days, planned.kind === 'trip', result.errors);
    if (days.length === 0) continue;
    try {
      const tripId = (await createTrip(planned.name, await folderIn(planned.folders), planned.kind)).id;
      await addDaysAndMedia(tripId, days, planned.media.map((i) => sources[i]!), result.errors);
      result.trips++;
    } catch (error) {
      result.errors.push(`${[...planned.folders, planned.name].join(' / ')}: ${errorMessage(error)}`);
    }
  }
  return result;
}
