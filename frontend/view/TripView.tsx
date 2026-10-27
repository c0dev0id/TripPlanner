import { createEffect, createMemo, createResource, For, Match, Show, Switch } from 'solid-js';
import { errorMessage, fetchTripAt, listEntriesAt } from '../api';
import { entriesOn, type Entry, type EntryTarget } from '../model/journal';
import { STOP_KINDS, type Day, type Route, type Trip } from '../model/trip';
import { routeDistance } from '../routing/legs';
import { daySequence, type SequenceEntry } from '../routing/sequence';
import { dayTimeline, type EntryTime } from '../routing/timeline';
import { EntryFile } from '../trip/EntryFile';
import { dayLabel, routeKindLabel, routeLabel, timelineText, timesText } from '../trip/labels';
import { dateText, distanceText, durationText, takenAtText } from '../ui/format';
import { StopShape } from '../ui/StopShape';
import { ViewMap } from './ViewMap';

/**
 * A trip laid out for reading and printing: the map, the journal, and every day with its
 * routes and its stops in riding order with their times. Read from the API the page names:
 * the owner's, or the shared one.
 */
export function TripView(props: { api: string }) {
  const [page] = createResource(async () => {
    const [trip, entries] = await Promise.all([fetchTripAt(props.api), listEntriesAt(props.api)]);
    return { trip, entries };
  });
  createEffect(() => {
    if (page.state === 'ready') document.title = `${page().trip.name} · Trip Planner`;
  });
  // Reading a resource that failed throws; its error is shown instead.
  return (
    <Switch fallback={<p class="notice">Loading…</p>}>
      <Match when={page.error}>{(error) => <p class="notice">{errorMessage(error())}</p>}</Match>
      <Match when={page()}>
        {(p) => {
          const on = (target: EntryTarget) => entriesOn(p().entries, target);
          return (
            <article class="trip-view">
              <Header trip={p().trip} />
              <ViewMap trip={p().trip} entries={p().entries} api={props.api} />
              <EntryList entries={on({})} api={props.api} />
              <For each={p().trip.days}>{(day, index) => <DaySection day={day} index={index()} entriesOn={on} api={props.api} />}</For>
            </article>
          );
        }}
      </Match>
    </Switch>
  );
}

/** The trip's name and state, its length in days, kilometres and dates, its description, and the print button. */
function Header(props: { trip: Trip }) {
  const dates = createMemo(() => props.trip.days.flatMap((d) => (d.date ? [d.date] : [])).sort());
  const distance = () => props.trip.days.flatMap((d) => d.routes).reduce((sum, r) => sum + routeDistance(r), 0);
  const days = () => `${props.trip.days.length} ${props.trip.days.length === 1 ? 'day' : 'days'}`;
  const span = () => {
    const [first, last] = [dates()[0], dates().at(-1)];
    return !first ? '' : first === last ? dateText(first) : `${dateText(first)} – ${dateText(last!)}`;
  };
  return (
    <header>
      <div class="row">
        <h1>{props.trip.name}</h1>
        <button class="print" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <p class="muted">{[days(), distance() > 0 && distanceText(distance()), span(), props.trip.state === 'done' && 'ridden'].filter(Boolean).join(' · ')}</p>
      <Show when={props.trip.description}>
        <p class="text">{props.trip.description}</p>
      </Show>
    </header>
  );
}

function DaySection(props: { day: Day; index: number; entriesOn: (target: EntryTarget) => Entry[]; api: string }) {
  const sequence = createMemo(() => daySequence(props.day));
  const timeline = createMemo(() => dayTimeline(sequence()));
  const stops = () => sequence().filter((e) => e.stop);
  const distance = () => props.day.routes.reduce((sum, r) => sum + routeDistance(r), 0);
  const summary = () => {
    const t = timeline();
    return [distance() > 0 && distanceText(distance()), t && timelineText(t)].filter(Boolean).join(' · ');
  };
  return (
    <section class="day">
      <h2>{dayLabel(props.day, props.index)}</h2>
      <Show when={summary()}>
        <p class="muted">{summary()}</p>
      </Show>
      <Show when={props.day.notes}>
        <p class="text">{props.day.notes}</p>
      </Show>
      <EntryList entries={props.entriesOn({ dayId: props.day.id })} api={props.api} />
      <Show when={props.day.routes.length > 0}>
        <ul class="routes">
          <For each={props.day.routes}>{(route) => <RouteItem route={route} day={props.day} entries={props.entriesOn({ routeId: route.id })} api={props.api} />}</For>
        </ul>
      </Show>
      <Show when={stops().length > 0}>
        <ol class="stops">
          <For each={stops()}>{(entry) => <StopItem entry={entry} time={timeline()?.times.get(entry.id)} entries={props.entriesOn({ stopId: entry.stop!.id })} api={props.api} />}</For>
        </ol>
      </Show>
    </section>
  );
}

function RouteItem(props: { route: Route; day: Day; entries: Entry[]; api: string }) {
  return (
    <li>
      <span>{routeLabel(props.route, props.day)}</span>
      <span class="muted"> · {[routeKindLabel(props.route), props.route.points.length > 1 && distanceText(routeDistance(props.route)), props.route.optional && 'optional'].filter(Boolean).join(' · ')}</span>
      <EntryList entries={props.entries} api={props.api} />
    </li>
  );
}

/** A stop with its times and distance, what the planner noted about it, and its journal. */
function StopItem(props: { entry: SequenceEntry; time: EntryTime | undefined; entries: Entry[]; api: string }) {
  const stop = () => props.entry.stop!;
  const kind = () => STOP_KINDS.find((k) => k.value === stop().kind)?.label;
  const times = () => {
    const t = props.time;
    if (!t) return '';
    return t.slackMin < 0 ? `${timesText(t)} (${durationText(-t.slackMin * 60)} short)` : timesText(t);
  };
  const detail = () => [times(), distanceText(props.entry.distanceM), stop().kind !== 'other' && kind(), stop().optional && 'optional'].filter(Boolean).join(' · ');
  return (
    <li class="stop-item">
      <StopShape kind={stop().kind} color={stop().pointId === null ? '#1971c2' : '#d9480f'} height={24} />
      <div class="lines">
        <span class="name">{stop().name}</span>
        <span class="muted">{detail()}</span>
        <Show when={stop().address}>
          <span class="text">{stop().address}</span>
        </Show>
        <Show when={stop().contact}>
          <span>{stop().contact}</span>
        </Show>
        <Show when={stop().bookingReference}>
          <span>Booking {stop().bookingReference}</span>
        </Show>
        <Show when={stop().notes}>
          <span class="text">{stop().notes}</span>
        </Show>
        <EntryList entries={props.entries} api={props.api} />
      </div>
    </li>
  );
}

/** Journal entries: a photo as its preview, another file as a link, and the note. */
function EntryList(props: { entries: Entry[]; api: string }) {
  return (
    <Show when={props.entries.length > 0}>
      <ul class="entries">
        <For each={props.entries}>
          {(entry) => (
            <li class="entry">
              <EntryFile entry={entry} base={props.api} />
              <div class="lines">
                <Show when={entry.takenAt}>{(taken) => <span class="muted">{takenAtText(taken())}</span>}</Show>
                <Show when={entry.text}>
                  <p class="text">{entry.text}</p>
                </Show>
              </div>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
