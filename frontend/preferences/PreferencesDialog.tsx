import { For } from 'solid-js';
import { t } from '../i18n/t';
import { poiBadgeUrl } from '../map/poiImages';
import { POI_CATEGORIES, type PoiCategoryId } from '../poi/categories';
import { preferencesOpen, setPreferencesOpen } from '../state/drawing';
import { placeReachM, setPlaceReaches } from '../state/preferences';
import { EditDialog } from '../ui/EditDialog';

/** The farthest a place may be from a route and still be shown along it, in kilometres. */
const MAX_KM = 20;

/** What the user sets for the planner as a whole: how far from a route a place of each kind is still shown along it. */
export function PreferencesDialog() {
  const save = (form: FormData) => {
    const reaches = POI_CATEGORIES.map((category): [PoiCategoryId, number] => [category.id, Math.round(Math.max(0.1, Math.min(MAX_KM, Number(form.get(category.id)) || 0.2)) * 1000)]);
    void setPlaceReaches(Object.fromEntries(reaches));
  };
  return (
    <EditDialog label={t('Preferences')} value={preferencesOpen() || undefined} title={() => t('Preferences')} onClose={() => setPreferencesOpen(false)} onSubmit={save}>
      {() => (
        <fieldset class="choices place-reaches">
          <legend>{t('Places along a route: how far from it, in km')}</legend>
          <For each={POI_CATEGORIES}>
            {(category) => (
              <label>
                <img class="poi-badge" src={poiBadgeUrl(category)} alt="" />
                <span class="grow">{category.label}</span>
                <input type="number" name={category.id} min={0.1} max={MAX_KM} step={0.1} value={placeReachM(category.id) / 1000} />
              </label>
            )}
          </For>
        </fieldset>
      )}
    </EditDialog>
  );
}
