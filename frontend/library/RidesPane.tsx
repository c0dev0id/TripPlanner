import { createEffect, createMemo, createSelector, createSignal, For, on, onCleanup, Show } from 'solid-js';
import { t } from '../i18n/t';
import { errorMessage } from '../api';
import type { Ride, RidingDay } from '../recording/rides';
import { ridingYears } from '../recording/rides';
import { fetchingTrip, libraryFolders, libraryTrips, outlineOf, showReport } from '../state/library';
import { allRides, revealedRide, revealRide, rideColor, RIDES, ridesError, ridesLoading } from '../state/rides';
import { selectedDayId } from '../state/trip';
import { dayLabel } from '../trip/labels';
import { cardMenu } from '../ui/cardMenu';
import { counted, dateText, distanceText, monthText, timeOfDayText } from '../ui/format';
import { ChevronIcon } from '../ui/icons';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { Pad } from '../ui/Pad';
import { clickRow, menuSelection, NOTHING_SELECTED, selectIn, selectionOf, toggleRow } from '../ui/selection';
import { SidePane } from '../ui/SidePane';
import { kindAround } from './folders';

/** The years unfolded, kept while the page stands; none until the rides are read, when the latest unfolds. */
const [unfolded, setUnfolded] = createSignal<ReadonlySet<string>>();

/**
 * The rides in the pane between the library and the map: every recording by when it was
 * ridden, in years, months and days of riding, each with how far it went, whatever trip
 * or collection keeps it. A click or a tap on a ride selects it, with Cmd or Ctrl one
 * more, with Shift a run of them; its pad adds or takes it away; a day's or a month's
 * heading selects all its rides. The map draws what is selected, each ride in a colour
 * its row shows too. A ride's menu opens the day that keeps it, whose pane takes this
 * one's place.
 */
export function RidesPane(props: { onOpen: (tripId: number, dayId: string) => void }) {
  const years = createMemo(() => ridingYears(allRides()));
  const shown = () => unfolded() ?? new Set(years()[0] ? [years()[0]!.year] : []);
  const fold = (year: string) => setUnfolded(new Set(shown().has(year) ? [...shown()].filter((y) => y !== year) : [...shown(), year]));
  /** The rides in view, top to bottom, by id: what a Shift run goes through. */
  const order = createMemo(() => years().flatMap((year) => (shown().has(year.year) ? year.months.flatMap((month) => month.days.flatMap((day) => day.rides.map((ride) => String(ride.id)))) : [])));
  const isSelected = createSelector(() => selectionOf(RIDES), (id: string, ids) => ids.has(id));
  const select = (rides: readonly Ride[]) => selectIn(RIDES, new Set(rides.map((ride) => String(ride.id))));
  onCleanup(() => selectIn(RIDES, NOTHING_SELECTED));
  // A day picked elsewhere takes the pane.
  createEffect(on(selectedDayId, (id) => id && showReport(undefined), { defer: true }));
  // A ride shown from where it is kept has its year unfolded.
  createEffect(() => {
    const year = years().find((y) => y.months.some((month) => month.days.some((day) => day.rides.some((ride) => ride.id === revealedRide()))));
    if (year && !shown().has(year.year)) setUnfolded(new Set([...shown(), year.year]));
  });
  /** Where a ride is kept: its trip and day, its collection and section, or nowhere but among the recordings that wait for their day. */
  const whereOf = (ride: Ride): string => {
    const trip = (libraryTrips() ?? []).find((kept) => kept.id === ride.tripId);
    if (!trip) return '';
    if (kindAround(libraryFolders() ?? [], trip.folderId) === 'recordings') return t('On no day yet');
    const days = outlineOf(trip.id) ?? [];
    const index = days.findIndex((day) => day.id === ride.dayId);
    const day = days[index];
    return `${trip.name} › ${!day ? '' : trip.kind === 'collection' ? day.name : dayLabel(day, index)}`;
  };
  const open = (ride: Ride) => {
    showReport(undefined);
    props.onOpen(ride.tripId, ride.dayId);
  };
  const items = (ride: Ride): MenuItem[] => {
    const chosen = menuSelection(selectionOf(RIDES), String(ride.id));
    selectIn(RIDES, chosen);
    return [{ label: t('Open location'), disabled: chosen.size > 1 || fetchingTrip(), run: () => open(ride) }];
  };
  return (
    <SidePane
      label={t('Rides')}
      onClose={() => showReport(undefined)}
      heading={
        <span class="lines grow">
          <span class="name">{t('Rides')}</span>
          <Show when={allRides().length > 0}>
            <span class="muted detail">
              {counted(allRides().length, 'ride')} · {distanceText(allRides().reduce((sum, ride) => sum + ride.distanceM, 0))}
            </span>
          </Show>
        </span>
      }
    >
      <div class="day-details rides">
        <Show when={ridesError()}>{(error) => <p class="error">{errorMessage(error())}</p>}</Show>
        <Show when={ridesLoading()}>
          <p class="muted row">
            <span class="spinner" />
            {t('Reading the rides…')}
          </p>
        </Show>
        <Show when={!ridesLoading() && !ridesError() && years().length === 0}>
          <p class="muted">{t('No rides yet: recordings added to a day or to the folder for recordings are listed here by when they were ridden.')}</p>
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
                        <For each={month.days}>
                          {(day) => (
                            <RidingDayCard day={day} where={whereOf} selected={isSelected} onSelectDay={() => select(day.rides)} onClick={(ride, e) => clickRow(RIDES, order(), String(ride.id), e) || select([ride])} onToggle={(ride) => toggleRow(RIDES, String(ride.id))} items={items} />
                          )}
                        </For>
                      </ul>
                    </>
                  )}
                </For>
              </Show>
            </>
          )}
        </For>
      </div>
    </SidePane>
  );
}

/** A day of riding as a card: its date over how far it went, which selects all its rides, then a row per ride with when it began, its name, its length and where it is kept. */
function RidingDayCard(props: {
  day: RidingDay;
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
        <span class="grow">{dateText(props.day.date)}</span>
        <span class="muted detail">{distanceText(props.day.distanceM)}</span>
      </button>
      <ul>
        <For each={props.day.rides}>
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
                    <span class="name">
                      {timeOfDayText(ride.startedAt!)} · {ride.name}
                    </span>
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
