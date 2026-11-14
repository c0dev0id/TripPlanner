import { createEffect, createMemo, createSelector, createSignal, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { declineRideDay, deleteRide, errorMessage, mergeRides, renameRide, rideJoints, suggestRideDays } from '../api';
import { GPX_FILE_TYPES } from '../gpx/import';
import type { Ride, Suggestion } from '../recording/rides';
import { FAR_APART_M, isOddJoint, ridingYears, totalDistance } from '../recording/rides';
import { copyRecordings } from '../state/clipboard';
import { fetchingTrip, libraryTrips, outlineOf } from '../state/library';
import { activeRecordingId, putOnDay } from '../state/recordings';
import { toggleRide } from '../state/recordingView';
import { allRides, changeRides, revealedRide, revealRide, rideColor, RIDES, rideSuggestions, ridesError, ridesLoading, ridesNote, runRidesJob, setRideSuggestions } from '../state/rides';
import { openTrip } from '../state/trip';
import { dayLabel, dayTitleOf } from '../trip/labels';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { counted, dateText, distanceText, durationText, momentText, monthText, timeOfDayText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CheckIcon, ChevronIcon, CloseIcon, PlusIcon, SearchIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { Pad } from '../ui/Pad';
import { pickFiles } from '../ui/pickFile';
import { clickRow, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, toggleRow } from '../ui/selection';
import { autoname } from './autoname';
import { sourceOf } from './folderImport';
import { addRides } from './importActions';

/** The years unfolded, kept while the page stands; none until the rides are read, when the latest unfolds. */
const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>();

/**
 * The rides, in the library's tab for them: every recording the user keeps by when it
 * was ridden, in years, months and days of riding, each with how far it went and the
 * days of trips it is on; those without times come last. The plus above them, and
 * files dropped on the library while they are shown, keep GPX files as rides. A click
 * or a tap on a ride opens it, which shows it whole on the map with its figures, as a
 * recording on a day is opened, and a click on the opened one closes it; with Cmd or
 * Ctrl it selects, with Shift a run of them; its pad adds or takes it away; a day's or
 * a month's heading selects all its rides. The map draws what is selected, each ride
 * in a colour its row shows too. A ride's
 * menu renames it, names it after where it began and ended, copies it to be pasted
 * onto a day, puts it on a day of the open trip, merges it with the selected rides it
 * follows or that follow it, opens a day it is on, and deletes it. The magnifier above
 * them asks for the days of trips the rides on no day may be of, which are then listed
 * over the rides to be gone through: a click shows the rides on the map and the day in
 * its pane, the tick puts them on the day, the cross says they are not of it.
 */
export function Rides(props: { onOpen: (tripId: number, dayId: string) => void; onShow: (tripId: number, dayId: string) => void }) {
  const years = createMemo(() => ridingYears(allRides()));
  const untimed = createMemo(() => allRides().filter((ride) => ride.startedAt === null));
  const shown = () => unfolded() ?? new Set(years()[0] ? [years()[0]!.year] : []);
  const fold = (year: string) => setUnfolded(new Set(shown().has(year) ? [...shown()].filter((y) => y !== year) : [...shown(), year]));
  /** The rides in view, top to bottom, by id: what a Shift run goes through. */
  const order = createMemo(() => [...years().flatMap((year) => (shown().has(year.year) ? year.months.flatMap((month) => month.days.flatMap((day) => day.rides)) : [])), ...untimed()].map((ride) => String(ride.id)));
  const isSelected = createSelector(() => selectionOf(RIDES), (id: string, ids) => ids.has(id));
  const select = (rides: readonly Ride[]) => selectIn(RIDES, new Set(rides.map((ride) => String(ride.id))));
  const [renamed, setRenamed] = createSignal<Ride>();
  // A ride shown from a day it is on has its year unfolded.
  createEffect(() => {
    const year = years().find((y) => y.months.some((month) => month.days.some((day) => day.rides.some((ride) => ride.id === revealedRide()))));
    if (year && !shown().has(year.year)) setUnfolded(new Set([...shown(), year.year]));
  });
  /** A day a ride is on: its trip and day, or its collection and section. */
  const dayText = (on: { tripId: number; dayId: string }): string => {
    const trip = (libraryTrips() ?? []).find((kept) => kept.id === on.tripId);
    const days = outlineOf(on.tripId) ?? [];
    const index = days.findIndex((day) => day.id === on.dayId);
    const day = days[index];
    return `${trip?.name ?? ''} › ${!day ? '' : trip?.kind === 'collection' ? day.name : dayLabel(day, index)}`;
  };
  /** The days a ride is on, or that it is on none. */
  const whereOf = (ride: Ride): string => (ride.days.length > 0 ? ride.days.map(dayText).join(', ') : t('On no day yet'));
  const deleteAsked = async (rides: readonly Ride[]) => {
    const [first] = rides;
    const question = rides.length > 1 ? t('Delete {what} with their files, from every day they are on?', { what: counted(rides.length, 'ride') }) : t('Delete the ride “{name}” with its file, from every day it is on?', { name: first!.name });
    if (!(await askConfirmation(question, t('Delete')))) return;
    selectIn(RIDES, NOTHING_SELECTED);
    await changeRides(async () => void (await Promise.all(rides.map((ride) => deleteRide(ride.id)))));
  };
  /** Whether the rides, of those with times, follow one another with no other between them. */
  const followOneAnother = (rides: readonly Ride[]): boolean => {
    const at = rides.map((ride) => allRides().indexOf(ride));
    return rides.every((ride) => ride.startedAt !== null) && Math.max(...at) - Math.min(...at) === rides.length - 1;
  };
  /** Merges the rides once the user agrees, who is told where they are joined after a long pause or over a way. */
  const mergeAsked = (rides: readonly Ride[]) =>
    runRidesJob(async (onProgress) => {
      const ids = rides.map((ride) => ride.id);
      const odd = (await rideJoints(ids)).filter(isOddJoint);
      const question = [
        t('Merge {what} into one? It takes the place of their files.', { what: counted(rides.length, 'recording') }),
        ...odd.map((joint) => t('Before the recording of {time} lie {pause} and {distance}.', { time: momentText(joint.startedAt!), pause: durationText(joint.pauseS ?? 0), distance: distanceText(joint.distanceM) })),
        ...(odd.some((joint) => joint.distanceM > FAR_APART_M) ? [t('The merged recording draws a straight line over such a way.')] : []),
      ].join(' ');
      if (!(await askConfirmation(question, t('Merge')))) return { text: '', errors: [] };
      const merged = await mergeRides(ids);
      selectIn(RIDES, new Set([String(merged.id)]));
      const { errors } = await autoname([merged], onProgress);
      return { text: t('{what} merged.', { what: counted(rides.length, 'recording') }), errors };
    });
  const items = (ride: Ride): MenuItem[] => {
    const ids = menuSelection(selectionOf(RIDES), String(ride.id));
    selectIn(RIDES, ids);
    const chosen = allRides().filter((kept) => ids.has(String(kept.id)));
    const several = chosen.length > 1;
    const trip = openTrip();
    const toDay = (dayId: string) => void changeRides(async () => { for (const kept of chosen) await putOnDay(kept, dayId); });
    const [only, ...more] = ride.days;
    return [
      { label: t('Rename…'), disabled: several, run: () => setRenamed(ride) },
      { label: t('Autoname'), run: () => void runRidesJob((onProgress) => autoname(chosen, onProgress)) },
      { label: t('Copy'), run: () => copyRecordings(chosen) },
      ...(trip ? [{ label: t('Add to day'), items: trip.days.map((day) => ({ label: dayTitleOf(trip, day), run: () => toDay(day.id) })) }] : []),
      { label: t('Merge'), disabled: !several || !followOneAnother(chosen), run: () => void mergeAsked(chosen) },
      only && more.length > 0 && !several
        ? { label: t('Open location'), disabled: fetchingTrip(), items: ride.days.map((on) => ({ label: dayText(on), run: () => props.onOpen(on.tripId, on.dayId) })) }
        : { label: t('Open location'), disabled: several || !only || fetchingTrip(), run: () => props.onOpen(only!.tripId, only!.dayId) },
      { label: t('Delete'), run: () => void deleteAsked(chosen) },
    ];
  };
  /** Looks through the user's trips for the days the rides on no day may be of, to be gone through above the rides. */
  const suggest = () =>
    runRidesJob(async (onProgress) => {
      onProgress(t('Looking through your trips for the days your rides may be of…'));
      const found = await suggestRideDays(-new Date().getTimezoneOffset(), (done, of) => onProgress(t('Looked through {done} of {n} days of your trips…', { done, n: of })));
      setRideSuggestions(found.length > 0 ? found : undefined);
      return { text: found.length > 0 ? '' : t('No ride that is on no day began on the date of a trip’s day or ran along its routes.'), errors: [] };
    });
  const ridesOf = (suggestion: Suggestion): Ride[] => allRides().filter((ride) => suggestion.rideIds.includes(ride.id));
  /** What is suggested, and why: the riding by its date or its one ride's name, how many files and how far, and what it has in common with the day. */
  const suggestionDetail = (suggestion: Suggestion): string => {
    const rides = ridesOf(suggestion);
    return [
      suggestion.date === null ? rides[0]?.name : dateText(suggestion.date),
      rides.length > 1 ? counted(rides.length, 'recording') : suggestion.date !== null && rides[0]?.name,
      distanceText(totalDistance(rides)),
      suggestion.sameDate && t('on this day'),
      suggestion.share > 0 && t('{share} % along the routes', { share: Math.round(suggestion.share * 100) }),
    ]
      .filter(Boolean)
      .join(' · ');
  };
  /** Shows what is suggested: the rides on the map, and the day in its pane with its routes. */
  const showSuggestion = (suggestion: Suggestion) => {
    select(ridesOf(suggestion));
    props.onShow(suggestion.tripId, suggestion.dayId);
  };
  /** Puts the suggested rides on the day, or remembers that they are not of it; either way the suggestion is gone through. */
  const settle = (suggestion: Suggestion, accept: boolean) =>
    void changeRides(async () => {
      if (accept) for (const ride of ridesOf(suggestion)) await putOnDay(ride, suggestion.dayId);
      else await Promise.all(suggestion.rideIds.map((id) => declineRideDay(id, suggestion.dayId)));
      const left = (rideSuggestions() ?? []).filter((other) => other !== suggestion);
      setRideSuggestions(left.length > 0 ? left : undefined);
    });
  const card = (heading: string, rides: Ride[], distanceM: number) => (
    <RidingDayCard heading={heading} rides={rides} distanceM={distanceM} where={whereOf} selected={isSelected} onSelectDay={() => select(rides)} onClick={(ride, e) => clickRow(RIDES, order(), String(ride.id), e) || toggleRide(ride)} onToggle={(ride) => toggleRow(RIDES, String(ride.id))} items={items} />
  );
  const addPicked = async () => {
    const files = await pickFiles({ accept: GPX_FILE_TYPES });
    if (files.length > 0) void addRides({ files: files.map(sourceOf), inFolders: [] });
  };
  return (
    <div class="rides">
      <div class="row tab-summary">
        <span class="muted detail grow">
          <Show when={allRides().length > 0}>
            {counted(allRides().length, 'ride')} · {distanceText(totalDistance(allRides()))}
          </Show>
        </span>
        <IconButton label={t('Suggest days for the rides on no day')} onClick={() => void suggest()}>
          <SearchIcon />
        </IconButton>
        <IconButton label={t('Add rides…')} onClick={() => void addPicked()}>
          <PlusIcon />
        </IconButton>
      </div>
      <Show when={ridesError()}>{(error) => <p class="error">{errorMessage(error())}</p>}</Show>
      <Show when={ridesNote()}>
        {(said) => (
          <>
            <Show when={said().text}>
              <p class="muted hint">{said().text}</p>
            </Show>
            <For each={said().errors}>{(error) => <p class="error">{error}</p>}</For>
          </>
        )}
      </Show>
      <Show when={rideSuggestions()}>
        {(suggestions) => (
          <>
            <div class="row">
              <h4 class="grow">{t('{what} to go through', { what: counted(suggestions().length, 'suggestion') })}</h4>
              <IconButton label={t('Put the suggestions away')} onClick={() => setRideSuggestions(undefined)}>
                <CloseIcon />
              </IconButton>
            </div>
            <ul class="recordings">
              <For each={suggestions()}>
                {(suggestion) => (
                  <li class="recording">
                    <div class="row">
                      <button class="text grow" onClick={() => showSuggestion(suggestion)}>
                        <span class="lines grow">
                          <span class="name">{dayText(suggestion)}</span>
                          <span class="muted detail">{suggestionDetail(suggestion)}</span>
                        </span>
                      </button>
                      <IconButton label={t('Put on this day')} onClick={() => settle(suggestion, true)}>
                        <CheckIcon />
                      </IconButton>
                      <IconButton label={t('Not of this day')} onClick={() => settle(suggestion, false)}>
                        <CloseIcon />
                      </IconButton>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </>
        )}
      </Show>
      <Show when={ridesLoading()}>
        <p class="muted row">
          <span class="spinner" />
          {t('Reading the rides…')}
        </p>
      </Show>
      <Show when={!ridesLoading() && !ridesError() && allRides().length === 0}>
        <p class="muted">{t('No rides yet: drop the GPX files of your recordings here or add them with the plus. A recording added to a day is listed here too.')}</p>
      </Show>
      <For each={years()}>
        {(year) => (
          <>
            <h3>
              <button type="button" class="text grow fold" aria-expanded={shown().has(year.year)} onClick={() => fold(year.year)}>
                <ChevronIcon />
                <span class="grow">{year.year}</span>
                <span class="muted detail">
                  {counted(year.days, 'day')} · {distanceText(year.distanceM)}
                </span>
              </button>
            </h3>
            <Show when={shown().has(year.year)}>
              <For each={year.months}>
                {(month) => (
                  <>
                    <h4>
                      <button type="button" class="text grow" title={t('Select the rides of this month')} onClick={() => select(month.days.flatMap((day) => day.rides))}>
                        <span class="grow">{monthText(month.month)}</span>
                        <span class="muted detail">
                          {counted(month.days.length, 'day')} · {distanceText(month.distanceM)}
                        </span>
                      </button>
                    </h4>
                    <ul class="duplicates">
                      <For each={month.days}>{(day) => card(dateText(day.date), day.rides, day.distanceM)}</For>
                    </ul>
                  </>
                )}
              </For>
            </Show>
          </>
        )}
      </For>
      <Show when={untimed().length > 0}>
        <ul class="duplicates">{card(t('Without times'), untimed(), totalDistance(untimed()))}</ul>
      </Show>
      <NameDialog
        title={t('Rename recording')}
        open={renamed() !== undefined}
        placeholder={t('Name of the recording')}
        initial={renamed()?.name}
        onClose={() => setRenamed(undefined)}
        onSubmit={(name) => void changeRides(() => renameRide(renamed()!.id, name))}
      />
    </div>
  );
}

/** A day of riding as a card: its heading over how far it went, which selects all its rides, then a row per ride with when it began, its name, its length and the days it is on. */
function RidingDayCard(props: {
  heading: string;
  rides: Ride[];
  distanceM: number;
  where: (ride: Ride) => string;
  selected: (id: string) => boolean;
  onSelectDay: () => void;
  onClick: (ride: Ride, e: MouseEvent) => void;
  onToggle: (ride: Ride) => void;
  items: (ride: Ride) => MenuItem[];
}) {
  /** Brings the ride into view where it is the one to be shown, once. */
  const reveal = (row: HTMLElement, ride: Ride) => {
    if (revealedRide() !== ride.id) return;
    queueMicrotask(() => row.scrollIntoView({ block: 'center' }));
    revealRide(undefined);
  };
  return (
    <li class="card">
      <button type="button" class="text riding-day" title={t('Select the rides of this day')} onClick={props.onSelectDay}>
        <span class="grow">{props.heading}</span>
        <span class="muted detail">{distanceText(props.distanceM)}</span>
      </button>
      <ul>
        <For each={props.rides}>
          {(ride) => (
            <li
              classList={{ selected: props.selected(String(ride.id)), opened: activeRecordingId() === ride.id }}
              ref={(el) => {
                cardMenu(el, () => props.items(ride));
                reveal(el, ride);
              }}
            >
              <div class="row">
                <Pad label={t('Select {name}', { name: ride.name })} selected={props.selected(String(ride.id))} onToggle={() => props.onToggle(ride)} />
                <button class="text grow" onClick={(e) => props.onClick(ride, e)}>
                  <Show when={rideColor(ride)}>{(color) => <span class="swatch" style={{ background: color() }} />}</Show>
                  <span class="lines">
                    <span class="name">{[ride.startedAt !== null && timeOfDayText(ride.startedAt), ride.name].filter(Boolean).join(' · ')}</span>
                    <span class="muted detail">
                      {distanceText(ride.distanceM)} · {props.where(ride)}
                    </span>
                  </span>
                </button>
                <MenuButton of={ride.name} items={() => props.items(ride)} />
              </div>
            </li>
          )}
        </For>
      </ul>
    </li>
  );
}
