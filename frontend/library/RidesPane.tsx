import { createEffect, createMemo, createSelector, createSignal, For, on, onCleanup, Show } from 'solid-js';
import { t } from '../i18n/t';
import { deleteRide, errorMessage, renameRide } from '../api';
import type { Ride } from '../recording/rides';
import { ridingYears } from '../recording/rides';
import { copyRecordings } from '../state/clipboard';
import { fetchingTrip, libraryTrips, outlineOf, showReport } from '../state/library';
import { putOnDay, relistRecordings } from '../state/recordings';
import { allRides, refreshRides, revealedRide, revealRide, rideColor, RIDES, ridesError, ridesLoading } from '../state/rides';
import { openTrip, selectedDayId } from '../state/trip';
import { dayLabel, dayTitleOf } from '../trip/labels';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { counted, dateText, distanceText, monthText, timeOfDayText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, PlusIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { Pad } from '../ui/Pad';
import { pickFiles } from '../ui/pickFile';
import { clickRow, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, toggleRow } from '../ui/selection';
import { SidePane } from '../ui/SidePane';
import { importRides } from './dropImport';
import type { Dropped } from './fileDrop';
import { sourceOf } from './folderImport';

/** The years unfolded, kept while the page stands; none until the rides are read, when the latest unfolds. */
const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>();

/** How keeping files as rides goes, then how many were kept and what could not be read; and what else went wrong in the pane. */
const [note, setNote] = createSignal<{ text: string; errors: string[] }>();
let importing = false;

/**
 * Keeps the GPX files dropped or picked as rides and shows their pane, which says how it
 * goes; while one import runs, another is not started.
 */
export async function addRides(dropped: Dropped | Promise<Dropped>): Promise<void> {
  if (importing) return;
  importing = true;
  showReport('rides');
  try {
    const { files, inFolders } = await dropped;
    setNote(await importRides([...files, ...inFolders], (text) => setNote({ text, errors: [] })));
  } finally {
    importing = false;
    refreshRides();
  }
}

/** Runs a change to rides, then has them read again, the open trip's too; why it failed is said in the pane. */
async function change(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
    setNote(undefined);
  } catch (fault) {
    setNote({ text: '', errors: [errorMessage(fault)] });
  }
  refreshRides();
  relistRecordings();
}

/**
 * The rides in the pane between the library and the map: every recording the user keeps
 * by when it was ridden, in years, months and days of riding, each with how far it
 * went and the days of trips it is on; those without times come last. Its plus, and
 * files dropped on it, keep GPX files as rides. A click or a tap on a ride selects it,
 * with Cmd or Ctrl one more, with Shift a run of them; its pad adds or takes it away; a
 * day's or a month's heading selects all its rides. The map draws what is selected,
 * each ride in a colour its row shows too. A ride's menu renames it, copies it to be
 * pasted onto a day, puts it on a day of the open trip, opens a day it is on, whose
 * pane takes this one's place, and deletes it.
 */
