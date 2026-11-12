import { t } from '../i18n/t';
import { createEffect, createResource, createSignal, For, on, Show } from 'solid-js';
import { DEFAULT_EXPORT, deleteExportPreset, gpxUrl, listExportPresets, saveExportPreset, type ExportOptions } from '../api';
import { flushSave } from '../state/autosave';
import { dayOfRoute } from '../routing/dayEdit';
import { exportScope, setExportScope } from '../state/drawing';
import { openTrip, openTripId, routeById, selectedDay } from '../state/trip';
import { counted } from '../ui/format';
import { showModalWhile } from '../ui/modal';
import { NameForm } from '../ui/NameForm';
import { createRequest } from '../ui/request';
import { dayTitleOf, routeLabelOf } from './labels';
import { NOUNS } from './partMenu';

const sameOptions = (a: ExportOptions, b: ExportOptions) => a.per === b.per && a.form === b.form && a.optional === b.optional && a.reachM === b.reachM;

/**
 * The GPX export: the whole trip, or a part of it (the days or routes its menu was opened
 * on, else the day picked), the options, presets kept with the account, and the download.
 * What is exported is what is saved, so opening it saves first.
 */
export function ExportDialog() {
  let dialog!: HTMLDialogElement;
  const exportOpen = () => exportScope() !== undefined;
  showModalWhile(() => dialog, exportOpen);
  const [presets, { mutate }] = createResource(exportOpen, (open) => (open ? listExportPresets() : []));
  const [scope, setScope] = createSignal<'trip' | 'part'>('trip');
  // Asked for from a menu, the parts are what is exported unless the user says otherwise.
  createEffect(
    on(exportScope, (asked) => {
      if (!asked) return;
      setScope(asked.kind === 'trip' ? 'trip' : 'part');
      void flushSave();
    }),
  );
  const [options, setOptions] = createSignal<ExportOptions>(DEFAULT_EXPORT);
  const [naming, setNaming] = createSignal(false);
  const { error, run } = createRequest();
  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => setOptions((o) => ({ ...o, [key]: value }));
  /** The preset whose options are the current ones, if any. */
  const presetId = () => presets()?.find((p) => sameOptions(p.options, options()))?.id;
  /** The part offered beside the whole trip, and what it is called: one by its name, several by their number. */
  const part = () => {
    const asked = exportScope();
    const trip = openTrip()!;
    const day = selectedDay();
    const of = asked && asked.kind !== 'trip' ? asked : day ? { kind: 'day' as const, ids: [day.id] } : undefined;
    if (!of) return undefined;
    const [only] = of.ids;
    if (of.ids.length > 1) return { of, label: counted(of.ids.length, NOUNS[of.kind][trip.kind]) };
    const route = of.kind === 'route' ? routeById(only!) : undefined;
    const named = of.kind === 'day' ? trip.days.find((d) => d.id === only) : undefined;
    return { of, label: route ? routeLabelOf(trip, route) : named ? dayTitleOf(trip, named) : '' };
  };
  const chosen = () => (scope() === 'part' ? part()?.of : undefined);
  /** What lies in one day is one file, as the server sends it. */
  const oneDay = () => {
    const of = chosen();
    return of !== undefined && new Set(of.kind === 'day' ? of.ids : of.ids.map((id) => dayOfRoute(openTrip()!, id)?.id)).size === 1;
  };
  const url = () => gpxUrl(openTripId()!, options(), chosen());
  const savePreset = (name: string) =>
    run(async () => {
      const preset = await saveExportPreset(name, options());
      mutate((list = []) => [...list.filter((p) => p.name !== preset.name), preset].sort((a, b) => a.name.localeCompare(b.name)));
      setNaming(false);
    });
  const removePreset = (id: number) =>
    run(async () => {
      await deleteExportPreset(id);
      mutate((list) => list?.filter((p) => p.id !== id));
    });
  return (
    <dialog ref={dialog} class="dialog export-dialog" aria-label={t('Export GPX')} onClose={() => setExportScope(undefined)}>
      <Show when={exportOpen() && openTrip()}>
        <div class="dialog-body">
          <fieldset>
            <legend>{t('Scope')}</legend>
            <label>
              <input type="radio" name="scope" checked={scope() === 'trip'} onChange={() => setScope('trip')} /> {t('The whole trip')}
            </label>
            <Show when={part()}>
              {(p) => (
                <label>
                  <input type="radio" name="scope" checked={scope() === 'part'} onChange={() => setScope('part')} /> {p().label}
                </label>
              )}
            </Show>
          </fieldset>
          <fieldset disabled={oneDay()}>
            <legend>{t('Files')}</legend>
            <label>
              <input type="radio" name="per" checked={options().per === 'trip'} onChange={() => set('per', 'trip')} /> {t('One file')}
            </label>
            <label>
              <input type="radio" name="per" checked={options().per === 'day'} onChange={() => set('per', 'day')} /> {t('One file per day, zipped')}
            </label>
          </fieldset>
          <fieldset>
            <legend>{t('Routes as')}</legend>
            <label>
              <input type="radio" name="form" checked={options().form === 'tracks'} onChange={() => set('form', 'tracks')} /> {t('Tracks, the line as planned')}
            </label>
            <label>
              <input type="radio" name="form" checked={options().form === 'routes'} onChange={() => set('form', 'routes')} /> {t('Routes of the points, for the device to route')}
            </label>
          </fieldset>
          <label class="toggle">
            <input type="checkbox" checked={options().optional} onChange={(e) => set('optional', e.currentTarget.checked)} /> {t('Include optional routes and stops')}
          </label>
          <label class="field reach">
            {t('Free stops within')} <input type="number" min={0} max={100000} step={100} value={options().reachM} onChange={(e) => set('reachM', Math.max(0, Math.min(100000, Number(e.currentTarget.value) || 0)))} /> {t('m of a route')}
          </label>
          <div class="row">
            <label class="field grow">
              {t('Preset')}
              <select class="grow" value={presetId() ?? ''} onChange={(e) => setOptions(presets()?.find((p) => p.id === Number(e.currentTarget.value))?.options ?? options())}>
                <option value="">{t('none')}</option>
                <For each={presets() ?? []}>{(preset) => <option value={preset.id}>{preset.name}</option>}</For>
              </select>
            </label>
            <button type="button" onClick={() => setNaming(true)} disabled={naming()}>
              {t('Save as…')}
            </button>
            <button type="button" onClick={() => void removePreset(presetId()!)} disabled={presetId() === undefined}>
              {t('Delete')}
            </button>
          </div>
          <Show when={naming()}>
            <NameForm placeholder={t('Name of the preset')} button={t('Save')} onSubmit={savePreset} onCancel={() => setNaming(false)} />
          </Show>
          <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
          <div class="row end">
            <button type="button" onClick={() => setExportScope(undefined)}>
              {t('Close')}
            </button>
            <a class="button primary" href={url()} download="">
              {t('Download')}
            </a>
          </div>
        </div>
      </Show>
    </dialog>
  );
}
