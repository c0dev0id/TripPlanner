import { createResource, createRoot, createSignal } from 'solid-js';
import { addEntry as postEntry, deleteEntry, listEntriesAt, tripApi, updateEntry } from '../api';
import { entriesOn as entriesOf, type Entry, type EntryTarget } from '../model/journal';
import { openTrip } from './trip';

/** The open trip's journal, loaded with the trip; changes go to the server at once, there is no undo. */

const [entries, { mutate }] = createRoot(() => createResource(() => openTrip()?.id, (id) => listEntriesAt(tripApi(id))));

/** The entries of the open trip, oldest first; none until they are loaded. */
export function allEntries(): Entry[] {
  const tripId = openTrip()?.id;
  return (entries() ?? []).filter((e) => e.tripId === tripId);
}

export const entriesOn = (target: EntryTarget): Entry[] => entriesOf(allEntries(), target);

/** The part whose journal dialog is open, or the trip's for an empty target; none while the dialog is closed. */
export const [journalTarget, setJournalTarget] = createSignal<EntryTarget>();

/** Adds an entry and returns it as the server placed it: a photo with a time goes to the day of that date. */
export async function addEntry(target: EntryTarget, text: string, file: File | undefined): Promise<Entry> {
  const entry = await postEntry(openTrip()!.id, target, text, file);
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
