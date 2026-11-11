import { For, Show } from 'solid-js';
import type { RoutePois } from '../api';
import { t } from '../i18n/t';
import { poiBadgeUrl } from '../map/poiImages';
import type { Route } from '../model/trip';
import { categoryOfKept, forget, isOnMap, isOutdated, keptFor, putOnMap, searchAlong } from '../state/routePois';
import { cardMenu } from '../ui/cardMenu';
import { dateText, distanceText } from '../ui/format';

/**
 * The places kept for a route, a button per kind: it shows them on the map or takes them
 * off, without a search. Its menu searches again or forgets them.
 */
export function RoutePlaces(props: { route: Route }) {
  return (
    <Show when={keptFor(props.route.id).length > 0}>
      <div class="route-places">
        <For each={keptFor(props.route.id)}>{(kept) => <Kept kept={kept} route={props.route} />}</For>
      </div>
    </Show>
  );
}

function Kept(props: { kept: RoutePois; route: Route }) {
  const category = () => categoryOfKept(props.kept);
  const outdated = () => isOutdated(props.kept, props.route);
  const said = () =>
    t('{kind}: {n} within {distance} of the route, found {date}.', { kind: category().label, n: props.kept.places.length, distance: distanceText(props.kept.reachM), date: dateText(props.kept.foundAt.slice(0, 10)) }) +
    (outdated() ? ` ${t('The route has changed since.')}` : '');
  const items = () => [
    { label: t('Search again'), run: () => void searchAlong([props.route], [{ category: category(), metres: props.kept.reachM }]) },
    { label: t('Forget'), run: () => void forget(props.kept) },
  ];
  return (
    <button type="button" classList={{ outdated: outdated() }} title={said()} aria-label={said()} aria-pressed={isOnMap(props.kept)} ref={(el) => cardMenu(el, items)} onClick={() => putOnMap(props.kept, !isOnMap(props.kept))}>
      <img class="poi-badge" src={poiBadgeUrl(category())} alt="" /> {props.kept.places.length}
    </button>
  );
}
