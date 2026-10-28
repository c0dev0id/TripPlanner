import type { Day, LngLat } from './trip';

/** The journal: notes and files on a trip, a day, a stop or a route, as the server keeps them. */

export interface EntryFile {
  name: string;
  mediaType: string;
  size: number;
  /** Whether the server has a preview of it: a JPEG, PNG or WebP; a HEIC or a document is offered by name. */
  image: boolean;
}

export interface Entry {
  id: number;
  tripId: number;
  /** At most one of the three is set; none for an entry on the trip itself. */
  dayId: string | null;
  stopId: string | null;
  routeId: string | null;
  text: string;
  file: EntryFile | null;
  /** When a photo was taken, as its camera wrote it: YYYY-MM-DDTHH:MM:SS without a zone. */
  takenAt: string | null;
  /** Where the entry stands on the map: where a photo was taken by its EXIF data, else where it was put. */
  lngLat: LngLat | null;
  createdAt: string;
}

/** What an entry is on: one part by its id, or the trip for an empty target. */
export type EntryTarget = { dayId: string } | { stopId: string } | { routeId: string } | Record<string, never>;

/** The part an entry is on, as a target. */
export function targetOf(entry: Entry): EntryTarget {
  if (entry.dayId !== null) return { dayId: entry.dayId };
  if (entry.stopId !== null) return { stopId: entry.stopId };
  if (entry.routeId !== null) return { routeId: entry.routeId };
  return {};
}

export function onTarget(entry: Entry, target: EntryTarget): boolean {
  const t = target as { dayId?: string; stopId?: string; routeId?: string };
  return entry.dayId === (t.dayId ?? null) && entry.stopId === (t.stopId ?? null) && entry.routeId === (t.routeId ?? null);
}

export const entriesOn = (entries: readonly Entry[], target: EntryTarget): Entry[] => entries.filter((e) => onTarget(e, target));

/** The day an entry belongs to, by its day, its stop or its route; none for an entry on the trip itself. */
export function dayOfEntry(days: readonly Day[], entry: Entry): Day | undefined {
  return days.find((d) => d.id === entry.dayId || (entry.stopId !== null && d.stops.some((s) => s.id === entry.stopId)) || (entry.routeId !== null && d.routes.some((r) => r.id === entry.routeId)));
}

/** The entries that belong to the day: its own and those on its stops and routes. */
export function entriesOfDay(entries: readonly Entry[], day: Day): Entry[] {
  const stops = new Set(day.stops.map((s) => s.id));
  const routes = new Set(day.routes.map((r) => r.id));
  return entries.filter((e) => e.dayId === day.id || (e.stopId !== null && stops.has(e.stopId)) || (e.routeId !== null && routes.has(e.routeId)));
}

/** The day's entries that stand somewhere, for the map. */
export function placedEntriesOfDay(entries: readonly Entry[], day: Day): Entry[] {
  return entriesOfDay(entries, day).filter((e) => e.lngLat !== null);
}

/** What a marker of the entry says: the first line of its note, else its file's name. */
export function entryTitle(entry: Entry): string {
  const line = entry.text.split('\n', 1)[0]!.trim();
  const title = line || entry.file?.name || '';
  return title.length > 80 ? `${title.slice(0, 79)}…` : title;
}

/** A file's size as text: bytes, kB or MB. */
export function sizeText(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
