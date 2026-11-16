import { createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch } from 'solid-js';
import { t } from '../i18n/t';
import { declineRideDay, deleteRide, errorMessage, mergeRides, renameRide, rideJoints, suggestRideDays } from '../api';
import { lineLength } from '../geo/measure';
import { GPX_FILE_TYPES } from '../gpx/import';
import { sharesOf, wholeFile } from '../model/paste';
import type { StashPart } from '../model/stash';
import type { Ride, Suggestion } from '../recording/rides';
import { FAR_APART_M, isOddJoint, likelierFirst, ridingYears, totalDistance } from '../recording/rides';
import { copyRecordings, libraryPasteItem } from '../state/clipboard';
import { fetchingTrip, libraryTab, libraryTrips, outlineOf, searchedFor } from '../state/library';
import { activeRecordingId, putOnDay, recordingColor, shownRecordings } from '../state/recordings';
import { isRidePinned, pinRides } from '../state/pins';
import { COMPARED_RIDE_COLOR } from '../model/routeLook';
import { Pin, pinItems } from '../ui/Pin';
import { opened, toggleRecording } from '../state/recordingView';
import { clearSection, ridesOnSection, section, sectionStart } from '../state/section';
import { allRides, askOfRides, changeRides, compareWithDay, revealedRide, revealRide, RIDES, ridesCompared, ridesError, ridesLoading, ridesNote, ridesOnMap, runRidesJob } from '../state/rides';
import { dayLabel, foundBecause } from '../trip/labels';
import { cardMenu } from '../ui/cardMenu';
import { fileVerb } from '../ui/fileVerb';
import { askConfirmation } from '../ui/confirm';
import { counted, dateText, distanceText, durationText, momentText, monthText, timeOfDayText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CheckIcon, ChevronIcon, CloseIcon, PlusIcon, SearchIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { Pad } from '../ui/Pad';
import { pickFiles } from '../ui/pickFile';
import { menuRows, NOTHING_SELECTED, rowSelect, selectIn, selectionOf, type RowSelect } from '../ui/selection';
import { autoname } from './autoname';
import { sourceOf } from './folderImport';
import { addRides } from './importActions';
import { keepTracks } from './stashMenu';

/** The days suggested for rides on no day that are yet to be gone through; none until they are asked for, or once they are put away. */
const [suggestions, setSuggestions] = createSignal<Suggestion[]>([]);

/** The suggestion shown last: its rides on the map, held against its day. */
const [shownSuggestion, setShownSuggestion] = createSignal<Suggestion>();

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
 * a month's heading selects all its rides, for the menu to act on together. Its pin
 * keeps it on the map beside the one opened, as on a day, in a colour its row shows
 * too; the one opened is compared with the one pinned. A ride's menu renames it, names it after where it began and ended, copies it to be pasted
 * onto a day, puts it on a day of the open trip, merges it with the selected rides it
 * follows or that follow it, opens a day it is on, and deletes it. The magnifier above
 * them asks for the days of trips the rides on no day may be of, which are then listed
 * over the rides to be gone through: a click shows the rides on the map, in red, and
 * the day in its pane, and marks the suggestion while they are shown; the tick puts
 * them on the day, the cross says they are not of it.
 */
export function Rides(props: { onOpen: (tripId: number, dayId: string) => void; onShow: (tripId: number, dayId: string) => void }) {
  /** What the rides are searched for: nothing while another tab is shown, where they need not follow what is typed. */
  const searched = () => (libraryTab() === 'recordings' ? searchedFor() : '');
  const searching = () => searched() !== '';
  /** The rides listed: all of them, or those the search finds, of those that rode the section looked up. */
  const listed = createMemo(() => {
    const onSection = ridesOnSection();
    return allRides().filter((ride) => ride.name.toLowerCase().includes(searched()) && (!onSection || onSection.has(ride.id)));
  });
  const years = createMemo(() => ridingYears(listed()));
  const untimed = createMemo(() => listed().filter((ride) => ride.startedAt === null));
  /** The years unfolded: the latest until one is folded or unfolded, and every year of what a search found. */
  const shown = () => (searching() ? new Set(years().map((year) => year.year)) : (unfolded() ?? new Set(years()[0] ? [years()[0]!.year] : [])));
  const fold = (year: string) => setUnfolded(new Set(shown().has(year) ? [...shown()].filter((y) => y !== year) : [...shown(), year]));
  /** The rides in view, top to bottom, by id: what a Shift run goes through. */
  const order = createMemo(() => [...years().flatMap((year) => (shown().has(year.year) ? year.months.flatMap((month) => month.days.flatMap((day) => day.rides)) : [])), ...untimed()].map((ride) => String(ride.id)));
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
  const whereOf = (ride: Ride): string => (ride.days.length > 0 ? ride.days.map(dayText).join(', ') : t('Not assigned to a day'));
  const deleteAsked = async (rides: readonly Ride[]) => {
    const [first] = rides;
    const question = rides.length > 1 ? t('Delete {what} and their files? They are removed from every day they are assigned to.', { what: counted(rides.length, 'ride') }) : t('Delete the ride “{name}” and its file? It is removed from every day it is assigned to.', { name: first!.name });
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
        t('Merge {what} into one? It replaces the original files.', { what: counted(rides.length, 'recording') }),
        ...odd.map((joint) => t('Gap before the recording at {time}: {pause} and {distance}.', { time: momentText(joint.startedAt!), pause: durationText(joint.pauseS ?? 0), distance: distanceText(joint.distanceM) })),
        ...(odd.some((joint) => joint.distanceM > FAR_APART_M) ? [t('The merged recording draws a straight line across such a gap.')] : []),
      ].join(' ');
      if (!(await askConfirmation(question, t('Merge')))) return { text: '', errors: [] };
      const merged = await mergeRides(ids);
      selectIn(RIDES, new Set([String(merged.id)]));
      const { errors } = await autoname([merged], onProgress);
      return { text: t('{what} merged.', { what: counted(rides.length, 'recording') }), errors };
    });
  const ridesAmong = (ids: ReadonlySet<string>): Ride[] => allRides().filter((kept) => ids.has(String(kept.id)));
  /** Keeps tracks of files of the Stash as rides and says under the heading which. */
  const keep = (parts: readonly StashPart[]) => runRidesJob(async () => ({ text: await keepTracks(parts), errors: [] }));
  /** The item that keeps the tracks copied in the Stash, alone or with their files, as rides; none while the clipboard holds none. */
  const pasteTracks = (): MenuItem | undefined => libraryPasteItem('recordings', { files: (files) => keep(sharesOf('recordings', files.map(wholeFile))), parts: keep })[0];
  /** The keys, while the rides are shown: paste keeps the tracks copied in the Stash, copy and delete act on the selected rides, as the menu does. */
  const onKey = (e: KeyboardEvent) => {
    const verb = libraryTab() === 'recordings' ? fileVerb(e) : undefined;
    const paste = verb === 'paste' ? pasteTracks() : undefined;
    const chosen = ridesAmong(selectionOf(RIDES));
    if (!(paste && 'run' in paste) && (chosen.length === 0 || (verb !== 'copy' && verb !== 'delete'))) return;
    e.preventDefault();
    if (paste && 'run' in paste) paste.run();
    else if (verb === 'copy') copyRecordings(chosen);
    else void deleteAsked(chosen);
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));
  const items = (ride: Ride): MenuItem[] => {
    const chosen = ridesAmong(new Set(menuRows(RIDES, String(ride.id))));
    const several = chosen.length > 1;
    const [only, ...more] = ride.days;
    return [
      ...(several ? [] : [{ label: t('Rename…'), run: () => setRenamed(ride) }]),
      { label: t('Autoname'), run: () => void runRidesJob((onProgress) => autoname(chosen, onProgress)) },
      { label: t('Copy'), run: () => copyRecordings(chosen) },
      // Several are pinned together and merged, which is greyed out where they do not follow one another.
      ...(several ? [...pinItems((pinned) => pinRides(chosen.map((kept) => kept.id), pinned)), { label: t('Merge'), disabled: !followOneAnother(chosen), run: () => void mergeAsked(chosen) }] : []),
      // One is shown on a day it is on, greyed out while it is on none.
      ...(several
        ? []
        : [
            only && more.length > 0
              ? { label: t('Show in trip'), disabled: fetchingTrip(), items: ride.days.map((on) => ({ label: dayText(on), run: () => props.onOpen(on.tripId, on.dayId) })) }
              : { label: t('Show in trip'), disabled: !only || fetchingTrip(), run: () => props.onOpen(only!.tripId, only!.dayId) },
          ]),
      { label: t('Delete'), run: () => void deleteAsked(chosen) },
    ];
  };
  /** Looks through the user's trips for the days the rides on no day may be of, to be gone through above the rides. */
  const suggest = () =>
    runRidesJob(async (onProgress) => {
      onProgress(t('Searching your trips for days that match your rides…'));
      const found = await suggestRideDays(-new Date().getTimezoneOffset(), (done, of) => onProgress(t('Checked {done} of {n} trip days…', { done, n: of })));
      setSuggestions(found.sort(likelierFirst));
      return { text: found.length > 0 ? '' : t('No unassigned rides match the date or routes of a trip day.'), errors: [] };
    }, false);
  const ridesOf = (suggestion: Suggestion): Ride[] => allRides().filter((ride) => suggestion.rideIds.includes(ride.id));
  /** What is suggested, and why: the riding by its date or its one ride's name, how many files and how far, and what it has in common with the day. */
  const suggestionDetail = (suggestion: Suggestion): string => {
    const rides = ridesOf(suggestion);
    return [suggestion.date !== null && dateText(suggestion.date), rides.length > 1 ? counted(rides.length, 'recording') : rides[0]?.name, distanceText(totalDistance(rides)), ...foundBecause(suggestion)]
      .filter(Boolean)
      .join(' · ');
  };
  /** Shows what is suggested: the rides on the map, in red, and the day in its pane with its routes in other colours. */
  const showSuggestion = (suggestion: Suggestion) => {
    setShownSuggestion(suggestion);
    compareWithDay(suggestion.rideIds);
    props.onShow(suggestion.tripId, suggestion.dayId);
  };
  /** Puts the suggested rides on the day, which changes the rides, or remembers that they are not of it, which changes none; either way the suggestion is gone through. */
  const settle = (suggestion: Suggestion, accept: boolean) =>
    void (accept ? changeRides : askOfRides)(async () => {
      if (accept) for (const ride of ridesOf(suggestion)) await putOnDay(ride, suggestion.dayId);
      else await Promise.all(suggestion.rideIds.map((id) => declineRideDay(id, suggestion.dayId)));
      setSuggestions(suggestions().filter((other) => other !== suggestion));
      // What was held against the day to be judged is let go of with the judgement.
      if (shownSuggestion() === suggestion) compareWithDay([]);
    });
  const card = (heading: string, rides: Ride[], distanceM: number) => (
    <RidingDayCard heading={heading} rides={rides} distanceM={distanceM} where={whereOf} select={(ride) => rowSelect(RIDES, String(ride.id), order)} onSelectDay={() => select(rides)} onOpen={toggleRecording} items={items} />
  );
  const addPicked = async () => {
    const files = await pickFiles({ accept: GPX_FILE_TYPES });
    if (files.length > 0) void addRides({ files: files.map(sourceOf), inFolders: [] });
  };
  return (
    <div class="rides">
      <div class="row tab-summary">
        <span class="muted detail grow">
          <Show when={listed().length > 0}>
            {counted(listed().length, 'ride')} · {distanceText(totalDistance(listed()))}
          </Show>
        </span>
        <IconButton label={t('Suggest days for unassigned rides')} onClick={() => void suggest()}>
          <SearchIcon />
        </IconButton>
        <IconButton label={t('Add rides…')} onClick={() => void addPicked()}>
          <PlusIcon />
        </IconButton>
      </div>
      <SectionLine />
      <Show when={pasteTracks()}>
        {(paste) => (
          <button class="paste-here" onClick={() => 'run' in paste() && (paste() as { run: () => void }).run()}>
            {paste().label}
          </button>
        )}
      </Show>
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
      <Show when={suggestions().length > 0}>
        <div class="row">
          <h4 class="grow">{t('{what} to review', { what: counted(suggestions().length, 'suggestion') })}</h4>
          <IconButton
            label={t('Dismiss suggestions')}
            onClick={() => {
              setSuggestions([]);
              compareWithDay([]);
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>
        <ul class="recordings">
          <For each={suggestions()}>
            {(suggestion) => (
              <li class="recording" classList={{ opened: shownSuggestion() === suggestion && ridesCompared() }}>
                <div class="row">
                  <button class="text grow" onClick={() => showSuggestion(suggestion)}>
                    <span class="lines grow">
                      <span class="name">{dayText(suggestion)}</span>
                      <span class="muted detail">{suggestionDetail(suggestion)}</span>
                    </span>
                  </button>
                  <IconButton label={t('Assign to this day')} onClick={() => settle(suggestion, true)}>
                    <CheckIcon />
                  </IconButton>
                  <IconButton label={t('Reject suggestion')} onClick={() => settle(suggestion, false)}>
                    <CloseIcon />
                  </IconButton>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={ridesLoading()}>
        <p class="muted row">
          <span class="spinner" />
          {t('Loading rides…')}
        </p>
      </Show>
      <Show when={!ridesLoading() && !ridesError() && allRides().length === 0}>
        <p class="muted">{t('No rides yet. Drop the GPX files of your recordings here or add them with the plus button. Recordings added to a day are listed here too.')}</p>
      </Show>
      <Show when={allRides().length > 0 && listed().length === 0}>
        <p class="muted">{t('Nothing found.')}</p>
      </Show>
      <For each={years()}>
        {(year) => (
          <>
            <h3>
              <button type="button" class="text grow fold" aria-expanded={shown().has(year.year)} disabled={searching()} onClick={() => fold(year.year)}>
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
                      <button type="button" class="text grow" title={t('Select this month\'s rides')} onClick={() => select(month.days.flatMap((day) => day.rides))}>
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
        placeholder={t('Recording name')}
        initial={renamed()?.name}
        onClose={() => setRenamed(undefined)}
        onSubmit={(name) => void changeRides(() => renameRide(renamed()!.id, name))}
      />
    </div>
  );
}

/** The colour a ride is drawn in on the map, which its row shows: of one pinned or opened, as a recording; of one held against a day, red; none for one not drawn. */
function drawnColor(ride: Ride): string | undefined {
  if (shownRecordings().some((shown) => shown.id === ride.id && shown.dayId === undefined)) return recordingColor(ride);
  return ridesOnMap().some((line) => line.id === ride.id) ? COMPARED_RIDE_COLOR : undefined;
}

/** A day of riding as a card: its heading over how far it went, which selects all its rides, then a row per ride with when it began, its name, its length and the days it is on. */
function RidingDayCard(props: {
  heading: string;
  rides: Ride[];
  distanceM: number;
  where: (ride: Ride) => string;
  select: (ride: Ride) => RowSelect;
  onSelectDay: () => void;
  onOpen: (ride: Ride) => void;
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
      <button type="button" class="text riding-day" title={t('Select this day\'s rides')} onClick={props.onSelectDay}>
        <span class="grow">{props.heading}</span>
        <span class="muted detail">{distanceText(props.distanceM)}</span>
      </button>
      <ul>
        <For each={props.rides}>
          {(ride) => {
            const select = props.select(ride);
            return (
              <li
                classList={{ selected: select.selected(), opened: activeRecordingId() === ride.id }}
                ref={(el) => {
                  cardMenu(el, () => props.items(ride));
                  reveal(el, ride);
                }}
              >
                <div class="row">
                  <Pad label={t('Select {name}', { name: ride.name })} selected={select.selected()} onToggle={select.onToggle} />
                  <button class="text grow" onClick={(e) => select.onClick(e) || props.onOpen(ride)}>
                    <Show when={drawnColor(ride)}>{(color) => <span class="swatch" style={{ background: color() }} />}</Show>
                    <span class="lines">
                      <span class="name">{[ride.startedAt !== null && timeOfDayText(ride.startedAt), ride.name].filter(Boolean).join(' · ')}</span>
                      <span class="muted detail">
                        {distanceText(ride.distanceM)} · {props.where(ride)}
                      </span>
                    </span>
                  </button>
                  <Pin of={ride.name} pinned={isRidePinned(ride.id)} onToggle={(pinned) => pinRides([ride.id], pinned)} />
                  <MenuButton of={ride.name} items={() => props.items(ride)} />
                </div>
              </li>
            );
          }}
        </For>
      </ul>
    </li>
  );
}

/** What the section lookup stands at: the section the list is narrowed to, with the button that lets go of it; the end still to mark; or, with a ride opened, how to start one. */
function SectionLine() {
  return (
    <Switch>
      <Match when={section()}>
        {(line) => (
          <div class="row section-line">
            <span class="grow">{t('Rides on a {distance} section', { distance: distanceText(lineLength(line())) })}</span>
            <IconButton label={t('Clear section')} onClick={clearSection}>
              <CloseIcon />
            </IconButton>
          </div>
        )}
      </Match>
      <Match when={sectionStart()}>
        <p class="muted hint">{t('Cmd-click the ride to set the other end of the section.')}</p>
      </Match>
      <Match when={opened() && opened()!.recording.dayId === undefined}>
        <p class="muted hint">{t('Cmd-click two points on the ride to find all rides on that section.')}</p>
      </Match>
    </Switch>
  );
}
