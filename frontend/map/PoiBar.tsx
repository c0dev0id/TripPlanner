import { For, Match, Show, Switch } from 'solid-js';
import { plural, t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { POI_LIMIT } from '../poi/overpass';
import { clearPois, foundPois, poiSearch } from '../state/poi';

/** How the POI search went, over the map: searching, what was found by kind, or why not; and the way to clear it. */
export function PoiBar() {
  const counts = () => POI_CATEGORIES.map((category) => ({ category, count: foundPois().filter((p) => p.categoryId === category.id).length })).filter((c) => c.count > 0);
  return (
    <Show when={poiSearch()}>
      {(search) => (
        <div class="poi-bar">
          <Switch>
            <Match when={search().state === 'searching'}>
              <span>{t('Searching POI…')}</span>
            </Match>
            <Match when={search().state === 'failed'}>
              <span class="failed">{(search() as { message: string }).message}</span>
            </Match>
            <Match when={foundPois().length === 0}>
              <span>{t('No POI found')}</span>
            </Match>
            <Match when={true}>
              <For each={counts()}>
                {({ category, count }) => (
                  <span>
                    <span class="poi-dot" style={{ background: category.color }} /> {count} {category.label}
                  </span>
                )}
              </For>
              <Show when={foundPois().length >= POI_LIMIT}>
                <span class="failed">{plural(POI_LIMIT, 'Only the first {n} is shown|Only the first {n} are shown')}</span>
              </Show>
            </Match>
          </Switch>
          <button onClick={clearPois}>{t('Clear')}</button>
        </div>
      )}
    </Show>
  );
}
