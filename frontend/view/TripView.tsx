import { t } from '../i18n/t';
import { createEffect, createMemo, createResource, Match, onCleanup, Show, Switch } from 'solid-js';
import { errorMessage, fetchPublication, fetchTripAt, listEntriesAt, onTripChanged } from '../api';
import { chaptersOf } from '../model/journalDocument';
import type { Shown } from '../model/publication';
import { ContextMenu } from '../ui/ContextMenu';
import { Lightbox } from '../ui/Lightbox';
import { createFollowing, TRIP_MARK } from './follow';
import { Hero } from './Hero';
import { PlanDays } from './PlanDays';
import { Story } from './Story';
import { StoryMap } from './StoryMap';

/** How long after the planner said the trip changed the page reads it again, in milliseconds. */
const REREAD_AFTER_MS = 400;

/**
 * The page of a trip, for reading and printing. Without a journal it is the plan: the
 * head, the map, the days with their stops. With one it is the story: the journal as a
 * document, with the map beside it following what is read. Read from the API the page
 * names, the owner's or the shared one; the trip's document from where the page says,
 * which for the owner may be the trip as a visitor gets it. The page reads both again
 * when the planner says that something changed, so that it follows the journal as it is
 * written.
 */
export function TripView(props: { api: string; document: string }) {
  const [page, { refetch }] = createResource(async () => {
    const [trip, entries] = await Promise.all([fetchTripAt(props.document), listEntriesAt(props.api)]);
    // The owner's own page shows everything; what its document lacks is which photo is the cover.
    const shown: Shown = trip.public ?? { journal: true, gpx: true, coverEntryId: (await fetchPublication(trip.id)).coverEntryId };
    return { trip, entries, shown };
  });
  // What is written in quick succession, a text as it is typed, is read once.
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(
    onTripChanged(props.api, () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refetch(), REREAD_AFTER_MS);
    }),
  );
  onCleanup(() => clearTimeout(timer));
  createEffect(() => {
    if (page.state === 'ready' || page.state === 'refreshing') document.title = `${page.latest!.trip.name} · Trip Planner`;
  });
  // What is folded is printed too.
  const unfold = () => document.querySelectorAll('details').forEach((details) => (details.open = true));
  window.addEventListener('beforeprint', unfold);
  onCleanup(() => window.removeEventListener('beforeprint', unfold));
  const reading = createFollowing(TRIP_MARK);
  // Reading a resource that failed throws; its error is shown instead.
  return (
    <Switch fallback={<p class="notice">{t('Loading…')}</p>}>
      <Match when={page.error}>{(error) => <p class="notice">{errorMessage(error())}</p>}</Match>
      <Match when={page.latest}>
        {(p) => {
          const chapters = createMemo(() => chaptersOf(p().trip, p().entries));
          return (
            <div class="trip-page" classList={{ story: p().entries.length > 0 }}>
              <Show
                when={p().entries.length > 0}
                fallback={
                  <main>
                    <Hero trip={p().trip} shown={p().shown} api={props.api} />
                    <StoryMap trip={p().trip} entries={[]} api={props.api} at={TRIP_MARK} go={reading.go} rail={false} />
                    <PlanDays trip={p().trip} api={props.api} gpx={p().shown.gpx} />
                    <footer>{t('Planned with Trip Planner')}</footer>
                  </main>
                }
              >
                <StoryMap trip={p().trip} entries={p().entries} api={props.api} at={reading.at()} go={reading.go} rail />
                <Story trip={p().trip} chapters={chapters()} shown={p().shown} api={props.api} reading={reading} />
              </Show>
              <ContextMenu />
              <Lightbox />
            </div>
          );
        }}
      </Match>
    </Switch>
  );
}
