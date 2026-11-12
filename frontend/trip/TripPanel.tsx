import { plural, t } from '../i18n/t';
import { createMemo, createSignal, Show } from 'solid-js';
import { errorMessage } from '../api';
import { readGpxFile } from '../gpx/import';
import { BOUND_COLOR, FREE_COLOR } from '../map/routeOverlay';
import { ROUTE_PALETTE } from '../model/routeLook';
import type { Day, Route, Stop } from '../model/trip';
import { defaultProfile } from '../routing/dayEdit';
import { pointCount, routeDistance, routesDistance } from '../routing/legs';
import { standingAlone, type SequenceEntry } from '../routing/sequence';
import type { DayTimeline, EntryTime } from '../routing/timeline';
import { foldRoute, isRouteUnfolded, panTo, setEditTarget, setExportScope, setShareOpen, setTrackAction } from '../state/drawing';
import type { MenuItem } from '../ui/menu';
import type { EntryTarget } from '../model/journal';
import { entriesOn, openJournal } from '../state/journal';
import { openRouteColors } from '../state/routeColors';
import { isCut } from '../state/clipboard';
import { clickPart, isPartSelected, togglePart } from '../state/partSelection';
import {
  addParts,
  addRoute,
  editingRouteId,
  isDayMarked,
  markShownDay,
  editRoute,
  moveDay,
  moveRoute,
  openTrip,
  selectDay,
  selectedDayId,
  updateRoute,
  selectedSequence,
  selectedTimeline,
} from '../state/trip';
import { cardMenu } from '../ui/cardMenu';
import { ForById } from '../ui/ForById';
import { counted, distanceText, timeText } from '../ui/format';
import { ChevronIcon, ClockIcon, DownloadIcon, FileImportIcon, NotebookIcon, PencilIcon, PlusIcon, ShareIcon } from '../ui/icons';
import { Grip } from '../ui/Grip';
import { IconButton } from '../ui/IconButton';
import { MenuButton } from '../ui/MenuButton';
import { selects } from '../ui/selection';
import { StopShape } from '../ui/StopShape';
import { dayDetail, dayHeading, dayLabel, offTime, routeKindLabel, routeLabel, timelineText, timesText } from './labels';
import { addRecordingPicked, DayRecordings, RecordingsToggle } from './Recordings';
import { partMenu } from './partMenu';

/** The journal of a part as an icon, with the number of its entries where it has any. */
export function JournalButton(props: { target: EntryTarget; of: string }) {
  const count = createMemo(() => entriesOn(props.target).length);
  const label = () => `${t('Journal of {of}', { of: props.of })}${count() === 0 ? '' : `: ${counted(count(), 'entry')}`}`;
  return (
    <button class="icon journal" title={label()} aria-label={label()} onClick={() => openJournal(props.target)}>
      <NotebookIcon />
      <Show when={count() > 0}>
        <span class="badge">{count()}</span>
      </Show>
    </button>
  );
}

/** The open trip's own actions, as icons on the explorer's heading: edit, export, journal, print and share. */
export function TripIcons() {
  return (
    <>
      <IconButton label={t('Edit trip')} onClick={() => setEditTarget({ kind: 'trip' })}>
        <PencilIcon />
      </IconButton>
      <IconButton label={t('Export GPX…')} onClick={() => setExportScope({ kind: 'trip' })}>
        <DownloadIcon />
      </IconButton>
      <JournalButton target={{}} of={t('the trip')} />
      <IconButton label={t('Print, share…')} onClick={() => setShareOpen(true)}>
        <ShareIcon />
      </IconButton>
    </>
  );
}

/** The open trip's days, under its row in the library's tree. */
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

