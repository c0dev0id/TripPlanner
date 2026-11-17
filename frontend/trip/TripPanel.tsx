import { plural, t } from '../i18n/t';
import { createEffect, createMemo, createSignal, on, Show } from 'solid-js';
import { errorMessage } from '../api';
import { readDayParts, ROUTE_FILE_TYPES } from '../gpx/import';
import { BOUND_COLOR, FREE_COLOR, ROUTE_PALETTE } from '../model/routeLook';
import type { Day, Route, Stop } from '../model/trip';
import { defaultProfile } from '../routing/dayEdit';
import { fileLegCount, pointCount, routedLegs, routeDistance, routesDistance } from '../routing/legs';
import { standingAlone, type SequenceEntry } from '../routing/sequence';
import type { DayTimeline, EntryTime } from '../routing/timeline';
import { panTo, pointItems, setTrackAction } from '../state/drawing';
import { isDetailed, toggleDetail } from '../state/panel';
import { menuNote, type MenuItem } from '../ui/menu';
import { pickFiles } from '../ui/pickFile';
import type { EntryTarget } from '../model/journal';
import { chapters, entriesOn, openJournal, showDayJournal } from '../state/journal';
import { recordingsOf } from '../state/recordings';
import { openRouteColors } from '../state/routeColors';
import { dropsOnPart, isCut, pasteItems } from '../state/clipboard';
import { partSelect } from '../state/partSelection';
import {
  addParts,
  addRoute,
  isRouteActive,
  isDayMarked,
  takeUpRoute,
  moveDay,
  moveRoute,
  openTrip,
  pickDay,
  selectDay,
  selectedDayId,
  updateRoute,
  detailSequence,
  detailTimeline,
} from '../state/trip';
import { cardMenu } from '../ui/cardMenu';
import { ForById } from '../ui/ForById';
import { counted, distanceText, timeText } from '../ui/format';
import { ChevronIcon, ChevronLeftIcon, ClockIcon, FileImportIcon, NotebookIcon, PlusIcon } from '../ui/icons';
import { Grip } from '../ui/Grip';
import { Said } from '../ui/Said';
import { IconButton } from '../ui/IconButton';
import { MenuButton } from '../ui/MenuButton';
import { Pad } from '../ui/Pad';
import type { RowSelect } from '../ui/selection';
import { StopShape } from '../ui/StopShape';
import { dayDetail, dayHeading, dayLabel, offTime, routeKindLabel, routeLabel, timelineText, timesText } from './labels';
import { RoutePin } from './RoutePin';
import { addMediaPicked, DayMedia } from './Media';
import { addRecordingPicked, DayRecordings } from './Recordings';
import { carriedWith, partMenu } from './partMenu';
import { routeNamesNote } from './routeNames';

/** The journal as an icon on a row, with the number of entries the row has: a day's opens its journal, a route's or a stop's the window for a new entry on it. */
function JournalButton(props: { label: string; count: number; onOpen: () => void }) {
  const label = () => `${props.label}${props.count === 0 ? '' : `: ${counted(props.count, 'entry')}`}`;
  return (
    <button class="icon journal" title={label()} aria-label={label()} onClick={props.onOpen}>
      <NotebookIcon />
      <Show when={props.count > 0}>
        <span class="badge">{props.count}</span>
      </Show>
    </button>
  );
}

/** The journal button of a route or a stop. */
function PartJournalButton(props: { target: EntryTarget; of: string }) {
  return <JournalButton label={t('New journal entry for {of}', { of: props.of })} count={entriesOn(props.target).length} onOpen={() => openJournal(props.target)} />;
}

/** The open trip's days under each other, in the pane beside the library. */
export function TripPanel() {
  return (
    <section class="trip">
      <ol class="days">
        <ForById each={openTrip()!.days}>{(day, index) => <DayItem day={day()} index={index()} />}</ForById>
      </ol>
      <Show when={openTrip()!.days.length === 0}>
        <p class="muted no-days">{t('No days yet.')}</p>
      </Show>
    </section>
  );
}

/** How the last import of a file into a day went, said under that day's routes. */
const [importNote, setImportNote] = createSignal<{ dayId: string; text: string; error: boolean }>();

