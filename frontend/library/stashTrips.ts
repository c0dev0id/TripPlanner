import { t } from '../i18n/t';
import type { CopiedFolder, StashFile } from '../model/stash';
import { asName, byName, type LngLat } from '../model/trip';
import { localDate } from '../recording/rides';
import { dateIn, withoutDate, type PlannedDay, type PlannedTrip } from './folderImport';
import { ends, mainItem, near, ONWARD_M } from './grouping';

/**
 * The trips that folders and files of the Stash make where they are pasted among the
 * trips, planned as an import of a folder tree is: a folder of files is a trip, its
 * files its days; a folder that also holds folders is a folder of trips, each of its own
 * files a trip of one day.
 */

/** How far a day goes at most whose files no date puts together: beyond it the next file is another day's. */
const DAY_M = 400_000;

/** When a file starts, where it says: the earliest of its routes' planned departures and its tracks' first points. */
const startOf = (file: StashFile): string | undefined => file.items.flatMap((item) => item.startedAt ?? []).sort()[0];

/** The day a file is for: the date in its name, else the day it starts. */
const dateOf = (file: StashFile): string | undefined => dateIn(file.name) ?? (startOf(file) === undefined ? undefined : localDate(startOf(file)!));

/** Whether a file ends where it starts: a round, ridden from a place and back to it. */
const isRound = (file: StashFile): boolean => near(ends(file).start, ends(file).end, ONWARD_M);

/** The day a file says it is for by number: "Tag 2", "Day 02". */
const dayNumber = (file: StashFile): number | undefined => {
  const found = /(?:^|[^\p{L}])(?:tag|day)\s*0*(\d+)/iu.exec(file.name);
  return found ? Number(found[1]) : undefined;
};

/**
 * The files as one line, each going on where the one before ends, where they form
 * exactly one: a first that none leads to, and from each one to go on with. A round
 * that starts where the line stands is ridden before the file that leads on from
 * there. Where the line is closed, a ride there and back or a round in legs, it starts
 * with the file that leaves from where most of `departures` do: home. None where the
 * lines do not say: with two to go on with, or two firsts.
 */
function alongTheLine(files: readonly StashFile[], departures: readonly LngLat[]): StashFile[] | undefined {
  const at = new Map(files.map((file) => [file, ends(file)]));
  const leadsTo = (from: StashFile, to: StashFile) => from !== to && near(at.get(from)!.end, at.get(to)!.start, ONWARD_M);
  const leavingFrom = (file: StashFile) => departures.filter((start) => near(start, at.get(file)!.start, ONWARD_M)).length;
  const firsts = files.filter((file) => !files.some((other) => leadsTo(other, file)));
  const first = firsts.length === 0 ? files.reduce((a, b) => (leavingFrom(b) > leavingFrom(a) ? b : a)) : firsts.length === 1 ? firsts[0]! : undefined;
  if (!first) return undefined;
  const line = [first];
  while (line.length < files.length) {
    const next = files.filter((file) => !line.includes(file) && leadsTo(line.at(-1)!, file));
    const one = next.find(isRound) ?? (next.length === 1 ? next[0] : undefined);
    if (!one) return undefined;
    line.push(one);
  }
  return line;
}

/**
 * The files in the order they are ridden: by when they start where each says so, else
 * along the line they form where they form one, else by name.
 */
function ridden(files: readonly StashFile[], departures: readonly LngLat[]): StashFile[] {
  const named = [...files].sort((a, b) => byName(a.name, b.name));
  if (named.every((file) => startOf(file) !== undefined)) return named.sort((a, b) => startOf(a)!.localeCompare(startOf(b)!));
  return (named.length > 1 ? alongTheLine(named, departures) : undefined) ?? named;
}

