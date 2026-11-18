import { createResource, createRoot, createSignal, For, Show } from 'solid-js';
import { changePassword, fetchMe, logout } from '../api';
import { createRequest } from '../ui/request';
import { NEW_TAG_COLOR } from '../model/tag';
import { addTag, removeTag, saveTag, tags } from '../state/tags';
import { chooseLanguage, LANGUAGES, languageChoice, type Language } from '../i18n/language';
import { t } from '../i18n/t';
import { DEFAULT_RIDES_OPACITY, DEFAULT_ROUTE_WIDTH, ROUTE_WIDTHS } from '../model/routeLook';
import { changePreferences, ridesOpacity, routeColoring, routeWidth } from '../state/preferences';
import { chooseTheme, theme, THEMES, type Theme } from '../ui/theme';

/** Whose account it is, asked once. */
const [me] = createRoot(() => createResource(fetchMe));

/**
 * What the user sets for the planner as a whole, in the library's pane under its own
 * tab, each setting kept as soon as it changes: the account with the way out of it, its
 * language and password, then how the map draws routes and rides. A kind of place has its own settings, in the
 * Places tab.
 */
export function Settings() {
  return (
    <div class="settings">
      <section>
        <h3>{t('User')}</h3>
        <p class="row account">
          <span class="grow">{me()?.email}</span>
          <button type="button" class="link" onClick={logout}>
            {t('Sign out')}
          </button>
        </p>
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
          {t('Color scheme (this browser)')}
          <select value={theme()} onChange={(e) => chooseTheme(e.currentTarget.value as Theme)}>
            <For each={THEMES}>{(choice) => <option value={choice.value}>{choice.label}</option>}</For>
          </select>
        </label>
        <label>
          {t('Line width of routes and recordings (px)')}
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
          {t('Default colors for routes')}
          <select value={routeColoring()} onChange={(e) => void changePreferences({ routeColoring: e.currentTarget.value === 'route' ? 'route' : 'day' })}>
            <option value="day">{t('One color for each day')}</option>
            <option value="route">{t('One color for each route')}</option>
          </select>
        </label>
        <label>
          {t('My rides on the map: opacity per ride (%)')}
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
      <TagSettings />
    </div>
  );
}

/** The user's tags: each with its colour and its name to change and a button that deletes it, and a line that makes a new one. */
function TagSettings() {
  const request = createRequest();
  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fields = new FormData(form);
    void request.run(async () => {
      await addTag(String(fields.get('name')), String(fields.get('color')));
      form.reset();
    });
  };
  return (
    <section class="tag-settings">
      <h3>{t('Tags')}</h3>
      <p class="muted">{t('Tags are put on trips from their menu and limit the list of trips.')}</p>
      <For each={tags()}>
        {(tag) => (
          <p class="row">
            <input type="color" aria-label={t('Color of {name}', { name: tag.name })} value={tag.color} onChange={(e) => void request.run(() => saveTag({ ...tag, color: e.currentTarget.value }))} />
            <input class="grow" aria-label={t('Name of {name}', { name: tag.name })} value={tag.name} maxlength={40} required onChange={(e) => void request.run(() => saveTag({ ...tag, name: e.currentTarget.value }))} />
            <button type="button" class="link" onClick={() => void request.run(() => removeTag(tag.id))}>
              {t('Delete')}
            </button>
          </p>
        )}
      </For>
      <form class="row" onSubmit={add}>
        <input type="color" name="color" aria-label={t('Color of the new tag')} value={NEW_TAG_COLOR} />
        <input class="grow" name="name" placeholder={t('New tag')} aria-label={t('New tag')} maxlength={40} required />
        <button type="submit">{t('Add')}</button>
      </form>
      <Show when={request.error()}>{(error) => <p class="error">{error()}</p>}</Show>
    </section>
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
