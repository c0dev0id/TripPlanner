import { t } from '../i18n/t';
import { For, Show } from 'solid-js';
import { tripGpxUrl } from '../api';
import type { Trip } from '../model/trip';
import { dateText } from '../ui/format';
import { DayLine } from './DayLine';
import { DayStops, daySummary } from './DayStops';

/** The plan, day by day: each day's number, date, name, length and times, what was noted about it, its stops, the shape of its route and its GPX file. */
export function PlanDays(props: { trip: Trip; api: string; gpx: boolean }) {
  return (
    <section id="days" class="days">
      <h2>{t('Day by day')}</h2>
      <For each={props.trip.days}>
        {(day, index) => (
          <article class="day-card">
            <span class="number">{index() + 1}</span>
            <div class="about">
              <Show when={day.date}>{(date) => <p class="overline">{dateText(date())}</p>}</Show>
              <h3>{day.name || t('Day {n}', { n: index() + 1 })}</h3>
              <p class="meta">{daySummary(day)}</p>
              <Show when={day.notes}>
                <p class="notes">{day.notes}</p>
              </Show>
            </div>
            <DayStops day={day} />
            <div class="shape">
              <DayLine day={day} width={72} height={96} />
              <Show when={props.gpx && day.routes.length > 0}>
                <a href={tripGpxUrl(props.api, day.id)}>{t('GPX of the day')}</a>
              </Show>
            </div>
          </article>
        )}
      </For>
    </section>
  );
}
