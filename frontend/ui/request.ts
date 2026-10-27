import { createSignal } from 'solid-js';
import { errorMessage } from '../api';

/** A dialog's requests: `run` one, keeping what it threw as `error` and whether one is still running as `busy`. */
export function createRequest() {
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const run = async (work: () => Promise<void>): Promise<void> => {
    setError(undefined);
    setBusy(true);
    try {
      await work();
    } catch (fault) {
      setError(errorMessage(fault));
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, run };
}
