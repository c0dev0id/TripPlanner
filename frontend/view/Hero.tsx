import { sizesBeside } from './layout';
import { t } from '../i18n/t';
import { createMemo, Show } from 'solid-js';
import { coverImageUrl, routeGpxUrl } from '../api';
import type { Shown } from '../model/publication';
import type { Trip } from '../model/trip';
import { routesDistance } from '../routing/legs';
import { counted, dateText, distanceText } from '../ui/format';

/**
 * The head of the trip's page: its cover, how long and how far it goes and when, its name
 * and description, and what is done with the page: its GPX files, its days, printing. A
 * trip of one route has that route's file at hand; one of more has them with its days.
 */
export function Hero(props: { trip: Trip; shown: Shown; api: string }) {
  const routes = () => props.trip.days.flatMap((d) => d.routes);
  const distance = createMemo(() => routesDistance(routes()));
  const dates = createMemo(() => props.trip.days.flatMap((d) => (d.date ? [d.date] : [])).sort());
  const span = () => {
    const [first, last] = [dates()[0], dates().at(-1)];
    return !first ? '' : first === last ? dateText(first) : `${dateText(first)} – ${dateText(last!)}`;
  };
  const cover = (px: 1280 | 2048) => coverImageUrl(props.api, props.shown.coverEntryId!, px);
  return (
    <header class="hero">
      <Show when={props.shown.coverEntryId !== null}>
        <img class="cover" src={cover(1280)} srcset={`${cover(1280)} 1280w, ${cover(2048)} 2048w`} sizes={sizesBeside('64vw')} alt="" />
      </Show>
      <div class="column">
        <p class="overline">{[counted(props.trip.days.length, 'day'), distance() > 0 && distanceText(distance()), span(), props.trip.state === 'done' && t('completed')].filter(Boolean).join(' · ')}</p>
        <h1>{props.trip.name}</h1>
        <Show when={props.trip.description}>
          <p class="lede">{props.trip.description}</p>
        </Show>
        <p class="actions">
          <Show when={props.shown.gpx && routes().length > 0}>
            <a class="button primary" href={routes().length === 1 ? routeGpxUrl(props.api, routes()[0]!.id) : '#days'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 4v11" />
                <path d="M7 11l5 5 5-5" />
                <path d="M5 20h14" />
              </svg>
              {t(routes().length === 1 ? 'Download GPX' : 'GPX files')}
            </a>
          </Show>
          <a class="button" href="#days">
            {t('Day by day')}
          </a>
          <button type="button" class="button" onClick={() => window.print()}>
            {t('Print')}
          </button>
        </p>
      </div>
    </header>
  );
}
