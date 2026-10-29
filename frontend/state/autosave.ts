import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { ApiError, saveTrip } from '../api';
import { withStopsInRidingOrder } from '../routing/sequence';
import { changeCount, markSaved, openTrip } from './trip';

/**
 * Saves the open trip a moment after its last change, as one document. A save that fails
 * is tried again later; one the server refuses as stale (409) stops the saving until the
 * trip is loaded again.
 */

export type SaveState = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';

const [saveState, setSaveState] = createSignal<SaveState>('saved');
export { saveState };

const DEBOUNCE_MS = 1500;
const RETRY_MS = 10_000;

let timer: ReturnType<typeof setTimeout> | undefined;

/** With `keepalive`, the request outlives the page: for a page being hidden or left. */
async function save(keepalive = false): Promise<void> {
  const trip = openTrip();
  if (!trip || saveState() === 'saving' || saveState() === 'conflict') return;
  const count = changeCount();
  setSaveState('saving');
  try {
    markSaved(await saveTrip(withStopsInRidingOrder(trip), keepalive));
    if (changeCount() === count) setSaveState('saved');
    else {
      setSaveState('dirty');
      schedule(DEBOUNCE_MS);
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) setSaveState('conflict');
    else {
      setSaveState('failed');
      schedule(RETRY_MS);
    }
  }
}

function schedule(ms: number): void {
  clearTimeout(timer);
  timer = setTimeout(() => void save(), ms);
}

/** Saves now if anything is unsaved: for leaving the trip or, with `keepalive`, the page. */
export async function flushSave(keepalive = false): Promise<void> {
  clearTimeout(timer);
  if (saveState() === 'dirty' || saveState() === 'failed') await save(keepalive);
}

/** Forgets any unsaved state: for a trip just loaded or closed. */
export function resetSaveState(): void {
  clearTimeout(timer);
  setSaveState('saved');
}

createRoot(() => {
  createEffect(
    on(
      changeCount,
      () => {
        if (!openTrip() || saveState() === 'conflict') return;
        if (saveState() !== 'saving') setSaveState('dirty');
        schedule(DEBOUNCE_MS);
      },
      { defer: true },
    ),
  );
});

window.addEventListener('beforeunload', (event) => {
  if (openTrip() && saveState() !== 'saved') event.preventDefault();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushSave(true);
});
