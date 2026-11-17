import { t } from '../i18n/t';
import { For, Show } from 'solid-js';
import { tripGpxUrl } from '../api';
import type { Entry } from '../model/journal';
import type { Chapter as ChapterOf } from '../model/journalDocument';
import type { Publication } from '../model/publication';
import type { Day, Trip } from '../model/trip';
import { routesDistance } from '../routing/legs';
import { ForById } from '../ui/ForById';
import { dateText, distanceText } from '../ui/format';
import { Blocks, type Reading } from './Blocks';
import { DayLine } from './DayLine';
import { DayStops, daySummary } from './DayStops';
import { dayMark, TRIP_MARK } from './follow';
import { Hero } from './Hero';

/** A day's chapter: its number and date, its name, how far it went, the shape of its route; folded under them its route and stops as planned, with its GPX file; then what was written and photographed. */
function Chapter(props: { trip: Trip; day: Day; entries: Entry[]; api: string; gpx: boolean; reading: Reading }) {
  const number = () => props.trip.days.findIndex((d) => d.id === props.day.id) + 1;
  return (
    <section class="chapter" data-mark={dayMark(props.day.id)} ref={props.reading.watch}>
      <header>
        <div>
          <p class="overline">{[t('Day {n}', { n: number() }), props.day.date && dateText(props.day.date)].filter(Boolean).join(' · ')}</p>
          <h2>{props.day.name || t('Day {n}', { n: number() })}</h2>
          <p class="meta">{daySummary(props.day)}</p>
        </div>
        <DayLine day={props.day} width={72} height={96} />
      </header>
      <details class="route">
        <summary>{t('Route and stops')}</summary>
        <Show when={props.day.notes}>
          <p class="notes">{props.day.notes}</p>
        </Show>
        <DayStops day={props.day} />
        <Show when={props.gpx && props.day.routes.length > 0}>
          <a href={tripGpxUrl(props.api, props.day.id)}>{t('GPX of the day')}</a>
        </Show>
      </details>
      <Blocks entries={props.entries} trip={props.trip} api={props.api} reading={props.reading} />
    </section>
  );
}

/**
 * The trip as its story: the head and the introduction, the days to jump to, and a
 * chapter for each day. What is being read is told through `reading`, for the map beside
 * it to follow.
 */
export function Story(props: { trip: Trip; chapters: ChapterOf[]; shown: Publication; api: string; reading: Reading }) {
  const of = (dayId: string | undefined) => props.chapters.find((c) => c.day?.id === dayId)?.entries ?? [];
  return (
    <main>
      <section data-mark={TRIP_MARK} ref={props.reading.watch}>
        <Hero trip={props.trip} shown={props.shown} api={props.api} />
        <div class="column">
          <Blocks entries={of(undefined)} trip={props.trip} api={props.api} reading={props.reading} />
          <nav id="days" class="day-list" aria-label={t('Day by day')}>
            <For each={props.trip.days}>
              {(day, index) => (
                <button type="button" onClick={() => props.reading.go(dayMark(day.id))}>
                  <span class="overline">{t('Day {n}', { n: index() + 1 })}</span>
                  <span class="name">{day.name || (day.date && dateText(day.date))}</span>
                  <span class="meta">{routesDistance(day.routes) > 0 && distanceText(routesDistance(day.routes))}</span>
                </button>
              )}
            </For>
          </nav>
        </div>
      </section>
      <ForById each={props.trip.days}>{(day) => <Chapter trip={props.trip} day={day()} entries={of(day().id)} api={props.api} gpx={props.shown.gpx} reading={props.reading} />}</ForById>
      <footer>{t('Planned with Trip Planner')}</footer>
    </main>
  );
}
