import { For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { POI_CATEGORIES } from '../poi/categories';
import { poiBadgeUrl } from './poiImages';
import { clearPois, foundPois, poiSearch, stopPoiSearch } from '../state/poi';

/**
 * How the POI search goes, over the map: what was found by kind, so far while it runs, how
 * far it is or why it ended early, and the way to stop it or to clear what it found.
 */
export function PoiBar() {
  const counts = () => POI_CATEGORIES.map((category) => ({ category, count: foundPois().filter((p) => p.category === category).length })).filter((c) => c.count > 0);
  return (
    <Show when={poiSearch()}>
      {(search) => (
        <div class="routing-bar poi-bar">
          <For each={counts()}>
            {({ category, count }) => (
              <span>
                <img class="poi-badge" src={poiBadgeUrl(category)} alt="" /> {count} {category.label}
              </span>
            )}
          </For>
          <Show when={search().truncated}>
            <span class="failed">{t('There are more than shown')}</span>
          </Show>
          <Show when={search().failure}>{(failure) => <span class="failed">{failure()}</span>}</Show>
          <Show
            when={search().searching}
            fallback={
              <>
                <Show when={foundPois().length === 0 && !search().failure}>
                  <span>{t('No POI found')}</span>
                </Show>
                <button onClick={clearPois}>{t('Clear')}</button>
              </>
            }
          >
            {(progress) => (
              <>
                <span>
                  {t('Searching POI…')}
                  <Show when={progress().total > 1}>
                    {' '}
                    {progress().done + 1}/{progress().total}
                  </Show>
                </span>
                <button onClick={stopPoiSearch}>{t('Stop')}</button>
              </>
            )}
          </Show>
        </div>
      )}
    </Show>
  );
}
