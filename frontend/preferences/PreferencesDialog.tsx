import { For } from 'solid-js';
import { chooseLanguage, LANGUAGES, languageChoice, type Language } from '../i18n/language';
import { t } from '../i18n/t';
import { poiBadgeUrl } from '../map/poiImages';
import { DEFAULT_ROUTE_WIDTH, ROUTE_WIDTHS } from '../model/routeLook';
import { POI_CATEGORIES } from '../poi/categories';
import { preferencesOpen, setPreferencesOpen } from '../state/drawing';
import { changePreferences, placeReachM, routeColoring, routeWidth } from '../state/preferences';
import { EditDialog } from '../ui/EditDialog';
import { chooseTheme, theme, THEMES, type Theme } from '../ui/theme';

/** The farthest a place may be from a route and still be shown along it, in kilometres. */
const MAX_KM = 20;

/**
 * What the user sets for the planner as a whole: for this browser its language and its
 * light or dark colours, and for the account how wide routes are drawn, how they get
 * their colours, and how far from a route a place of each kind is still shown along it.
 */
export function PreferencesDialog() {
  const save = async (form: FormData) => {
    const reaches = POI_CATEGORIES.map((category) => [category.id, Math.round(Math.max(0.1, Math.min(MAX_KM, Number(form.get(category.id)) || 0.2)) * 1000)]);
    chooseTheme(form.get('theme') as Theme);
    await changePreferences({
      placeReachM: Object.fromEntries(reaches),
      routeWidth: Math.max(ROUTE_WIDTHS.min, Math.min(ROUTE_WIDTHS.max, Number(form.get('routeWidth')) || DEFAULT_ROUTE_WIDTH)),
      routeColoring: form.get('routeColoring') === 'route' ? 'route' : 'day',
    });
    // Last, since another language loads the page again.
    const chosen = form.get('language') as Language | 'auto';
    if (chosen !== languageChoice) chooseLanguage(chosen);
  };
  return (
    <EditDialog label={t('Preferences')} value={preferencesOpen() || undefined} title={() => t('Preferences')} onClose={() => setPreferencesOpen(false)} onSubmit={(form) => void save(form)}>
      {() => (
        <>
          <label>
            {t('Language, in this browser')}
            <select name="language" value={languageChoice}>
              <For each={LANGUAGES}>{(choice) => <option value={choice.value}>{choice.value === 'auto' ? t('As the browser says') : choice.label}</option>}</For>
            </select>
          </label>
          <label>
            {t('Colors, in this browser')}
            <select name="theme" value={theme()}>
              <For each={THEMES}>{(choice) => <option value={choice.value}>{choice.label}</option>}</For>
            </select>
          </label>
          <label>
            {t('Width of the lines of routes and recordings, in pixels')}
            <input type="number" name="routeWidth" min={ROUTE_WIDTHS.min} max={ROUTE_WIDTHS.max} step={0.5} value={routeWidth()} />
          </label>
          <label>
            {t('Colors of routes that have none of their own')}
            <select name="routeColoring" value={routeColoring()}>
              <option value="day">{t('One color for each day')}</option>
              <option value="route">{t('One color for each route')}</option>
            </select>
          </label>
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
        </>
      )}
    </EditDialog>
  );
}