/** A day as a card: its number and name over its date and length; its menu edits, duplicates, pastes into and removes it. */
function DayItem(props: { day: Day; index: number }) {
  const selected = () => selectedDayId() === props.day.id;
  const label = createMemo(() => dayLabel(props.day, props.index));
  // The day's routes change less often than the day.
  const routes = createMemo(() => props.day.routes);
  const distance = createMemo(() => routesDistance(routes()));
  const meta = () => dayDetail('trip', { date: props.day.date, routes: routes().length, stops: props.day.stops.length, distanceM: distance() });
  const more = (): MenuItem[] => partMenu('day', props.day.id, { more: [{ label: t('Add recording…'), run: () => addRecordingPicked(props.day.id) }] });
  const click = (e: MouseEvent) => {
    if (selects(e)) clickPart('day', openTrip()!.days.map((d) => d.id), props.day.id, e);
    // The day shown stays shown: a click on it only takes the mark back from the trip.
    else if (selected()) markShownDay();
    else selectDay(props.day.id);
  };
  return (
    <li class="day card" classList={{ open: selected(), current: isDayMarked(props.day.id), picked: isPartSelected('day', props.day.id), cut: isCut(props.day.id) }}>
      <div class="row" ref={(el) => cardMenu(el, more)}>
        <Grip label={t('Drag {what} to another place, or tap to select it', { what: label() })} index={props.index} onMove={(to) => moveDay(props.day.id, to)} onToggle={() => togglePart('day', props.day.id)} />
        <button class="text grow" onClick={click} aria-pressed={selected()}>
          <span class="lines">
            <span class="name">{dayHeading('trip', props.index, props.day.name)}</span>
            <span class="muted detail">{meta()}</span>
          </span>
        </button>
        <Show when={selected()}>
          <IconButton label={t('Edit {what}', { what: label() })} onClick={() => setEditTarget({ kind: 'day', id: props.day.id })}>
            <PencilIcon />
          </IconButton>
        </Show>
        <RecordingsToggle dayId={props.day.id} />
        <JournalButton target={{ dayId: props.day.id }} of={label()} />
        <MenuButton of={label()} items={more} />
      </div>
    </li>
  );
}

/** The selected day's notes and times, its routes with their stops, and the stops that stand beside no route: what the day's pane shows. */
export function DayDetails(props: { day: Day }) {
  const unplaced = createMemo(() => standingAlone(props.day, selectedSequence()));
  /** The sequence by route, in order: each route's points and the stops placed along it. */
  const byRoute = createMemo(() => {
    const groups = props.day.routes.map((): SequenceEntry[] => []);
    for (const entry of selectedSequence()) groups[entry.routeIndex]?.push(entry);
    return groups;
  });
  const [importNote, setImportNote] = createSignal<{ text: string; error: boolean }>();
  let fileInput!: HTMLInputElement;
  const importFile = async (file: File | undefined) => {
    fileInput.value = '';
    if (!file) return;
    try {
      const parts = await readGpxFile(file, defaultProfile(props.day));
      addParts(parts);
      setImportNote({ text: t('{file}: {routes}, {stops} added.', { file: file.name, routes: counted(parts.routes.length, 'route'), stops: counted(parts.stops.length, 'stop') }), error: false });
    } catch (fault) {
      setImportNote({ text: `${file.name}: ${errorMessage(fault)}`, error: true });
    }
  };
  return (
    <div class="day-details">
      <Show when={props.day.notes}>
        <p class="muted notes">{props.day.notes}</p>
      </Show>
      <Show when={selectedSequence().some((e) => e.stop)}>
        <Show when={selectedTimeline()} fallback={<p class="day-summary muted">{t("Give the first stop a time for the day's times.")}</p>}>
          {(timeline) => <DaySummary timeline={timeline()} />}
        </Show>
      </Show>
      <div class="row heading">
        <h4 class="grow">{t('Routes')}</h4>
        <IconButton label={t('Add route')} onClick={addRoute}>
          <PlusIcon />
        </IconButton>
        <IconButton label={t('Import GPX…')} onClick={() => fileInput.click()}>
          <FileImportIcon />
        </IconButton>
        <input ref={fileInput} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => void importFile(e.currentTarget.files?.[0])} />
      </div>
      <ul class="routes">
        <ForById each={props.day.routes}>{(route, index) => <RouteItem route={route()} index={index()} day={props.day} sequence={byRoute()[index()] ?? []} />}</ForById>
      </ul>
      <Show when={importNote()}>{(note) => <p class="hint" classList={{ muted: !note().error, error: note().error }}>{note().text}</p>}</Show>
      <Show when={unplaced().length > 0}>
        <div class="row heading">
          <h4 class="grow">{t('Stops beside no route')}</h4>
        </div>
        <ol class="stops">
          <ForById each={unplaced()}>{(stop) => <AloneStopItem stop={stop()} />}</ForById>
        </ol>
      </Show>
      <DayRecordings day={props.day} />
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
 * A route of the day: its row, whose menu (right-click or a long press) edits, duplicates,
 * copies, moves, condenses or converts a track, and removes it; and while it is unfolded, its stops
 * and points in riding order under it, out of `sequence`, its part of the day's.
 */
function RouteItem(props: { route: Route; index: number; day: Day; sequence: SequenceEntry[] }) {
  const editing = () => editingRouteId() === props.route.id;
  const label = createMemo(() => routeLabel(props.route, props.day));
  const distance = createMemo(() => routeDistance(props.route));
  /** The route's points and bound stops, and the free stops that stand beside it; not where a track ends, which is no point of its own. */
  const entries = createMemo(() => props.sequence.filter((e) => e.stop || e.point));
  const stopCount = createMemo(() => entries().filter((e) => e.stop).length);
  const lateCount = createMemo(() => entries().filter((e) => (selectedTimeline()?.times.get(e.id)?.slackMin ?? 0) < 0).length);
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
        ...(props.route.kind === 'track'
          ? [
              { label: t('Condense points…'), run: () => setTrackAction({ routeId: props.route.id, action: 'condense' }) },
              { label: t('Convert to route…'), run: () => setTrackAction({ routeId: props.route.id, action: 'convert' }) },
            ]
          : []),
      ],
    });
  const unfolded = () => isRouteUnfolded(props.route.id);
  const click = (e: MouseEvent) => {
    if (selects(e)) return clickPart('route', props.day.routes.map((r) => r.id), props.route.id, e);
    // A route taken up to be edited shows what it holds; the user folds it again.
    if (!editing()) foldRoute(props.route.id, true);
    editRoute(editing() ? undefined : props.route.id);
  };
  return (
    <li class="route" classList={{ editing: editing(), picked: isPartSelected('route', props.route.id), cut: isCut(props.route.id) }}>
      <div class="row" ref={(el) => cardMenu(el, items)}>
        <Grip label={t('Drag {what} to another place, or tap to select it', { what: label() })} index={props.index} onMove={(to) => moveRoute(props.route.id, to)} onToggle={() => togglePart('route', props.route.id)} />
        <button class="icon fold" aria-expanded={unfolded()} title={t(unfolded() ? 'Fold the stops and points away' : 'Show the stops and points')} aria-label={t(unfolded() ? 'Fold the stops and points away' : 'Show the stops and points')} onClick={() => foldRoute(props.route.id)}>
          <ChevronIcon />
        </button>
        <button class="text grow" aria-pressed={editing()} onClick={click}>
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
          </span>
        </button>
        <JournalButton target={{ routeId: props.route.id }} of={label()} />
        <MenuButton of={label()} items={items} />
      </div>
      <Show when={unfolded()}>
        <ol class="stops">
          <SequenceItems entries={entries()} />
        </ol>
      </Show>
    </li>
  );
}

