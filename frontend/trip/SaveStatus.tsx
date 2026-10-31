import { Match, Show, Switch } from 'solid-js';
import { saveState } from '../state/autosave';
import { AlertIcon, CheckIcon, DotIcon, RefreshIcon } from '../ui/icons';

const SAID = { saved: 'Saved', dirty: 'Unsaved changes', saving: 'Saving…', failed: 'Saving failed', conflict: 'Changed elsewhere' } as const;

/** Whether the open trip's changes are saved, as an icon that says so in its title. */
export function SaveState() {
  return (
    <span class="save-state" classList={{ failed: saveState() === 'failed' || saveState() === 'conflict' }} title={SAID[saveState()]} role="status" aria-label={SAID[saveState()]}>
      <Switch>
        <Match when={saveState() === 'saved'}>
          <CheckIcon />
        </Match>
        <Match when={saveState() === 'dirty'}>
          <DotIcon />
        </Match>
        <Match when={saveState() === 'saving'}>
          <RefreshIcon />
        </Match>
        <Match when={true}>
          <AlertIcon />
        </Match>
      </Switch>
    </span>
  );
}

/** What went wrong saving the open trip, and a way to reload it when it was changed elsewhere; nothing while saving goes well. */
export function SaveProblem(props: { onReload: () => void }) {
  return (
    <Show when={saveState() === 'failed' || saveState() === 'conflict'}>
      <p class="save-status failed">
        <Show when={saveState() === 'conflict'} fallback="Saving failed; trying again shortly.">
          The trip was changed elsewhere. <button onClick={props.onReload}>Reload it</button> to go on; the changes made here since are lost.
        </Show>
      </p>
    </Show>
  );
}
