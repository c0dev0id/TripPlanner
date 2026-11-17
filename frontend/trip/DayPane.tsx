import { createMemo, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { Day } from '../model/trip';
import { routesDistance } from '../routing/legs';
import { setEditTarget, setShowNeighbours, showNeighbours } from '../state/drawing';
import { mediaOf } from '../state/media';
import { recordingsOf } from '../state/recordings';
import { isPlaceList, paneShown } from '../state/library';
import { addDay, closeDaysPane, closeDetail, detailDay, endLook, openDetail, openTrip, openTripId, selectDay, selectedDayId } from '../state/trip';
import { counted, distanceText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, NeighboursIcon, PencilIcon, PlusIcon } from '../ui/icons';
import { Pane } from '../ui/Pane';
import { SectionDetails } from './CollectionPanel';
import { DayStrip } from './DayStrip';
import { dayDetail, dayHeading, dayTitleOf } from './labels';
import { DayDetails, TripPanel } from './TripPanel';

/** A day as its labels count it: its date, what it holds and how far its routes go. */
export const dayCounts = (day: Day) => ({ date: day.date, routes: day.routes.length, stops: day.stops.length, recordings: recordingsOf(day.id).length, media: mediaOf(day.id).length, distanceM: routesDistance(day.routes) });

/**
 * The panes beside the library: of a trip its days under each other and, beside them,
 * what a day holds; of a list of places the category whose pad was pressed in the tree.
 * Not there while a trip's pane is closed, or no category's is open.
 */
export function DayPane() {
  return (
    <Show when={paneShown()}>
      <Show when={openTrip()!.kind === 'trip'} fallback={<SectionPane />}>
        <DaysPane />
        <DetailPane />
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
      onUse={endLook}
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

/**
 * The pane of what a day holds, opened by the pad on the day's row: its name over its
 * date and length, and its notes, routes, stops, recordings and media. The day need not
 * be the one on the map; a click in the pane makes it that.
 */
function DetailPane() {
  return (
    <Show when={detailDay()}>
      {(day) => {
        const label = createMemo(() => dayTitleOf(openTrip()!, day()));
        const backToDay = () => {
          endLook();
          if (selectedDayId() !== day().id) selectDay(day().id);
        };
        return (
          <Pane
            level="detail"
            label={label()}
            onClose={closeDetail}
            onUse={backToDay}
            heading={
              <>
                <span class="lines grow">
                  <span class="name" title={label()}>
                    {dayHeading('trip', openTrip()!.days.indexOf(day()), day().name)}
                  </span>
                  <span class="muted detail">{dayDetail('trip', dayCounts(day()))}</span>
                </span>
                <IconButton label={t('Edit {what}', { what: label() })} onClick={() => setEditTarget({ kind: 'day', id: day().id })}>
                  <PencilIcon />
                </IconButton>
              </>
            }
          >
            <DayDetails day={day()} />
          </Pane>
        );
      }}
    </Show>
  );
}

/** The pane of a category of a list, opened by the pad on its row: its name between the steps to the ones before and after, over what it holds. A click in it shows the category on the map. */
function SectionPane() {
  return (
    <Show when={detailDay()}>
      {(shown) => {
        const label = createMemo(() => dayTitleOf(openTrip()!, shown()));
        const heading = () => dayHeading(openTrip()!.kind, openTrip()!.days.indexOf(shown()), shown().name);
        /** The section `by` sections on from the one shown, where there is one. */
        const step = (by: number) => openTrip()!.days[openTrip()!.days.indexOf(shown()) + by];
        const detail = () => dayDetail(openTrip()!.kind, dayCounts(shown()), isPlaceList(openTripId()));
        const backToSection = () => {
          endLook();
          if (selectedDayId() !== shown().id) selectDay(shown().id);
        };
        return (
          <Pane
            level="second"
            label={label()}
            onClose={closeDetail}
            onUse={backToSection}
            strip={<DayStrip />}
            heading={
              <span class="day-title">
                <span class="day-step">
                  <IconButton label={t('Previous section')} disabled={!step(-1)} onClick={() => openDetail(step(-1)!.id)}>
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
                  <IconButton label={t('Next section')} disabled={!step(1)} onClick={() => openDetail(step(1)!.id)}>
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
