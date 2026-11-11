import { For, Match, Show, Switch } from 'solid-js';
import { t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { poiBadgeUrl } from './poiImages';
import { clearPois, foundPois, poiSearch } from '../state/poi';

/** How the POI search went, over the map: searching, what was found by kind, or why not; and the way to clear it. */
export function PoiBar() {
  const counts = () => POI_CATEGORIES.map((category) => ({ category, count: foundPois().filter((p) => p.category === category).length })).filter((c) => c.count > 0);
  const searching = () => {
    const search = poiSearch();
    return search?.state === 'searching' ? search : undefined;
  };
  const truncated = () => {
    const search = poiSearch();
    return search?.state === 'found' && search.truncated;
  };
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
      <Show when={truncated()}>
        <span class="failed">{t('There are more than shown')}</span>
      </Show>
    </>
  );
  return (
    <Show when={poiSearch()}>
      <div class="routing-bar poi-bar">
        <Switch fallback={found}>
          <Match when={searching()}>
            {(progress) => (
              <span>
                {t('Searching POI…')}
                <Show when={progress().total > 1}>
                  {' '}
                  {progress().done + 1}/{progress().total}
                </Show>
              </span>
            )}
          </Match>
          <Match when={failed()}>{(failure) => <span class="failed">{failure().message}</span>}</Match>
          <Match when={foundPois().length === 0}>
            <span>{t('No POI found')}</span>
          </Match>
        </Switch>
        <button onClick={clearPois}>{t('Clear')}</button>
      </div>
    </Show>
  );
}