/** Asks for a GPX or KML file and adds its routes and stops to the day. */
async function importPicked(day: Day): Promise<void> {
  const [file] = await pickFiles({ accept: ROUTE_FILE_TYPES });
  if (!file) return;
  try {
    const parts = await readDayParts(file, defaultProfile(day));
    addParts(day.id, parts);
    setImportNote({ dayId: day.id, text: t('{file}: {routes}, {stops} added.', { file: file.name, routes: counted(parts.routes.length, 'route'), stops: counted(parts.stops.length, 'stop') }), error: false });
  } catch (fault) {
    setImportNote({ dayId: day.id, text: `${file.name}: ${errorMessage(fault)}`, error: true });
  }
}

/** What the free space of the pane of a day's contents offers: what adds to the day, as the buttons on its headings do, and what is pasted into it. */
export function dayAddMenu(day: Day): MenuItem[] {
  const paste = pasteItems('day', day.id);
  return [
    { label: t('Add route'), run: () => addRoute(day.id) },
    { label: t('Import GPX or KML…'), run: () => void importPicked(day) },
    { label: t('Add recording…'), run: () => addRecordingPicked(day.id) },
    { label: t('Add files…'), run: () => addMediaPicked(day.id) },
    ...(paste.length > 0 ? paste : [menuNote(t('Paste'))]),
  ];
}

/** A day as a card: its number and name over its date and length; its menu edits, duplicates, pastes into and removes it. A click shows the day on the map, or the whole trip again where the day is shown; the pad at its end opens the pane of what the day holds. */
function DayItem(props: { day: Day; index: number }) {
  const selected = () => selectedDayId() === props.day.id;
  const label = createMemo(() => dayLabel(props.day, props.index));
  // The day's routes change less often than the day.
  const routes = createMemo(() => props.day.routes);
  const distance = createMemo(() => routesDistance(routes()));
  const meta = () => dayDetail('trip', { date: props.day.date, routes: routes().length, stops: props.day.stops.length, recordings: recordingsOf(props.day.id).length, media: 0, distanceM: distance() });
  const more = (): MenuItem[] => partMenu('day', props.day.id, { more: [{ label: t('Add recording…'), run: () => addRecordingPicked(props.day.id) }] });
  const select = partSelect('day', props.day.id, () => openTrip()!.days.map((d) => d.id));
  const detailed = () => isDetailed(props.day.id);
  let row!: HTMLLIElement;
  // The day shown is brought into view: one opened from elsewhere may lie far down its trip.
  createEffect(on(selected, (is) => is && requestAnimationFrame(() => row.scrollIntoView({ block: 'nearest' }))));
  return (
    <li
      ref={(el) => {
        row = el;
        dropsOnPart(el, 'day', () => props.day.id);
      }}
      class="day card"
      classList={{ open: selected(), current: isDayMarked(props.day.id), selected: select.selected(), cut: isCut(props.day.id) }}
    >
      <div class="row" ref={(el) => cardMenu(el, more)}>
        <Grip
          label={t('Drag to reorder {what}, or tap to select', { what: label() })}
          index={props.index}
          onMove={(to) => moveDay(props.day.id, to)}
          onToggle={select.onToggle}
          carries={() => carriedWith('day', props.day.id, label())}
        />
        <button class="text grow" onClick={(e) => select.onClick(e) || (isDayMarked(props.day.id) ? selectDay(undefined) : pickDay(props.day.id))} aria-expanded={selected()}>
          <span class="lines">
            <span class="name">{dayHeading('trip', props.index, props.day.name)}</span>
            <span class="muted detail">{meta()}</span>
          </span>
        </button>
        <JournalButton label={t('Journal of {of}', { of: label() })} count={chapters().find((c) => c.day?.id === props.day.id)?.entries.length ?? 0} onOpen={() => showDayJournal(props.day.id)} />
        <MenuButton of={label()} items={more} />
        <IconButton label={t(detailed() ? 'Hide the contents of {name}' : 'Show the contents of {name}', { name: label() })} pressed={detailed()} onClick={() => toggleDetail(props.day.id)}>
          {detailed() ? <ChevronLeftIcon /> : <ChevronIcon />}
        </IconButton>
      </div>
    </li>
  );
}

