import { createResource, createRoot, createSignal } from 'solid-js';
import { addEntry as postEntry, deleteEntry, listEntriesAt, tripApi, updateEntry } from '../api';
import { entriesOn as entriesOf, type Entry, type EntryTarget } from '../model/journal';
import type { LngLat } from '../model/trip';
import { openTripId } from './trip';

/** The open trip's journal, loaded with the trip; changes go to the server at once, there is no undo. */

const [entries, { mutate }] = createRoot(() => createResource(openTripId, (id) => listEntriesAt(tripApi(id))));

/** The entries of the open trip, oldest first; none until they are loaded. */
export function allEntries(): Entry[] {
  const tripId = openTripId();
  return (entries() ?? []).filter((e) => e.tripId === tripId);
}

export const entriesOn = (target: EntryTarget): Entry[] => entriesOf(allEntries(), target);

/**
 * The open journal: the part it is of, the trip for an empty target, and the spot on the map
 * its new entries stand on where it was opened from there; none while it is closed.
 */
const [journal, setJournal] = createSignal<{ target: EntryTarget; spot?: LngLat }>();

export const journalTarget = (): EntryTarget | undefined => journal()?.target;
export const journalSpot = (): LngLat | undefined => journal()?.spot;

/** Opens the journal of a part, for new entries at a spot on the map where one is given. */
export function openJournal(target: EntryTarget, spot?: LngLat): void {
  setJournal({ target, spot });
}

export function closeJournal(): void {
  setJournal(undefined);
}

/** Adds an entry and returns it as the server placed it: a photo with a time goes to the day of that date, one with a position stands there. */
export async function addEntry(target: EntryTarget, text: string, file: File | undefined, spot: LngLat | undefined): Promise<Entry> {
  const entry = await postEntry(openTripId()!, target, text, file, spot);
  mutate((list = []) => [...list, entry]);
  return entry;
}

export async function editEntry(entry: Entry, text: string): Promise<void> {
  await updateEntry(entry.tripId, entry.id, text);
  mutate((list) => list?.map((e) => (e.id === entry.id ? { ...e, text } : e)));
}

export async function removeEntry(entry: Entry): Promise<void> {
  await deleteEntry(entry.tripId, entry.id);
  mutate((list) => list?.filter((e) => e.id !== entry.id));
}
