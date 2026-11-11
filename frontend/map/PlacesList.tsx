import { For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { setPreferencesOpen } from '../state/drawing';
import { alongOnly, isKindShown, isTooFarOut, placesListOpen, shownKindCount, toggleAlongOnly, toggleKind } from '../state/places';
import { poiBadgeUrl } from './poiImages';

/**
 * The kinds of places as layers to switch on and off, whether only those along the day's
 * routes are shown, and the way to the distances; open while its button in the panel is
 * pressed. Kept for this browser.
 */
export function PlacesList() {
  return (
    <Show when={placesListOpen()}>
      <fieldset class="choices places-list">
        <legend>{t('Places')}</legend>
        <For each={POI_CATEGORIES}>
          {(category) => (
            <label>
              <input type="checkbox" checked={isKindShown(category)} onChange={() => toggleKind(category)} />
              <img class="poi-badge" src={poiBadgeUrl(category)} alt="" />
              {category.label}
            </label>
          )}
        </For>
        <label class="along">
          <input type="checkbox" checked={alongOnly()} onChange={toggleAlongOnly} />
          <span>
            {t('Only along the day\'s routes')}{' '}
            <button type="button" class="link" onClick={() => setPreferencesOpen(true)}>
              {t('Distances…')}
            </button>
          </span>
        </label>
        <Show when={shownKindCount() > 0 && isTooFarOut()}>
          <p class="muted">{t('Zoom in to see places.')}</p>
        </Show>
      </fieldset>
    </Show>
  );
}