/** A day's notes and times, its routes with their stops, and the stops that stand beside no route: what the pane of the day's contents holds. */
export function DayDetails(props: { day: Day }) {
  const unplaced = createMemo(() => standingAlone(props.day, detailSequence()));
  /** The sequence by route, in order: each route's points and the stops placed along it. */
  const byRoute = createMemo(() => {
    const groups = props.day.routes.map((): SequenceEntry[] => []);
    for (const entry of detailSequence()) groups[entry.routeIndex]?.push(entry);
    return groups;
  });
  return (
    <div class="day-details">
      <Show when={props.day.notes}>
        <p class="muted notes">{props.day.notes}</p>
      </Show>
      <Show when={detailSequence().some((e) => e.stop)}>
        <Show when={detailTimeline()} fallback={<p class="day-summary muted">{t("Set a time on the first stop to calculate the day's times.")}</p>}>
          {(timeline) => <DaySummary timeline={timeline()} />}
        </Show>
      </Show>
      <div class="row">
        <h4 class="grow">{t('Planning')}</h4>
        <IconButton label={t('Import GPX or KML…')} onClick={() => void importPicked(props.day)}>
          <FileImportIcon />
        </IconButton>
        <IconButton label={t('Add route')} onClick={() => addRoute(props.day.id)}>
          <PlusIcon />
        </IconButton>
      </div>
      <ul class="routes">
        <ForById each={props.day.routes}>{(route, index) => <RouteItem route={route()} index={index()} day={props.day} sequence={byRoute()[index()] ?? []} />}</ForById>
      </ul>
      <Show when={importNote()?.dayId === props.day.id && importNote()}>{(note) => <p class="hint" classList={{ muted: !note().error, error: note().error }}>{note().text}</p>}</Show>
      <Show when={routeNamesNote(props.day.id)}>{(note) => <Said note={note()} />}</Show>
      <Show when={unplaced().length > 0}>
        <div class="row">
          <h4 class="grow">{t('Free stops')}</h4>
        </div>
        <ol class="stops">
          <ForById each={unplaced()}>{(stop) => <AloneStopItem stop={stop()} />}</ForById>
        </ol>
      </Show>
      <DayRecordings day={props.day} />
      <DayMedia day={props.day} />
    </div>
  );
}

const lateText = (stops: number): string => plural(stops, 'late at {n} stop|late at {n} stops');

/** The day's timeline in one line, and at how many stops the ride gets there after the fixed time. */
function DaySummary(props: { timeline: DayTimeline }) {
  return (
    <p class="day-summary">
      {timelineText(props.timeline)}
      <Show when={props.timeline.late > 0}>
        {' · '}
        <span class="late">{lateText(props.timeline.late)}</span>
      </Show>
    </p>
  );
}

/**
 * A route of the day: its row, a click on which takes the route up and unfolds it, and
 * whose menu (right-click or a long press) edits, duplicates, copies, moves, condenses or
 * converts a track, and removes it; and while it is unfolded, its stops
 * and points in riding order under it, out of `sequence`, its part of the day's.
 */
