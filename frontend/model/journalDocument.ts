import { dayOfEntry, type Entry } from './journal';
import type { Day, Trip } from './trip';

/**
 * The journal read as a document: the trip's own entries first, then a chapter for each
 * day in the days' order, with the entries on the day, its routes and its stops.
 */

export interface Chapter {
  /** The day the chapter is of; none for the trip's own entries. */
  day: Day | undefined;
  /** The entries in the order they are read. */
  entries: Entry[];
}

const inOrder = (a: Entry, b: Entry): number => a.position - b.position || a.id - b.id;

/** The chapters of the trip's journal: the trip's own, then one for every day, also where it has no entry yet. An entry on a part the trip no longer holds is the trip's own. */
export function chaptersOf(trip: Trip, entries: readonly Entry[]): Chapter[] {
  const byDay = new Map<Day | undefined, Entry[]>();
  for (const entry of entries) {
    const day = dayOfEntry(trip.days, entry);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  return [undefined, ...trip.days].map((day) => ({ day, entries: (byDay.get(day) ?? []).sort(inOrder) }));
}

/** What a run of entries is read as: a text, the photos that follow each other as one gallery, or a file that is no image. */
export type Block = { kind: 'text'; entry: Entry } | { kind: 'gallery'; entries: Entry[] } | { kind: 'file'; entry: Entry };

/** The blocks a chapter's entries make. A photo's text is its caption; a file's, the note beside it. */
export function blocksOf(entries: readonly Entry[]): Block[] {
  const blocks: Block[] = [];
  for (const entry of entries) {
    const last = blocks.at(-1);
    if (!entry.file) blocks.push({ kind: 'text', entry });
    else if (!entry.file.image) blocks.push({ kind: 'file', entry });
    else if (last?.kind === 'gallery') last.entries.push(entry);
    else blocks.push({ kind: 'gallery', entries: [entry] });
  }
  return blocks;
}

/** The entries with those that say when they were taken in that order, each of the others where it stood. */
export function byTimeTaken(entries: readonly Entry[]): Entry[] {
  const timed = entries.filter((e) => e.takenAt !== null).sort((a, b) => a.takenAt!.localeCompare(b.takenAt!) || inOrder(a, b));
  return entries.map((entry) => (entry.takenAt === null ? entry : timed.shift()!));
}

/** Whether the trip no longer holds a day, a route or a stop it held: the journal entries on it are then linked anew by the server. */
export function losesParts(before: Trip, after: Trip): boolean {
  const ids = (trip: Trip) => trip.days.flatMap((d) => [d.id, ...d.routes.map((r) => r.id), ...d.stops.map((s) => s.id)]);
  const kept = new Set(ids(after));
  return ids(before).some((id) => !kept.has(id));
}
