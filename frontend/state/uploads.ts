import { createSignal } from 'solid-js';
import { errorMessage } from '../api';
import type { EntryTarget } from '../model/journal';
import type { LngLat } from '../model/trip';
import { prepareUpload } from '../trip/photo';
import { addEntry } from './journal';

/**
 * Files on their way into the journal: each becomes an entry of its own, made one after
 * the other in the order they were given, while the page is used for something else.
 * One that fails stays listed with what went wrong, to be tried again or dropped.
 */

export interface Upload {
  id: number;
  tripId: number;
  target: EntryTarget;
  file: File;
  /** What is written to it: a photo's caption. */
  text?: string;
  spot?: LngLat;
  byDate?: boolean;
  /** Why it failed; none while it waits or is sent. */
  error?: string;
}

const [uploads, setUploads] = createSignal<Upload[]>([]);
export { uploads };

/** The uploads still to be made: those that wait or are being sent. */
export const pendingUploads = (): Upload[] => uploads().filter((u) => u.error === undefined);

let nextId = 1;
let running = false;

/** Queues the files as entries on a part of a trip, the trip for an empty target. */
export function queueEntries(tripId: number, target: EntryTarget, files: readonly File[], at: { text?: string; spot?: LngLat; byDate?: boolean } = {}): void {
  setUploads((list) => [...list, ...files.map((file) => ({ id: nextId++, tripId, target, file, ...at }))]);
  void run();
}

export function retryUpload(id: number): void {
  setUploads((list) => list.map((u) => (u.id === id ? { ...u, error: undefined } : u)));
  void run();
}

export function dropUpload(id: number): void {
  setUploads((list) => list.filter((u) => u.id !== id));
}

/** Makes the entries of the waiting uploads, one at a time. */
async function run(): Promise<void> {
  if (running) return;
  running = true;
  for (let next = pendingUploads()[0]; next; next = pendingUploads()[0]) {
    const { id, tripId, target, file, text, spot, byDate } = next;
    try {
      await addEntry(tripId, target, { text: text ?? '', file: await prepareUpload(file), spot, byDate });
      dropUpload(id);
    } catch (error) {
      setUploads((list) => list.map((u) => (u.id === id ? { ...u, error: errorMessage(error) } : u)));
    }
  }
  running = false;
}

window.addEventListener('beforeunload', (event) => {
  if (pendingUploads().length > 0) event.preventDefault();
});
