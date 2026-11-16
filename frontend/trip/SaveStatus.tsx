import { Show } from 'solid-js';
import { t } from '../i18n/t';
import { saveState } from '../state/autosave';

const trouble = () => saveState() === 'failed' || saveState() === 'conflict';

/** What went wrong saving the open trip, over the map, and a way to reload it when it was changed elsewhere; nothing while saving goes well. */
export function SaveProblem(props: { onReload: () => void }) {
  return (
    <Show when={trouble()}>
      <p class="map-card save-problem" role="alert">
        <Show when={saveState() === 'conflict'} fallback={t('Saving failed; retrying shortly.')}>
          {t('The trip was changed elsewhere.')} <button onClick={props.onReload}>{t('Reload')}</button> {t('to continue; changes made here since then are lost.')}
        </Show>
      </p>
    </Show>
  );
}
