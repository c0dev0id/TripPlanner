import { createSignal, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { routePositions } from '../routing/legs';
import { poiSearchSpot, searchPois, setPoiSearchSpot } from '../state/poi';
import { openTrip, selectedDay } from '../state/trip';
import { dayLabelOf } from '../trip/labels';
import { showModalWhile } from '../ui/modal';
import { poiBadgeUrl } from './poiImages';

/** The distances around a spot to choose from, in kilometres. */
const SPOT_KM = [1, 2, 5, 10, 20];
const MAX_KM = 20;

/**
 * The POI search: the kinds of places to look for, and where: around the spot it was opened
 * for within one distance, or along the selected day's routes within a distance per kind.
 * The choices hold until the page is left.
 */
export function PoiDialog() {
  let dialog!: HTMLDialogElement;
  showModalWhile(() => dialog, () => poiSearchSpot() !== undefined);
  const [alongDay, setAlongDay] = createSignal(false);
  const [spotKm, setSpotKm] = createSignal(5);
  const [chosen, setChosen] = createSignal<readonly string[]>(['fuel', 'hotel', 'restaurant']);
  const [alongKm, setAlongKm] = createSignal<Readonly<Record<string, number>>>(Object.fromEntries(POI_CATEGORIES.map((c) => [c.id, c.alongM / 1000])));
  const close = () => setPoiSearchSpot(undefined);
  /** The selected day's routes that are lines. */
  const lines = () => (selectedDay()?.routes ?? []).map(routePositions).filter((line) => line.length > 1);
  const along = () => alongDay() && lines().length > 0;
  const toggle = (id: string, on: boolean) => setChosen((ids) => (on ? [...ids, id] : ids.filter((other) => other !== id)));
  const search = (e: SubmitEvent) => {
    e.preventDefault();
    const categories = POI_CATEGORIES.filter((c) => chosen().includes(c.id));
    const reaches = categories.map((category) => ({ category, metres: (along() ? alongKm()[category.id]! : spotKm()) * 1000 }));
    void searchPois(reaches, along() ? { lines: lines() } : { spot: poiSearchSpot()! });
    close();
  };
  return (
    <dialog ref={dialog} class="dialog poi-dialog" aria-label={t('Find POI')} onClose={close}>
      <Show when={poiSearchSpot()}>
        <form class="dialog-body" onSubmit={search}>
          <h3 class="name">{t('Find POI')}</h3>
          <fieldset class="choices">
            <legend>{t('Where')}</legend>
            <label>
              <input type="radio" name="where" checked={!along()} onChange={() => setAlongDay(false)} /> {t('Around this spot, within')}
              <select value={spotKm()} disabled={along()} onChange={(e) => setSpotKm(Number(e.currentTarget.value))}>
                <For each={SPOT_KM}>{(km) => <option value={km}>{km} km</option>}</For>
              </select>
            </label>
            <Show when={lines().length > 0}>
              <label>
                <input type="radio" name="where" checked={along()} onChange={() => setAlongDay(true)} /> {t('Along the routes of {day}, within the distance of each kind', { day: dayLabelOf(openTrip()!, selectedDay()!) })}
              </label>
            </Show>
          </fieldset>
          <fieldset class="choices">
            <legend>{t('What')}</legend>
            <For each={POI_CATEGORIES}>
              {(category) => (
                <label>
                  <input type="checkbox" checked={chosen().includes(category.id)} onChange={(e) => toggle(category.id, e.currentTarget.checked)} />
                  <img class="poi-badge" src={poiBadgeUrl(category)} alt="" />
                  <span class="grow">{category.label}</span>
                  <Show when={along()}>
                    <input
                      type="number"
                      aria-label={t('Distance from the route in km')}
                      min={0.1}
                      max={MAX_KM}
                      step={0.1}
                      value={alongKm()[category.id]}
                      disabled={!chosen().includes(category.id)}
                      onChange={(e) => setAlongKm((km) => ({ ...km, [category.id]: Math.max(0.1, Math.min(MAX_KM, Number(e.currentTarget.value) || category.alongM / 1000)) }))}
                    />
                    km
                  </Show>
                </label>
              )}
            </For>
          </fieldset>
          <div class="row end">
            <button type="button" onClick={close}>
              {t('Cancel')}
            </button>
            <button type="submit" class="primary" disabled={chosen().length === 0}>
              {t('Search')}
            </button>
          </div>
        </form>
      </Show>
    </dialog>
  );
}
