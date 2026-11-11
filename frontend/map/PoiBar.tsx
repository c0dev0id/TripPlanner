import { For, Match, Show, Switch } from 'solid-js';
import { plural, t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { POI_LIMIT } from '../poi/overpass';
import { poiBadgeUrl } from './poiImages';
import { clearPois, foundPois, poiSearch } from '../state/poi';

/** How the POI search went, over the map: searching, what was found by kind, or why not; and the way to clear it. */
export function PoiBar() {
  const counts = () => POI_CATEGORIES.map((category) => ({ category, count: foundPois().filter((p) => p.category === category).length })).filter((c) => c.count > 0);
  const failed = () => {
    const search = poiSearch();
    return search?.state === 'failed' ? search : undefined;
  };
  const found = (
    <>
      <For each={counts()}>
        {({ category, count }) => (
          <span>
            <img class="poi-badge" src={poiBadgeUrl(category)} alt="" /> {count} {category.label}
          </span>
        )}
      </For>
      <Show when={foundPois().length >= POI_LIMIT}>
        <span class="failed">{plural(POI_LIMIT, 'Only the first {n} is shown|Only the first {n} are shown')}</span>
      </Show>
    </>
  );
  return (
    <Show when={poiSearch()}>
      {(search) => (
        <div class="routing-bar poi-bar">
          <Switch fallback={found}>
            <Match when={search().state === 'searching'}>
              <span>{t('Searching POI…')}</span>
            </Match>
            <Match when={failed()}>{(failure) => <span class="failed">{failure().message}</span>}</Match>
            <Match when={foundPois().length === 0}>
              <span>{t('No POI found')}</span>
            </Match>
          </Switch>
          <button onClick={clearPois}>{t('Clear')}</button>
        </div>
      )}
    </Show>
  );
}