/** Rows of sequence entries; an edit makes new entries, and their rows are kept by id. */
function SequenceItems(props: { entries: SequenceEntry[] }) {
  return <ForById each={props.entries}>{(entry) => <SequenceItem entry={entry()} time={selectedTimeline()?.times.get(entry().id)} />}</ForById>;
}

/** The name of a sequence row that is a route point, not a stop. */
const ROUTE_POINT = t('Route point');

/**
 * A stop or a plain route point with its times and distance from the day's start; a click
 * pans the map there. Before a stop whose fixed time the ride misses stands a row of its
 * own that says by how much it is late or early, and when the ride gets there.
 */
function SequenceItem(props: { entry: SequenceEntry; time: EntryTime | undefined }) {
  const stop = () => props.entry.stop;
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
        classList={{ point: !stop(), picked: !!stop() && isPartSelected('stop', stop()!.id), cut: !!stop() && isCut(stop()!.id) }}
        ref={(el) => props.entry.stop && cardMenu(el, () => partMenu('stop', stop()!.id))}
      >
        <button class="text grow" onClick={(e) => (stop() && selects(e) ? clickStop(stop()!, e) : panTo(props.entry.lngLat))}>
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
        <Show when={stop()}>
          {(s) => (
            <>
              <JournalButton target={{ stopId: s().id }} of={s().name} />
              <MenuButton of={s().name} items={() => partMenu('stop', s().id)} />
            </>
          )}
        </Show>
      </li>
    </>
  );
}

/** A stop that stands for itself beside no route, with no place or times on the ride; a click pans the map there. */
function AloneStopItem(props: { stop: Stop }) {
  return (
    <li class="row sequence-item" classList={{ picked: isPartSelected('stop', props.stop.id), cut: isCut(props.stop.id) }} ref={(el) => cardMenu(el, () => partMenu('stop', props.stop.id))}>
      <button class="text grow" onClick={(e) => (selects(e) ? clickStop(props.stop, e) : panTo(props.stop.lngLat))}>
        <StopShape symbol={props.stop.symbol} color={FREE_COLOR} height={22} />
        <span class="lines">
          <span class="name">{props.stop.name}</span>
          <Show when={props.stop.optional}>
            <span class="muted detail">optional</span>
          </Show>
        </span>
      </button>
      <JournalButton target={{ stopId: props.stop.id }} of={props.stop.name} />
      <MenuButton of={props.stop.name} items={() => partMenu('stop', props.stop.id)} />
    </li>
  );
}

/** A click that selects on a stop of the selected day, among that day's stops in riding order. */
function clickStop(stop: Stop, e: MouseEvent): void {
  clickPart('stop', selectedSequence().flatMap((entry) => (entry.stop ? [entry.stop.id] : [])), stop.id, e);
}
