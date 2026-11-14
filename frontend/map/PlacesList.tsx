import { For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { setPreferencesOpen } from '../state/drawing';
import { isOwnKindShown, ownKinds, toggleOwnKind } from '../state/ownPlaces';
import { alongOnly, isKindShown, isTooFarOut, placesListOpen, shownKindCount, toggleAlongOnly, toggleKind } from '../state/places';
import { poiBadgeUrl } from './poiImages';

/**
 * The kinds of places as layers to switch on and off: those of OpenStreetMap, with whether
 * only the ones along the day's routes are shown and the way to the distances; then, under
 * the name of each of the user's own lists, its kinds, each with the colour its places are
 * drawn in and how many it holds. Open while its button in the panel is pressed; kept for
 * this browser.
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
        <For each={ownKinds()}>
          {(kind, index) => (
            <>
              <Show when={ownKinds()[index() - 1]?.list !== kind.list}>
                <p class="muted own-list">{kind.list}</p>
              </Show>
              <label>
                <input type="checkbox" checked={isOwnKindShown(kind)} onChange={() => toggleOwnKind(kind)} />
                <span class="own-dot" style={{ background: kind.color }} />
                {kind.name}
                <span class="muted"> · {kind.count}</span>
              </label>
            </>
          )}
        </For>
      </fieldset>
    </Show>
  );
}
