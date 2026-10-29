import { createFolder, createTrip, errorMessage, fetchTrip, listFolders, saveTrip } from '../api';
import { parseGpx } from '../gpx/gpx';
import { gpxToDayParts, type DayParts } from '../gpx/import';
import { newId, type Folder, type Trip } from '../model/trip';
import { addDay, addParts, dayAfter, updateDay } from '../routing/dayEdit';
import { withStopsInRidingOrder } from '../routing/sequence';

/** A trip the import makes of a folder that holds GPX files. */
export interface PlannedTrip {
  /** The names of the folders above the trip's folder, from the picked folder down. */
  folders: string[];
  name: string;
  days: PlannedDay[];
}

export interface PlannedDay {
  date: string | null;
  name: string;
  /** The day's files, as indexes into the paths planned from. */
  files: number[];
}

/** The first date written as YYYY-MM-DD in a name that is a real date. */
export function dateIn(name: string): string | undefined {
  for (const [date, year, month, day] of name.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) {
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (parsed.toISOString().slice(0, 10) === date) return date;
  }
  return undefined;
}

/** The name without its date and the separators around it; empty where nothing else is left. */
function withoutDate(name: string): string {
  const date = dateIn(name);
  const rest = date ? name.replace(date, ' ') : name;
  return rest.replace(/^[\s_.,–-]+|[\s_.,–-]+$/g, '').replace(/\s{2,}/g, ' ');
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * The trips a picked folder tree makes, from the files' paths relative to it: each folder
 * that holds GPX files itself is a trip, named after it without its date, inside the
 * folders above it. Files with a date in their name make one day per date; the others a
 * day each, dated on from the trip folder's date after the dated days, or undated where
 * the folder has none. Days follow their dates, undated ones last.
 */
export function planFolderImport(paths: readonly string[]): PlannedTrip[] {
  const byFolder = new Map<string, number[]>();
  paths.forEach((path, i) => {
    const file = path.split('/').at(-1)!;
    if (file.startsWith('.') || !/\.gpx$/i.test(file)) return;
    const folder = path.split('/').slice(0, -1).join('/');
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), i]);
  });
  return [...byFolder.keys()].sort(byName).map((folder) => {
    const segments = folder === '' ? [] : folder.split('/');
    const folderName = segments.at(-1) ?? '';
    const stem = (i: number) => paths[i]!.split('/').at(-1)!.replace(/\.gpx$/i, '');
    const files = byFolder.get(folder)!.sort((a, b) => byName(stem(a), stem(b)));
    const dated = new Map<string, number[]>();
    const undated: number[] = [];
    for (const i of files) {
      const date = dateIn(stem(i));
      if (date) dated.set(date, [...(dated.get(date) ?? []), i]);
      else undated.push(i);
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
    return { folders: segments.slice(0, -1), name: withoutDate(folderName) || folderName || 'Imported trip', days };
  });
}

/** What an import did: how many trips it made, and what it could not read or save. */
export interface ImportResult {
  trips: number;
  errors: string[];
}

/**
 * Makes the planned trips from the picked files inside the folder `parentId` (none for the
 * top): the folders above each trip are found by name or created, the trip is created and
 * its days saved as one document. A file that is no GPX is left out, as is a day or a trip
 * left without one; what cannot be read or saved is reported, and the import goes on.
 */
export async function importFolder(files: readonly File[], plan: readonly PlannedTrip[], parentId: number | null, onProgress: (text: string) => void): Promise<ImportResult> {
  const folders: Folder[] = await listFolders();
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
          parts.push(gpxToDayParts(parseGpx(await file.text()), { fileName: file.name.replace(/\.gpx$/i, ''), profile: 'motorcycle', newId }));
        } catch (error) {
          result.errors.push(`${file.webkitRelativePath || file.name}: ${errorMessage(error)}`);
        }
      }
      if (parts.length > 0) days.push({ day, parts });
    }
    if (days.length === 0) continue;
    try {
      let folderId = parentId;
      for (const name of planned.folders) folderId = await folderIn(folderId, name);
      let trip: Trip = await fetchTrip((await createTrip(planned.name, folderId)).id);
      for (const { day, parts } of days) {
        const id = newId();
        trip = updateDay(addDay(trip, id), id, (d) => ({ ...d, name: day.name, date: day.date }));
        for (const p of parts) trip = addParts(trip, id, p);
      }
      await saveTrip(withStopsInRidingOrder(trip));
      result.trips++;
    } catch (error) {
      result.errors.push(`${[...planned.folders, planned.name].join(' / ')}: ${errorMessage(error)}`);
    }
  }
  return result;
}