/**
 * The days the files make: the files of one date are one day, the dated days by date
 * and before the others. Of the undated, in the order they are ridden, a file is of the
 * day before it where both name the same day by number; where neither names one, while
 * it goes on where that day ends, a round after a round excepted, and the day stays
 * within a day's ride, so that the legs of a ride are one day and the days of a tour
 * each their own.
 */
export function daysOf(files: readonly StashFile[], departures: readonly LngLat[] = []): { date: string | null; files: StashFile[] }[] {
  const days: { date: string | null; files: StashFile[]; distanceM: number }[] = [];
  for (const file of ridden(files, departures)) {
    const date = dateOf(file) ?? null;
    const distanceM = mainItem(file)?.distanceM ?? 0;
    const last = days.at(-1)?.date === null ? days.at(-1) : undefined;
    const before = last?.files.at(-1);
    const numbered = before && (dayNumber(before) ?? dayNumber(file)) !== undefined;
    const goesOn = before && near(ends(before).end, ends(file).start, ONWARD_M) && !(isRound(before) && isRound(file));
    const sameDay = before && (numbered ? dayNumber(before) === dayNumber(file) : goesOn && last!.distanceM + distanceM <= DAY_M);
    const day = date !== null ? days.find((other) => other.date === date) : sameDay ? last : undefined;
    if (!day) days.push({ date, files: [file], distanceM });
    else {
      day.files.push(file);
      day.distanceM += distanceM;
    }
  }
  const dated = days.filter((day) => day.date !== null).sort((a, b) => a.date!.localeCompare(b.date!));
  return [...dated, ...days.filter((day) => day.date === null)].map(({ date, files: of }) => ({ date, files: of }));
}

/** A day of files as an import plans it: named after its one file, and unnamed where it is made of several; `at` says where each file stands among those read. */
const plannedDay = (date: string | null, of: readonly StashFile[], at: (file: StashFile) => number): PlannedDay => ({ date, name: of.length === 1 ? asName(withoutDate(of[0]!.name)) : '', files: of.map(at), media: [] });

/** The days the files make in a trip that is there already, by the rule of daysOf, each naming its files by their place among `files`. */
export const planStashDays = (files: readonly StashFile[], departures: readonly LngLat[] = []): PlannedDay[] => daysOf(files, departures).map(({ date, files: of }) => plannedDay(date, of, (file) => files.indexOf(file)));

/**
 * The trips the copied folders and files make, with the files they are read from, each
 * day naming its files by their place among those: a copied file is a trip of one day, a
 * copied folder a trip, or with folders in it a folder of trips, inside the folders it
 * was copied with. `departures` are where the Stash's files start, by which a closed
 * line is known to start at home.
 */
export function planStashTrips(folders: readonly CopiedFolder[], loose: readonly StashFile[], departures: readonly LngLat[] = []): { files: StashFile[]; plan: PlannedTrip[] } {
  const files: StashFile[] = [];
  const day = (date: string | null, of: readonly StashFile[]): PlannedDay => plannedDay(date, of, (file) => files.push(file) - 1);
  const tripOfFile = (above: string[], file: StashFile): PlannedTrip => ({ folders: above, name: asName(withoutDate(file.name) || file.name), days: [{ ...day(dateOf(file) ?? null, [file]), name: '' }], media: [] });
  const tripsOf = (above: string[], folder: CopiedFolder): PlannedTrip[] => {
    const inside = [...above, asName(folder.name)];
    if (folder.folders.length > 0) return [...folder.files.map((file) => tripOfFile(inside, file)), ...folder.folders.flatMap((inner) => tripsOf(inside, inner))];
    if (folder.files.length === 0) return [];
    return [{ folders: above, name: asName(withoutDate(folder.name) || folder.name) || t('Imported trip'), days: daysOf(folder.files, departures).map(({ date, files: of }) => day(date, of)), media: [] }];
  };
  const plan = [...loose.map((file) => tripOfFile([], file)), ...folders.flatMap((folder) => tripsOf([], folder))];
  return { files, plan };
}
