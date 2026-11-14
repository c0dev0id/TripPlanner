import { plural } from '../i18n/t';
import { changeTrip, createTrip, deleteTrip, fetchTrip, listRecordings, moveRecording } from '../api';
import { newId, type Day } from '../model/trip';
import { withNewPartIds } from '../routing/dayEdit';
import { flushSave } from '../state/autosave';
import type { TripSource } from '../state/library';
import { openTripId, removeParts } from '../state/trip';
import { tripOfFolder } from './folderImport';

/**
 * The trip a collection's sections make, as a folder of GPX files makes one: named after
 * `name` without its date, a section with a date in its name on the day of that date,
 * several of a date on one day, the others a day each, dated on from the name's date or
 * undated. Everything is under new ids; `dayOf` says which day each section went to.
 */
export function tripFromSections(name: string, sections: readonly Day[], newId: () => string): { name: string; days: Day[]; dayOf: Map<string, string> } {
  const planned = tripOfFolder([name], sections.map((_, i) => i), (i) => sections[i]!.name);
  const dayOf = new Map<string, string>();
  const days = planned.days.map((day): Day => {
    const id = newId();
    const parts = day.files.map((i) => {
      const section = sections[i]!;
      dayOf.set(section.id, id);
      const copy = withNewPartIds(section, newId).day;
      // Where sections share a day, their names are kept by the routes that have none.
      return day.files.length > 1 ? { ...copy, routes: copy.routes.map((route) => (route.name === '' ? { ...route, name: section.name } : route)) } : copy;
    });
    return { id, name: day.name, date: day.date, notes: parts.flatMap((part) => part.notes || []).join('\n\n'), routes: parts.flatMap((part) => part.routes), stops: parts.flatMap((part) => part.stops) };
  });
  return { name: planned.name, days, dayOf };
}

/**
 * Makes a trip in a folder from a collection, whole or the sections named, and says what
 * it made. With `move` the sections leave the collection once the trip is saved, their
 * recordings going with them to their days, and a collection left without sections is
 * deleted, after `leave` where it is the open one.
 */
export async function createTripFrom(source: TripSource, name: string, folderId: number | null, move: boolean, leave: () => Promise<void>): Promise<string> {
  await flushSave();
  const collection = await fetchTrip(source.id);
  const sections = source.dayIds ? collection.days.filter((day) => source.dayIds!.includes(day.id)) : collection.days;
  const made = tripFromSections(name, sections, newId);
  const trip = await createTrip(made.name, folderId);
  await changeTrip(trip.id, (empty) => ({ ...empty, days: made.days }));
  if (move) {
    for (const recording of await listRecordings(collection.id)) {
      const dayId = made.dayOf.get(recording.dayId);
      if (dayId) await moveRecording(collection.id, recording.id, dayId);
    }
    // Sections are only ever named of the open collection, where taking them out is an edit like any other.
    if (sections.length < collection.days.length) removeParts('day', sections.map((section) => section.id));
    else {
      if (collection.id === openTripId()) await leave();
      await deleteTrip(collection.id);
    }
  }
  return plural(made.days.length, 'Trip “{name}” made with one day.|Trip “{name}” made with {n} days.', { name: made.name });
}