function RouteItem(props: { route: Route; index: number; day: Day; sequence: SequenceEntry[] }) {
  const editing = () => isRouteActive(props.route.id);
  const label = createMemo(() => routeLabel(props.route, props.day));
  const distance = createMemo(() => routeDistance(props.route));
  /** The route's points and bound stops, and the free stops that stand beside it; not where a track ends, which is no point of its own. */
  const entries = createMemo(() => props.sequence.filter((e) => e.stop || e.point));
  const stopCount = createMemo(() => entries().filter((e) => e.stop).length);
  const lateCount = createMemo(() => entries().filter((e) => (detailTimeline()?.times.get(e.id)?.slackMin ?? 0) < 0).length);
  const items = (): MenuItem[] =>
    partMenu('route', props.route.id, {
      more: [
        {
          label: t('Color'),
          items: [
            { label: t('Automatic'), checked: props.route.color === null, run: () => updateRoute(props.route.id, { color: null }) },
            ...ROUTE_PALETTE.map(({ color, label }) => ({ label, swatch: color, checked: props.route.color === color, run: () => updateRoute(props.route.id, { color }) })),
          ],
        },
        ...(props.route.kind === 'track' ? [{ label: t('Reduce points…'), run: () => setTrackAction({ routeId: props.route.id, action: 'condense' }) }] : []),
      ],
    });
  /** How many of the route's legs still run along the way its file calculated, of how many. */
  const fileLegs = createMemo(() => ({ kept: fileLegCount(props.route), of: props.route.kind === 'routed' ? routedLegs(props.route).length : 0 }));
  const [unfolded, setUnfolded] = createSignal(false);
  let row!: HTMLDivElement;
  // A route taken up on the map is unfolded and brought into view as one clicked here is.
  createEffect(
    on(editing, (is) => {
      if (!is) return;
      setUnfolded(true);
      row.scrollIntoView({ block: 'nearest' });
    }),
  );
  /** A click takes the route up to be edited and lists its stops and points; on the route being edited, it ends that and folds the list away. */
  const select = partSelect('route', props.route.id, () => props.day.routes.map((r) => r.id));
  const click = (e: MouseEvent) => {
    if (select.onClick(e)) return;
    setUnfolded(!editing());
    takeUpRoute(editing() ? undefined : props.route.id);
  };
  return (
    <li class="route" classList={{ editing: editing(), selected: select.selected(), cut: isCut(props.route.id) }} ref={(el) => dropsOnPart(el, 'route', () => props.route.id)}>
      <div
        class="row"
        ref={(el) => {
          row = el;
          cardMenu(el, items);
        }}
      >
        <Grip
          label={t('Drag to reorder {what}, or tap to select', { what: label() })}
          index={props.index}
          onMove={(to) => moveRoute(props.route.id, to)}
          onToggle={select.onToggle}
          carries={() => carriedWith('route', props.route.id, label())}
        />
        <button class="text grow" aria-pressed={editing()} aria-expanded={unfolded()} onClick={click}>
          <span class="lines">
            <span class="name" title={label()}>
              {label()}
            </span>
            <span class="muted detail">
              <span class="color-dot" style={{ background: openRouteColors().get(props.route.id) }} /> {routeKindLabel(props.route)}
              {distance() > 0 ? ` · ${distanceText(distance())}` : ''}
              {props.route.kind === 'track' ? ` · ${counted(pointCount(props.route), 'point')}` : ''}
              {stopCount() > 0 ? ` · ${counted(stopCount(), 'stop')}` : ''}
              <Show when={lateCount() > 0}>
                <span class="late"> · {lateText(lateCount())}</span>
              </Show>
              {props.route.optional ? ' · optional' : ''}
            </span>
            {/* What the route still carries of its file: the way a planner calculated, Garmin's or DMD's, which a leg does not say. */}
            <Show when={fileLegs().kept > 0}>
              <span class="chips">
                <span class="chip" title={t('{n} of {m} legs run along the way the file calculated. A leg that is routed again loses it.', { n: fileLegs().kept, m: fileLegs().of })}>
                  {t('Original way')}
                  {fileLegs().kept < fileLegs().of ? ` ${fileLegs().kept}/${fileLegs().of}` : ''}
                </span>
              </span>
            </Show>
          </span>
        </button>
        <PartJournalButton target={{ routeId: props.route.id }} of={label()} />
        <RoutePin id={props.route.id} of={label()} />
        <MenuButton of={label()} items={items} />
      </div>
      <Show when={unfolded()}>
        <ol class="stops">
          <SequenceItems entries={entries()} routeId={props.route.id} />
        </ol>
      </Show>
    </li>
  );
}

/** Rows of sequence entries; an edit makes new entries, and their rows are kept by id. */
function SequenceItems(props: { entries: SequenceEntry[]; routeId: string }) {
  return <ForById each={props.entries}>{(entry) => <SequenceItem entry={entry()} routeId={props.routeId} time={detailTimeline()?.times.get(entry().id)} />}</ForById>;
}

/** The name of a sequence row that is a route point, not a stop. */
const ROUTE_POINT = t('Route point');

/**
 * A stop or a plain route point with its times and distance from the day's start and its
 * menu; a click pans the map there. Before a stop whose fixed time the ride misses stands a row of its
 * own that says by how much it is late or early, and when the ride gets there.
 */
