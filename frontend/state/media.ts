import { createResource, createRoot, createSignal } from 'solid-js';
import { addMedia as postMedia, changeMedia, copyMedia, deleteMedia, errorMessage, listMedia, moveMedia } from '../api';
import type { Entry } from '../model/journal';
import { flushSave } from './autosave';
import { openTripId } from './trip';

/**
 * The open trip's additional media, the files and links kept with its days, loaded with
 * the trip; changes go to the server at once.
 */

const [list, { mutate, refetch }] = createRoot(() => createResource(openTripId, async (tripId) => ({ tripId, media: await listMedia(tripId) })));

/** The media of the open trip, in the order they were added; none until they are loaded. */
function allMedia(): Entry[] {
  const loaded = list();
  return loaded && loaded.tripId === openTripId() ? loaded.media : [];
}

export const mediaOf = (dayId: string): Entry[] => allMedia().filter((m) => m.dayId === dayId);

export const mediaById = (id: number): Entry | undefined => allMedia().find((m) => m.id === id);

const changed = (change: (media: Entry[]) => Entry[]) => mutate((loaded) => loaded && { ...loaded, media: change(loaded.media) });

/** Keeps files with a day of the open trip, which is saved first so that the server knows a day just added. What cannot be kept is thrown once the others are in. */
export async function addFiles(dayId: string, files: readonly File[]): Promise<void> {
  await flushSave();
  const failed: string[] = [];
  for (const file of files) {
    try {
      const added = await postMedia(openTripId()!, dayId, file);
      changed((media) => [...media, added]);
    } catch (fault) {
      failed.push(`${file.name}: ${errorMessage(fault)}`);
    }
  }
  if (failed.length > 0) throw new Error(failed.join(' '));
}

/** Keeps a link under a name with a day of the open trip. */
export async function addLink(dayId: string, name: string, url: string): Promise<void> {
  await flushSave();
  const added = await postMedia(openTripId()!, dayId, { name, url });
  changed((media) => [...media, added]);
}

/** Names a file or a link anew, a link with its address. */
export async function renameMedia(entry: Entry, name: string, url?: string): Promise<void> {
  await changeMedia(entry.tripId, entry.id, name, url);
  changed((media) => media.map((m) => (m.id === entry.id ? { ...m, text: name, url: m.url === null ? null : (url ?? m.url) } : m)));
}

/** Moves media of the open trip to another of its days. */
export async function moveToDay(entries: readonly Entry[], dayId: string): Promise<void> {
  await flushSave();
  for (const entry of entries) {
    await moveMedia(entry.tripId, entry.id, dayId);
    changed((media) => media.map((m) => (m.id === entry.id ? { ...m, dayId } : m)));
  }
}

export async function removeMedia(entries: readonly Entry[]): Promise<void> {
  for (const entry of entries) {
    await deleteMedia(entry.tripId, entry.id);
    changed((media) => media.filter((m) => m.id !== entry.id));
  }
}

/** Brings media of whichever trip to a day of the open one, moved or as copies, and lists the open trip's afresh. */
export async function bringMedia(from: { tripId: number; ids: readonly number[] }, dayId: string, move: boolean): Promise<void> {
  await flushSave();
  for (const id of from.ids) await (move ? moveMedia(from.tripId, id, dayId) : copyMedia(from.tripId, id, dayId));
  await refetch();
}

/** What the last action on a day's media came to, said under them. */
const [note, setNote] = createSignal<{ dayId: string; text: string }>();

export const mediaNote = (dayId: string) => (note()?.dayId === dayId ? note() : undefined);

/** Runs an action on a day's media and says under them why it failed, where it did. */
export async function mediaAction(dayId: string, job: () => Promise<void>): Promise<void> {
  try {
    await job();
    setNote(undefined);
  } catch (fault) {
    setNote({ dayId, text: errorMessage(fault) });
  }
}
