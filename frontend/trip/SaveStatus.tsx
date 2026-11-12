import { Show, type JSX } from 'solid-js';
import { t } from '../i18n/t';
import { saveState, type SaveState as State } from '../state/autosave';
import { AlertIcon, CheckIcon, DotIcon, RefreshIcon } from '../ui/icons';

/** Each save state's words and icon. */
const SHOWN: Record<State, [string, () => JSX.Element]> = {
  saved: [t('Saved'), CheckIcon],
  dirty: [t('Unsaved changes'), DotIcon],
  saving: [t('Saving…'), RefreshIcon],
  failed: [t('Saving failed'), AlertIcon],
  conflict: [t('Changed elsewhere'), AlertIcon],
};

const trouble = () => saveState() === 'failed' || saveState() === 'conflict';

/** Whether the open trip's changes are saved, as an icon that says so in its title. */
export function SaveState() {
  return (
    <span class="save-state" classList={{ error: trouble() }} title={SHOWN[saveState()][0]} role="status" aria-label={SHOWN[saveState()][0]}>
      {SHOWN[saveState()][1]()}
    </span>
  );
}

/** What went wrong saving the open trip, over the map, and a way to reload it when it was changed elsewhere; nothing while saving goes well. */
export function SaveProblem(props: { onReload: () => void }) {
  return (
    <Show when={trouble()}>
      <p class="map-card save-problem" role="alert">
        <Show when={saveState() === 'conflict'} fallback={t('Saving failed; trying again shortly.')}>
          {t('The trip was changed elsewhere.')} <button onClick={props.onReload}>{t('Reload it')}</button> {t('to go on; the changes made here since are lost.')}
        </Show>
      </p>
    </Show>
  );
}