function SequenceItem(props: { entry: SequenceEntry; routeId: string; time: EntryTime | undefined }) {
  const stop = () => props.entry.stop;
  /** The row's menu: the stop's, else the route point's; the end of a track has none. */
  const hasMenu = () => stop() !== undefined || props.entry.point !== undefined;
  const menu = (): MenuItem[] => (stop() ? partMenu('stop', stop()!.id) : pointItems(props.routeId, props.entry.point!));
  const select = createMemo(() => stop() && stopSelect(stop()!.id));
  return (
    <>
      <Show when={props.time && offTime(props.time)}>
        {(off) => (
          <li class="off-time" classList={{ late: off().late, early: !off().late }}>
            <span class="mark">
              <ClockIcon />
            </span>
            <span class="lines">
              <span>{off().text}</span>
              <span class="muted">{t('arrives {time}', { time: timeText(off().rideMin) })}</span>
            </span>
          </li>
        )}
      </Show>
      <li
        class="row sequence-item"
        classList={{ point: !stop(), selected: select()?.selected(), cut: !!stop() && isCut(stop()!.id) }}
        ref={(el) => hasMenu() && cardMenu(el, menu)}
      >
        <Show when={select()} fallback={<span class="grip-space" />}>
          {(row) => <Pad label={t('Select {name}, or drag it', { name: stop()!.name })} selected={row().selected()} onToggle={row().onToggle} carries={() => carriedWith('stop', stop()!.id, stop()!.name)} />}
        </Show>
        <button class="text grow" onClick={(e) => select()?.onClick(e) || panTo(props.entry.lngLat)}>
          <Show when={stop()} fallback={<span class="point-dot" style={{ 'border-color': BOUND_COLOR }} />}>
            {(s) => <StopShape symbol={s().symbol} color={s().pointId === null ? FREE_COLOR : BOUND_COLOR} height={22} />}
          </Show>
          <span class="lines">
            <span class="name">
              <Show when={stop()} fallback={<span class="muted">{ROUTE_POINT}</span>}>
                {(s) => <>{s().name}</>}
              </Show>
            </span>
            <span class="muted detail">
              <Show when={props.time}>{(time) => <>{timesText(time())} · </>}</Show>
              {distanceText(props.entry.distanceM)}
              <Show when={props.entry.near}>{(near) => <> · {distanceText(near().distanceM)} beside the route</>}</Show>
              <Show when={stop()?.optional}> · optional</Show>
            </span>
          </span>
        </button>
        <Show when={stop()}>{(s) => <PartJournalButton target={{ stopId: s().id }} of={s().name} />}</Show>
        <Show when={hasMenu()}>
          <MenuButton of={stop()?.name ?? ROUTE_POINT} items={menu} />
        </Show>
      </li>
    </>
  );
}

/** A stop that stands for itself beside no route, with no place or times on the ride; a click pans the map there. */
function AloneStopItem(props: { stop: Stop }) {
  const select = stopSelect(props.stop.id);
  return (
    <li class="row sequence-item" classList={{ selected: select.selected(), cut: isCut(props.stop.id) }} ref={(el) => cardMenu(el, () => partMenu('stop', props.stop.id))}>
      <Pad label={t('Select {name}, or drag it', { name: props.stop.name })} selected={select.selected()} onToggle={select.onToggle} carries={() => carriedWith('stop', props.stop.id, props.stop.name)} />
      <button class="text grow" onClick={(e) => select.onClick(e) || panTo(props.stop.lngLat)}>
        <StopShape symbol={props.stop.symbol} color={FREE_COLOR} height={22} />
        <span class="lines">
          <span class="name">{props.stop.name}</span>
          <Show when={props.stop.optional}>
            <span class="muted detail">optional</span>
          </Show>
        </span>
      </button>
      <PartJournalButton target={{ stopId: props.stop.id }} of={props.stop.name} />
      <MenuButton of={props.stop.name} items={() => partMenu('stop', props.stop.id)} />
    </li>
  );
}

/** How a stop of the day whose contents are shown is selected, among that day's stops in riding order. */
const stopSelect = (id: string): RowSelect => partSelect('stop', id, () => detailSequence().flatMap((entry) => (entry.stop ? [entry.stop.id] : [])));
