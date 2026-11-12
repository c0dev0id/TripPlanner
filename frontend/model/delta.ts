import type { Day, Route, Trip } from './trip';

/** A day or a route of a document to save that stands for the one the server has under its id. */
export interface Unchanged {
  id: string;
  unchanged: true;
}

/** A day as a save sends it: whole, with any of its routes left out as unchanged, or left out so itself. */
export type SentDay = Unchanged | (Omit<Day, 'routes'> & { routes: (Route | Unchanged)[] });

const unchanged = (part: { id: string }): Unchanged => ({ id: part.id, unchanged: true });

/**
 * The days of a document to save, given the trip as the server has it: a day that is the
 * very one saved goes as its id alone, and so does such a route in a day that changed.
 * Parts are never changed in place, so the same object is the same content. `sent` is a
 * day as it goes whole. Without a saved trip every day goes whole.
 */
export function daysToSend(days: readonly Day[], saved: Trip | undefined, sent: (day: Day, index: number) => Day = (day) => day): SentDay[] {
  if (!saved) return days.map(sent);
  const savedDays = new Set(saved.days);
  const savedRoutes = new Set(saved.days.flatMap((day) => day.routes));
  return days.map((day, index) => (savedDays.has(day) ? unchanged(day) : { ...sent(day, index), routes: day.routes.map((route) => (savedRoutes.has(route) ? unchanged(route) : route)) }));
}