export function RidesPane(props: { onOpen: (tripId: number, dayId: string) => void }) {
  const years = createMemo(() => ridingYears(allRides()));
  const untimed = createMemo(() => allRides().filter((ride) => ride.startedAt === null));
  const shown = () => unfolded() ?? new Set(years()[0] ? [years()[0]!.year] : []);
  const fold = (year: string) => setUnfolded(new Set(shown().has(year) ? [...shown()].filter((y) => y !== year) : [...shown(), year]));
  /** The rides in view, top to bottom, by id: what a Shift run goes through. */
  const order = createMemo(() => [...years().flatMap((year) => (shown().has(year.year) ? year.months.flatMap((month) => month.days.flatMap((day) => day.rides)) : [])), ...untimed()].map((ride) => String(ride.id)));
  const isSelected = createSelector(() => selectionOf(RIDES), (id: string, ids) => ids.has(id));
  const select = (rides: readonly Ride[]) => selectIn(RIDES, new Set(rides.map((ride) => String(ride.id))));
  const [renamed, setRenamed] = createSignal<Ride>();
  onCleanup(() => selectIn(RIDES, NOTHING_SELECTED));
  // A day picked elsewhere takes the pane.
  createEffect(on(selectedDayId, (id) => id && showReport(undefined), { defer: true }));
  // A ride shown from a day it is on has its year unfolded.
  createEffect(() => {
    const year = years().find((y) => y.months.some((month) => month.days.some((day) => day.rides.some((ride) => ride.id === revealedRide()))));
    if (year && !shown().has(year.year)) setUnfolded(new Set([...shown(), year.year]));
  });
  /** A day a ride is on: its trip and day, or its collection and section. */
  const dayText = (on: Ride['days'][number]): string => {
    const trip = (libraryTrips() ?? []).find((kept) => kept.id === on.tripId);
    const days = outlineOf(on.tripId) ?? [];
    const index = days.findIndex((day) => day.id === on.dayId);
    const day = days[index];
    return `${on.trip} › ${!day ? '' : trip?.kind === 'collection' ? day.name : dayLabel(day, index)}`;
  };
  /** The days a ride is on, or that it is on none. */
  const whereOf = (ride: Ride): string => (ride.days.length > 0 ? ride.days.map(dayText).join(', ') : t('On no day yet'));
  const open = (on: Ride['days'][number]) => {
    showReport(undefined);
    props.onOpen(on.tripId, on.dayId);
  };
  const deleteAsked = async (rides: readonly Ride[]) => {
    const [first] = rides;
    const question = rides.length > 1 ? t('Delete {what} with their files, from every day they are on?', { what: counted(rides.length, 'ride') }) : t('Delete the ride “{name}” with its file, from every day it is on?', { name: first!.name });
    if (!(await askConfirmation(question, t('Delete')))) return;
    selectIn(RIDES, NOTHING_SELECTED);
    await change(() => Promise.all(rides.map((ride) => deleteRide(ride.id))));
  };
  const items = (ride: Ride): MenuItem[] => {
    const ids = menuSelection(selectionOf(RIDES), String(ride.id));
    selectIn(RIDES, ids);
    const chosen = allRides().filter((kept) => ids.has(String(kept.id)));
    const several = chosen.length > 1;
    const trip = openTrip();
    const toDay = (dayId: string) => void change(async () => { for (const kept of chosen) await putOnDay(kept, dayId); });
    const [only, ...more] = ride.days;
    return [
      { label: t('Rename…'), disabled: several, run: () => setRenamed(ride) },
      { label: t('Copy'), run: () => copyRecordings(chosen) },
      ...(trip ? [{ label: t('Add to day'), items: trip.days.map((day) => ({ label: dayTitleOf(trip, day), run: () => toDay(day.id) })) }] : []),
      only && more.length > 0 && !several
        ? { label: t('Open location'), disabled: fetchingTrip(), items: ride.days.map((on) => ({ label: dayText(on), run: () => open(on) })) }
        : { label: t('Open location'), disabled: several || !only || fetchingTrip(), run: () => open(only!) },
      { label: t('Delete'), run: () => void deleteAsked(chosen) },
    ];
  };
  const card = (heading: string, rides: Ride[], distanceM: number) => (
    <RidingDayCard heading={heading} rides={rides} distanceM={distanceM} where={whereOf} selected={isSelected} onSelectDay={() => select(rides)} onClick={(ride, e) => clickRow(RIDES, order(), String(ride.id), e) || select([ride])} onToggle={(ride) => toggleRow(RIDES, String(ride.id))} items={items} />
  );
  const addPicked = async () => {
    const files = await pickFiles({ accept: '.gpx,application/gpx+xml' });
    if (files.length > 0) void addRides({ files: files.map(sourceOf), inFolders: [] });
  };
  return (
    <SidePane
      label={t('Rides')}
      onClose={() => showReport(undefined)}
      heading={
        <>
          <span class="lines grow">
            <span class="name">{t('Rides')}</span>
            <Show when={allRides().length > 0}>
              <span class="muted detail">
                {counted(allRides().length, 'ride')} · {distanceText(allRides().reduce((sum, ride) => sum + ride.distanceM, 0))}
              </span>
            </Show>
          </span>
          <IconButton label={t('Add rides…')} onClick={() => void addPicked()}>
            <PlusIcon />
          </IconButton>
        </>
      }
    >
      <div class="day-details rides" data-drop-rides>
        <Show when={ridesError()}>{(error) => <p class="error">{errorMessage(error())}</p>}</Show>
        <Show when={note()}>
          {(said) => (
            <>
              <Show when={said().text}>
                <p class="muted hint">{said().text}</p>
              </Show>
              <For each={said().errors}>{(error) => <p class="error">{error}</p>}</For>
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
          <ul class="duplicates">{card(t('Without times'), untimed(), untimed().reduce((sum, ride) => sum + ride.distanceM, 0))}</ul>
        </Show>
      </div>
      <NameDialog
        title={t('Rename recording')}
        open={renamed() !== undefined}
        placeholder={t('Name of the recording')}
        initial={renamed()?.name}
        onClose={() => setRenamed(undefined)}
        onSubmit={(name) => void change(() => renameRide(renamed()!.id, name))}
      />
    </SidePane>
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
              classList={{ selected: props.selected(String(ride.id)) }}
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
