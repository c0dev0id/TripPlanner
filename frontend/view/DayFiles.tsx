import { t } from '../i18n/t';
import { For } from 'solid-js';
import { routeGpxUrl } from '../api';
import type { Day } from '../model/trip';
import { routeLabel } from '../trip/labels';

/** A day's GPX files: one for each of its routes and tracks, each a single line, as most devices take a file to be. A day of one route has the one file of the day. */
export function DayFiles(props: { day: Day; api: string }) {
  return (
    <For each={props.day.routes}>
      {(route) => (
        <a class="gpx" href={routeGpxUrl(props.api, route.id)}>
          {props.day.routes.length === 1 ? t('Download GPX') : t('GPX: {name}', { name: routeLabel(route, props.day) })}
        </a>
      )}
    </For>
  );
}
