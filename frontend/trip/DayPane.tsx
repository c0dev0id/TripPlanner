import { createMemo, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { Day } from '../model/trip';
import { routesDistance } from '../routing/legs';
import { setShowNeighbours, showNeighbours } from '../state/drawing';
import { mediaOf } from '../state/media';
import { recordingsOf } from '../state/recordings';
import { isPlaceList, paneShown, shownDay } from '../state/library';
import { addDay, closeDaysPane, openTrip, openTripId, selectDay } from '../state/trip';
import { counted, distanceText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, NeighboursIcon, PlusIcon } from '../ui/icons';
import { Pane } from '../ui/Pane';
import { SectionDetails } from './CollectionPanel';
import { DayStrip } from './DayStrip';
import { dayDetail, dayHeading, dayTitleOf } from './labels';
import { TripPanel } from './TripPanel';

/** A day as its labels count it: its date, what it holds and how far its routes go. */
export const dayCounts = (day: Day) => ({ date: day.date, routes: day.routes.length, stops: day.stops.length, recordings: recordingsOf(day.id).length, media: mediaOf(day.id).length, distanceM: routesDistance(day.routes) });

/**
 * The pane beside the library: of a trip its days under each other, of a list of places
 * the category picked in the tree. Not there while a trip's pane is closed, or no
 * category is picked.
 */
export function DayPane() {
  return (
    <Show when={paneShown()}>
      <Show when={openTrip()!.kind === 'trip'} fallback={<SectionPane />}>
        <DaysPane />
      </Show>
    </Show>
  );
}


/** The pane of the open trip: its name over how many days it has and how far they go, and its days, of which one at a time is shown with what it holds. */
function DaysPane() {
  const trip = () => openTrip()!;
  const distance = createMemo(() => routesDistance(trip().days.flatMap((day) => day.routes)));
  const detail = () => [counted(trip().days.length, 'day'), distance() > 0 && distanceText(distance())].filter(Boolean).join(' · ');
  const neighboursLabel = () => t(showNeighbours() ? 'Hide adjacent days' : 'Show adjacent days (dimmed)');
  return (
    <Pane
      level="second"
      label={trip().name}
      onClose={closeDaysPane}
      strip={<DayStrip />}
      heading={
        <>
          <span class="lines grow">
            <span class="name" title={trip().name}>
              {trip().name}
            </span>
            <span class="muted detail">{detail()}</span>
          </span>
          <IconButton label={neighboursLabel()} pressed={showNeighbours()} onClick={() => setShowNeighbours(!showNeighbours())}>
            <NeighboursIcon />
          </IconButton>
          <IconButton label={t('Add day')} onClick={addDay}>
            <PlusIcon />
          </IconButton>
        </>
      }
    >
      <TripPanel />
    </Pane>
  );
}

/** The pane of the category picked in a list: its name between the steps to the ones before and after, over what it holds. */
function SectionPane() {
  return (
    <Show when={shownDay()}>
      {(shown) => {
        const label = createMemo(() => dayTitleOf(openTrip()!, shown()));
        const heading = () => dayHeading(openTrip()!.kind, openTrip()!.days.indexOf(shown()), shown().name);
        /** The section `by` sections on from the one shown, where there is one. */
        const step = (by: number) => openTrip()!.days[openTrip()!.days.indexOf(shown()) + by];
        const detail = () => dayDetail(openTrip()!.kind, dayCounts(shown()), isPlaceList(openTripId()));
        return (
          <Pane
            level="second"
            label={label()}
            onClose={closeDaysPane}
            strip={<DayStrip />}
            heading={
              <span class="day-title">
                <span class="day-step">
                  <IconButton label={t('Previous section')} disabled={!step(-1)} onClick={() => selectDay(step(-1)!.id)}>
                    <ChevronIcon />
                  </IconButton>
                </span>
                <span class="lines grow">
                  <span class="name" title={label()}>
                    {heading()}
                  </span>
                  <span class="muted detail">{detail()}</span>
                </span>
                <span class="day-step">
                  <IconButton label={t('Next section')} disabled={!step(1)} onClick={() => selectDay(step(1)!.id)}>
                    <ChevronIcon />
                  </IconButton>
                </span>
              </span>
            }
          >
            <SectionDetails day={shown()} />
          </Pane>
        );
      }}
    </Show>
  );
}
