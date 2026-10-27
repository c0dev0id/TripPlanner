import { createResource, createSignal, For, Show } from 'solid-js';
import { DEFAULT_EXPORT, deleteExportPreset, gpxUrl, listExportPresets, saveExportPreset, type ExportOptions } from '../api';
import { exportOpen, setExportOpen } from '../state/drawing';
import { openTrip, selectedDay } from '../state/trip';
import { showModalWhile } from '../ui/modal';
import { NameForm } from '../ui/NameForm';
import { createRequest } from '../ui/request';
import { dayLabel } from './labels';

const sameOptions = (a: ExportOptions, b: ExportOptions) => a.per === b.per && a.form === b.form && a.optional === b.optional && a.reachM === b.reachM;

/** The GPX export: the whole trip or the selected day, the options, presets kept with the account, and the download. */
export function ExportDialog() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, exportOpen);
  const [presets, { mutate }] = createResource(exportOpen, (open) => (open ? listExportPresets() : []));
  const [scope, setScope] = createSignal<'trip' | 'day'>('trip');
  const [options, setOptions] = createSignal<ExportOptions>(DEFAULT_EXPORT);
  const [naming, setNaming] = createSignal(false);
  const { error, run } = createRequest();
  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => setOptions((o) => ({ ...o, [key]: value }));
  /** The preset whose options are the current ones, if any. */
  const presetId = () => presets()?.find((p) => sameOptions(p.options, options()))?.id;
  const day = () => {
    const d = selectedDay();
    return d && { id: d.id, label: dayLabel(d, openTrip()!.days.indexOf(d)) };
  };
  const url = () => gpxUrl(openTrip()!.id, options(), scope() === 'day' ? day()?.id : undefined);
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
    <dialog ref={dialog} class="dialog export-dialog" aria-label="Export GPX" onClose={() => setExportOpen(false)}>
      <Show when={exportOpen() && openTrip()}>
        <div class="dialog-body">
          <fieldset>
            <legend>Scope</legend>
            <label>
              <input type="radio" name="scope" checked={scope() === 'trip'} onChange={() => setScope('trip')} /> The whole trip
            </label>
            <Show when={day()}>
              {(d) => (
                <label>
                  <input type="radio" name="scope" checked={scope() === 'day'} onChange={() => setScope('day')} /> {d().label}
                </label>
              )}
            </Show>
          </fieldset>
          <fieldset disabled={scope() === 'day'}>
            <legend>Files</legend>
            <label>
              <input type="radio" name="per" checked={options().per === 'trip'} onChange={() => set('per', 'trip')} /> One file
            </label>
            <label>
              <input type="radio" name="per" checked={options().per === 'day'} onChange={() => set('per', 'day')} /> One file per day, zipped
            </label>
          </fieldset>
          <fieldset>
            <legend>Routes as</legend>
            <label>
              <input type="radio" name="form" checked={options().form === 'tracks'} onChange={() => set('form', 'tracks')} /> Tracks, the line as planned
            </label>
            <label>
              <input type="radio" name="form" checked={options().form === 'routes'} onChange={() => set('form', 'routes')} /> Routes of the points, for the device to route
            </label>
          </fieldset>
          <label class="toggle">
            <input type="checkbox" checked={options().optional} onChange={(e) => set('optional', e.currentTarget.checked)} /> Include optional routes and stops
          </label>
          <label class="field reach">
            Free stops within <input type="number" min={0} max={100000} step={100} value={options().reachM} onChange={(e) => set('reachM', Math.max(0, Math.min(100000, Number(e.currentTarget.value) || 0)))} /> m of a route
          </label>
          <div class="row">
            <label class="field grow">
              Preset
              <select class="grow" value={presetId() ?? ''} onChange={(e) => setOptions(presets()?.find((p) => p.id === Number(e.currentTarget.value))?.options ?? options())}>
                <option value="">none</option>
                <For each={presets() ?? []}>{(preset) => <option value={preset.id}>{preset.name}</option>}</For>
              </select>
            </label>
            <button type="button" onClick={() => setNaming(true)} disabled={naming()}>
              Save as…
            </button>
            <button type="button" onClick={() => void removePreset(presetId()!)} disabled={presetId() === undefined}>
              Delete
            </button>
          </div>
          <Show when={naming()}>
            <NameForm placeholder="Name of the preset" button="Save" onSubmit={savePreset} onCancel={() => setNaming(false)} />
          </Show>
          <Show when={error()}>{(message) => <p class="error">{message()}</p>}</Show>
          <div class="row end">
            <button type="button" onClick={() => setExportOpen(false)}>
              Close
            </button>
            <a class="button primary" href={url()} download="">
              Download
            </a>
          </div>
        </div>
      </Show>
    </dialog>
  );
}
