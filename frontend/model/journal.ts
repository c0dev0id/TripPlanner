import type { Day, LngLat } from './trip';

/** The journal: notes and files on a trip, a day, a stop or a route, as the server keeps them. */

export interface EntryFile {
  name: string;
  mediaType: string;
  size: number;
  /** Whether the server can show a preview of it. */
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
  /** Where a photo was taken, from its EXIF data. */
  lngLat: LngLat | null;
  createdAt: string;
}

/** What an entry is on: one part by its id, or the trip for an empty target. */
export type EntryTarget = { dayId: string } | { stopId: string } | { routeId: string } | Record<string, never>;

export function onTarget(entry: Entry, target: EntryTarget): boolean {
  const t = target as { dayId?: string; stopId?: string; routeId?: string };
  return entry.dayId === (t.dayId ?? null) && entry.stopId === (t.stopId ?? null) && entry.routeId === (t.routeId ?? null);
}

export const entriesOn = (entries: readonly Entry[], target: EntryTarget): Entry[] => entries.filter((e) => onTarget(e, target));

/** The entries that belong to the day: its own and those on its stops and routes. */
export function entriesOfDay(entries: readonly Entry[], day: Day): Entry[] {
  const stops = new Set(day.stops.map((s) => s.id));
  const routes = new Set(day.routes.map((r) => r.id));
  return entries.filter((e) => e.dayId === day.id || (e.stopId !== null && stops.has(e.stopId)) || (e.routeId !== null && routes.has(e.routeId)));
}

/** The day's photos that know where they were taken, for the map. */
export function photosOfDay(entries: readonly Entry[], day: Day): Entry[] {
  return entriesOfDay(entries, day).filter((e) => e.lngLat !== null && e.file?.image);
}

/** A file's size as text: bytes, kB or MB. */
export function sizeText(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
