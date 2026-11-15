import { createSignal, For, Show } from 'solid-js';
import { changePassword } from '../api';
import { createRequest } from '../ui/request';
import { chooseLanguage, LANGUAGES, languageChoice, type Language } from '../i18n/language';
import { t } from '../i18n/t';
import { DEFAULT_RIDES_OPACITY, DEFAULT_ROUTE_WIDTH, ROUTE_WIDTHS } from '../model/routeLook';
import { changePreferences, ridesOpacity, routeColoring, routeWidth } from '../state/preferences';
import { chooseTheme, theme, THEMES, type Theme } from '../ui/theme';

/**
 * What the user sets for the planner as a whole, in the library's pane under its own
 * tab, each setting kept as soon as it changes: the account's language and password,
 * then how the map draws routes and rides. A kind of place has its own settings, in the
 * Places tab.
 */
export function Settings() {
  return (
    <div class="settings">
      <section>
        <h3>{t('User')}</h3>
        <label>
          {t('Language (this browser)')}
          <select value={languageChoice} onChange={(e) => chooseLanguage(e.currentTarget.value as Language | 'auto')}>
            <For each={LANGUAGES}>{(choice) => <option value={choice.value}>{choice.value === 'auto' ? t('Browser default') : choice.label}</option>}</For>
          </select>
        </label>
        <PasswordForm />
      </section>
      <section>
        <h3>{t('Map')}</h3>
        <label>
          {t('Colors (this browser)')}
          <select value={theme()} onChange={(e) => chooseTheme(e.currentTarget.value as Theme)}>
            <For each={THEMES}>{(choice) => <option value={choice.value}>{choice.label}</option>}</For>
          </select>
        </label>
        <label>
          {t('Line width of routes and recordings, in pixels')}
          <input
            type="number"
            min={ROUTE_WIDTHS.min}
            max={ROUTE_WIDTHS.max}
            step={0.5}
            value={routeWidth()}
            onChange={(e) => void changePreferences({ routeWidth: Math.max(ROUTE_WIDTHS.min, Math.min(ROUTE_WIDTHS.max, Number(e.currentTarget.value) || DEFAULT_ROUTE_WIDTH)) })}
          />
        </label>
        <label>
          {t('Colors of routes without a color of their own')}
          <select value={routeColoring()} onChange={(e) => void changePreferences({ routeColoring: e.currentTarget.value === 'route' ? 'route' : 'day' })}>
            <option value="day">{t('One color for each day')}</option>
            <option value="route">{t('One color for each route')}</option>
          </select>
        </label>
        <label>
          {t('Opacity of a recording on the map, in percent')}
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={Math.round(ridesOpacity() * 100)}
            onChange={(e) => void changePreferences({ ridesOpacity: Math.max(0.05, Math.min(1, Number(e.currentTarget.value) / 100 || DEFAULT_RIDES_OPACITY)) })}
          />
        </label>
      </section>
    </div>
  );
}

/** Changes the account's password: the one in use, and the new one twice. */
function PasswordForm() {
  const request = createRequest();
  const [changed, setChanged] = createSignal(false);
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fields = new FormData(form);
    setChanged(false);
    void request.run(async () => {
      await changePassword(String(fields.get('current')), String(fields.get('password')), String(fields.get('repeat')));
      form.reset();
      setChanged(true);
    });
  };
  return (
    <form class="password" onSubmit={submit}>
      <h4>{t('Change password')}</h4>
      <label>
        {t('Current password')}
        <input type="password" name="current" autocomplete="current-password" required />
      </label>
      <label>
        {t('New password')}
        <input type="password" name="password" autocomplete="new-password" required />
      </label>
      <label>
        {t('Repeat new password')}
        <input type="password" name="repeat" autocomplete="new-password" required />
      </label>
      <Show when={request.error()}>{(error) => <p class="error">{error()}</p>}</Show>
      <Show when={changed()}>
        <p class="hint">{t('Password changed.')}</p>
      </Show>
      <button type="submit" disabled={request.busy()}>
        {t('Change password')}
      </button>
    </form>
  );
}
