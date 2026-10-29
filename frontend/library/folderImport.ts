import { createFolder, createTrip, errorMessage, fetchTrip, listFolders, saveTrip } from '../api';
import { readGpxFile, type DayParts } from '../gpx/import';
import { newId, type TripKind } from '../model/trip';
import { addDay, addParts, dayAfter, updateDay } from '../routing/dayEdit';

/**
 * How a picked folder tree is organized: a trip per folder of GPX files with a day per
 * file or date; a trip per file, the folders plain folders; or planning material, a
 * collection per folder of GPX files with a section per file.
 */
export type ImportMode = 'trip-per-folder' | 'trip-per-file' | 'planning-material';

/** A trip or a collection the import makes. */
export interface PlannedTrip {
  kind: TripKind;
  /** The names of the folders it goes into, from the picked folder down. */
  folders: string[];
  name: string;
  days: PlannedDay[];
}

interface PlannedDay {
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
 * The trips or collections a picked folder tree makes, from the files' paths relative to
 * it, organized as `mode` says; hidden files and files that are no GPX are left out, the
 * rest taken in name order.
 */
export function planFolderImport(paths: readonly string[], mode: ImportMode): PlannedTrip[] {
  const byFolder = new Map<string, number[]>();
  /** The file names without their extension, by path. */
  const stems: string[] = [];
  paths.forEach((path, i) => {
    const cut = path.lastIndexOf('/');
    const file = path.slice(cut + 1);
    if (file.startsWith('.') || !/\.gpx$/i.test(file)) return;
    stems[i] = file.slice(0, -'.gpx'.length);
    const folder = path.slice(0, Math.max(0, cut));
    if (byFolder.has(folder)) byFolder.get(folder)!.push(i);
    else byFolder.set(folder, [i]);
  });
  const stem = (i: number) => stems[i]!;
  return [...byFolder.keys()].sort(byName).flatMap((folder) => {
    const segments = folder.split('/');
    const files = byFolder.get(folder)!.sort((a, b) => byName(stem(a), stem(b)));
    if (mode === 'trip-per-file') return files.map((i) => tripOfFile(segments.filter(Boolean), stem(i), i));
    if (mode === 'planning-material') return [collectionOfFolder(segments, files, stem)];
    return [tripOfFolder(segments, files, stem)];
  });
}

/**
 * A folder of GPX files as a trip, named after it without its date, inside the folders
 * above it. Files with a date in their name make one day per date; the others a day each,
 * dated on from the folder's date after the dated days, or undated where the folder has
 * none. Days follow their dates, undated ones last.
 */
function tripOfFolder(segments: string[], files: number[], stem: (i: number) => string): PlannedTrip {
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
  return { kind: 'trip', folders: segments.slice(0, -1), name: withoutDate(folderName) || folderName || 'Imported trip', days };
}

/** A GPX file as a trip of one day, named after the file without its date, dated by it; in the folders it is in. */
function tripOfFile(folders: string[], stem: string, file: number): PlannedTrip {
  return { kind: 'trip', folders, name: withoutDate(stem) || stem, days: [{ date: dateIn(stem) ?? null, name: '', files: [file] }] };
}

/** A folder of GPX files as a collection named after it, inside the folders above it, with a section per file named after it. */
function collectionOfFolder(segments: string[], files: number[], stem: (i: number) => string): PlannedTrip {
  return { kind: 'collection', folders: segments.slice(0, -1), name: segments.at(-1) || 'Imported collection', days: files.map((i) => ({ date: null, name: stem(i), files: [i] })) };
}

/** What an import did: how many trips or collections it made, and what it could not read or save. */
interface ImportResult {
  trips: number;
  errors: string[];
}

/**
 * Makes the planned trips from the picked files inside the folder `parentId` (none for the
 * top): the folders each goes into are found by name or created, the trip is created and
 * its days saved as one document. A file that is no GPX is left out, as is a day or a trip
 * left without one; what cannot be read or saved is reported, and the import goes on.
 */
export async function importFolder(files: readonly File[], plan: readonly PlannedTrip[], parentId: number | null, onProgress: (text: string) => void): Promise<ImportResult> {
  const folders = await listFolders();
  const folderIn = async (parent: number | null, name: string): Promise<number> => {
    const found = folders.find((f) => f.parentId === parent && f.name === name);
    if (found) return found.id;
    const made = await createFolder(name, parent);
    folders.push(made);
    return made.id;
  };
  const result: ImportResult = { trips: 0, errors: [] };
  for (const [n, planned] of plan.entries()) {
    onProgress(`Importing ${n + 1} of ${plan.length}: ${planned.name}`);
    const days: { day: PlannedDay; parts: DayParts[] }[] = [];
    for (const day of planned.days) {
      const parts: DayParts[] = [];
      for (const i of day.files) {
        const file = files[i]!;
        try {
          parts.push(await readGpxFile(file, 'motorcycle'));
        } catch (error) {
          result.errors.push(`${pickedPath(file)}: ${errorMessage(error)}`);
        }
      }
      if (parts.length > 0) days.push({ day, parts });
    }
    if (days.length === 0) continue;
    try {
      let folderId = parentId;
      for (const name of planned.folders) folderId = await folderIn(folderId, name);
      let trip = await fetchTrip((await createTrip(planned.name, folderId, planned.kind)).id);
      for (const { day, parts } of days) {
        const id = newId();
        trip = updateDay(addDay(trip, id), id, (d) => ({ ...d, name: day.name, date: day.date }));
        for (const p of parts) trip = addParts(trip, id, p);
      }
      await saveTrip(trip);
      result.trips++;
    } catch (error) {
      result.errors.push(`${[...planned.folders, planned.name].join(' / ')}: ${errorMessage(error)}`);
    }
  }
  return result;
}
