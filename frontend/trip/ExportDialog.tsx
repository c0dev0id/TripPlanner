import { createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { DEFAULT_EXPORT, deleteExportPreset, errorMessage, gpxUrl, listExportPresets, saveExportPreset, type ExportOptions } from '../api';
import { exportOpen, setExportOpen } from '../state/drawing';
import { openTrip, selectedDayId } from '../state/trip';
import { showModalWhile } from '../ui/modal';
import { dayLabel } from './labels';

/** What the dialog takes besides the options: the whole trip or the selected day. */
type Scope = 'trip' | 'day';

/** The GPX export: its scope, the options, presets kept with the account, and the download. */
export function ExportDialog() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, exportOpen);
  const [presets, { refetch }] = createResource(exportOpen, (open) => (open ? listExportPresets() : []));
  const [scope, setScope] = createSignal<Scope>('trip');
  const [options, setOptions] = createSignal<ExportOptions>(DEFAULT_EXPORT);
  const [presetId, setPresetId] = createSignal<number>();
  const [presetName, setPresetName] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
    setPresetId(undefined);
  };
  const day = createMemo(() => {
    const trip = openTrip();
    const index = trip?.days.findIndex((d) => d.id === selectedDayId()) ?? -1;
    return trip && index >= 0 ? { id: trip.days[index]!.id, label: dayLabel(trip.days[index]!, index) } : undefined;
  });
  const url = () => gpxUrl(openTrip()!.id, options(), scope() === 'day' ? day()?.id : undefined);
  const choosePreset = (id: number | undefined) => {
    const preset = presets()?.find((p) => p.id === id);
    setPresetId(preset?.id);
    if (preset) setOptions(preset.options);
  };
  const savePreset = async (e: SubmitEvent) => {
    e.preventDefault();
    const name = presetName()?.trim();
    if (!name) return;
    try {
      const preset = await saveExportPreset(name, options());
      setPresetName(undefined);
      await refetch();
      setPresetId(preset.id);
    } catch (fault) {
      setError(errorMessage(fault));
    }
  };
  const removePreset = async () => {
    const id = presetId();
    if (id === undefined) return;
    try {
      await deleteExportPreset(id);
      setPresetId(undefined);
      await refetch();
    } catch (fault) {
      setError(errorMessage(fault));
    }
  };
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
              <select class="grow" value={presetId() ?? ''} onChange={(e) => choosePreset(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}>
                <option value="">none</option>
                <For each={presets() ?? []}>{(preset) => <option value={preset.id}>{preset.name}</option>}</For>
              </select>
            </label>
            <button type="button" onClick={() => setPresetName('')} disabled={presetName() !== undefined}>
              Save as…
            </button>
            <button type="button" onClick={() => void removePreset()} disabled={presetId() === undefined}>
              Delete
            </button>
          </div>
          <Show when={presetName() !== undefined}>
            <form class="row" onSubmit={(e) => void savePreset(e)}>
              <input class="grow" placeholder="Name of the preset" aria-label="Name of the preset" value={presetName()} onInput={(e) => setPresetName(e.currentTarget.value)} maxlength={200} />
              <button type="submit" disabled={!presetName()?.trim()}>
                Save
              </button>
              <button type="button" onClick={() => setPresetName(undefined)}>
                Cancel
              </button>
            </form>
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
