import { batch, createEffect, createMemo, createResource, createRoot, createSignal, on } from 'solid-js';
import { addEntry as postEntry, deleteEntry, errorMessage, listEntriesAt, orderEntries, tripApi, updateEntry } from '../api';
import { dayOfEntry, entriesOn as entriesOf, type Entry, type EntryTarget } from '../model/journal';
import { chaptersOf, type Chapter } from '../model/journalDocument';
import type { LngLat } from '../model/trip';
import { flushSave } from './autosave';
import { detailDayId, openDetail, openTrip, openTripId, partsLost } from './trip';

/** The open trip's journal, loaded with the trip; changes go to the server at once, there is no undo. */

const [entries, { mutate, refetch }] = createRoot(() => createResource(openTripId, (id) => listEntriesAt(tripApi(id))));

/** Reads the journal again. A reading that fails is the resource's to show, not an error of whoever asked for it. */
const reread = (): void => void Promise.resolve(refetch()).catch(() => undefined);

// A save that took a part off the trip linked the entries on it anew: to its day, or to the trip.
createRoot(() => createEffect(on(partsLost, reread, { defer: true })));

/** The entries of the open trip; none until they are loaded, and none where they could not be. */
export function allEntries(): Entry[] {
  const tripId = openTripId();
  return entries.error ? [] : (entries() ?? []).filter((e) => e.tripId === tripId);
}

/** Why the journal could not be read; nothing where it was. */
export const journalError = (): string | undefined => (entries.error ? errorMessage(entries.error) : undefined);

export const entriesOn = (target: EntryTarget): Entry[] => entriesOf(allEntries(), target);

const chapters = createRoot(() => createMemo((): Chapter[] => (openTrip() ? chaptersOf(openTrip()!, allEntries()) : [])));
/** The open trip's journal as it is read: the trip's own entries, then a chapter for each day. */
export { chapters };

/** Whether the pane of a day's contents shows the day's journal instead. */
export const [dayJournalShown, setDayJournalShown] = createSignal(false);
/** Whether the journal of the whole trip is open over the page. */
export const [workspaceOpen, setWorkspaceOpen] = createSignal(false);
/** The entry whose row is brought into view in the journal that shows it. */
const [shownEntryId, setShownEntryId] = createSignal<number>();
export { shownEntryId };

/** Shows a day's journal in the pane of its contents, at an entry where one is given. */
export function showDayJournal(dayId: string, entryId?: number): void {
  batch(() => {
    openDetail(dayId);
    setDayJournalShown(true);
    setShownEntryId(entryId);
  });
}

/**
 * The part a new entry is being written for, the trip for an empty target, and the spot
 * on the map it stands on where it is made from there; none while nothing is written.
 */
const [journal, setJournal] = createSignal<{ target: EntryTarget; spot?: LngLat }>();

// A day's journal is shown in the pane of its contents for as long as that pane stands: opened again, the pane has the contents.
createRoot(() => createEffect(on(detailDayId, (dayId) => dayId === undefined && setDayJournalShown(false), { defer: true })));

// The journal is the open trip's: what shows it closes with it, and with it a trip that another is opened over.
createRoot(() =>
  createEffect(
    on(
      openTripId,
      () => {
        setJournal(undefined);
        setDayJournalShown(false);
        setWorkspaceOpen(false);
      },
      { defer: true },
    ),
  ),
);

export const journalTarget = (): EntryTarget | undefined => journal()?.target;
export const journalSpot = (): LngLat | undefined => journal()?.spot;

/** Opens the window for a new entry on a part, at a spot on the map where one is given. */
export function openJournal(target: EntryTarget, spot?: LngLat): void {
  setJournal({ target, spot });
}

export function closeJournal(): void {
  setJournal(undefined);
}

/** What a new entry is made of besides its part. */
export interface NewEntry {
  text: string;
  file?: File;
  /** Where it stands, unless its photo knows where it was taken. */
  spot?: LngLat;
}

/**
 * Adds an entry to a trip, the open one when it is called, and returns it as the server
 * placed it: a photo for the trip itself on the day of its date. The trip is saved first, so that the server knows the part the entry is for.
 */
export async function addEntry(tripId: number, target: EntryTarget, entry: NewEntry): Promise<Entry> {
  await flushSave();
  const added = await postEntry(tripId, target, entry.text, entry.file, entry.spot, { byDate: true });
  if (openTripId() === tripId) mutate((list = []) => [...list, added]);
  return added;
}

/** Changes an entry on the server and here alike; what the server refuses is read again. */
async function change(entry: Entry, sent: Parameters<typeof updateEntry>[2], here: Partial<Entry>): Promise<void> {
  mutate((list) => list?.map((e) => (e.id === entry.id ? { ...e, ...here } : e)));
  try {
    await updateEntry(entry.tripId, entry.id, sent);
  } catch (error) {
    reread();
    throw error;
  }
}

export const editEntry = (entry: Entry, text: string): Promise<void> => change(entry, { text }, { text });

/** Stands an entry at a place on the map, or with null takes it off the map. */
export const placeEntry = (entry: Entry, lngLat: LngLat | null): Promise<void> => change(entry, { lngLat }, { lngLat });

/** Links an entry to another part of the trip, or to the trip itself; in another chapter it goes to its end, which is read from the server. */
export async function linkEntry(entry: Entry, target: EntryTarget): Promise<void> {
  await flushSave();
  await updateEntry(entry.tripId, entry.id, { link: target });
  await refetch();
}

/**
 * Puts the entries in that order in the chapter of a day, or with null of the trip itself.
 * One of another chapter joins this one, on the day or on the trip, as the server does it.
 */
export async function orderChapter(dayId: string | null, ordered: readonly Entry[]): Promise<void> {
  const tripId = openTripId()!;
  const places = new Map(ordered.map((entry, position) => [entry.id, position]));
  const days = openTrip()!.days;
  mutate((list) =>
    list?.map((e) => {
      const position = places.get(e.id);
      if (position === undefined) return e;
      return (dayOfEntry(days, e)?.id ?? null) === dayId ? { ...e, position } : { ...e, position, dayId, routeId: null, stopId: null };
    }),
  );
  try {
    await flushSave();
    await orderEntries(tripId, dayId, [...places.keys()]);
  } catch (error) {
    reread();
    throw error;
  }
}

export async function removeEntry(entry: Entry): Promise<void> {
  await deleteEntry(entry.tripId, entry.id);
  mutate((list) => list?.filter((e) => e.id !== entry.id));
}
