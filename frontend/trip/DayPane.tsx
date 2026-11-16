import { createMemo, Show } from 'solid-js';
import { t } from '../i18n/t';
import type { Day } from '../model/trip';
import { routesDistance } from '../routing/legs';
import { setEditTarget, setShowNeighbours, showNeighbours } from '../state/drawing';
import { mediaOf } from '../state/media';
import { unfoldAfterPane } from '../state/panel';
import { recordingsOf } from '../state/recordings';
import { isPlaceList, shownDay } from '../state/library';
import { openTrip, openTripId, selectDay } from '../state/trip';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, NeighboursIcon, PencilIcon } from '../ui/icons';
import { SidePane } from '../ui/SidePane';
import { SectionDetails } from './CollectionPanel';
import { dayDetail, dayHeading, dayTitleOf } from './labels';
import { DayDetails, JournalButton } from './TripPanel';

/** A day as its labels count it: its date, what it holds and how far its routes go. */
export const dayCounts = (day: Day) => ({ date: day.date, routes: day.routes.length, stops: day.stops.length, recordings: recordingsOf(day.id).length, media: mediaOf(day.id).length, distanceM: routesDistance(day.routes) });

/**
 * The pane of the day picked in the list, beside it: a trip's day with its routes, stops
 * and recordings, or a collection's section with its routes and waypoints. Not there
 * while no day is picked.
 */
export function DayPane() {
  const day = shownDay;
  return (
    <Show when={day()}>
      {(shown) => {
        const collection = () => openTrip()!.kind === 'collection';
        const label = createMemo(() => dayTitleOf(openTrip()!, shown()));
        /** The label without the date, which stands under it. */
        const heading = () => dayHeading(openTrip()!.kind, openTrip()!.days.indexOf(shown()), shown().name);
        /** The day `by` days on from the one shown, where there is one. */
        const step = (by: number) => openTrip()!.days[openTrip()!.days.indexOf(shown()) + by];
        const detail = () => dayDetail(openTrip()!.kind, dayCounts(shown()), isPlaceList(openTripId()));
        const neighboursLabel = () => t(showNeighbours() ? 'Hide adjacent days' : 'Show adjacent days (dimmed)');
        return (
          <SidePane
            label={label()}
            // Closed by its own button, the pane gives the library its room back where the library folds by itself; to keep the library folded, the day is closed from its chip in the strip.
            onClose={() => {
              selectDay(undefined);
              unfoldAfterPane();
            }}
            heading={
              <>
                <span class="day-title">
                  <span class="day-step">
                    <IconButton label={t(collection() ? 'Previous section' : 'Previous day')} disabled={!step(-1)} onClick={() => selectDay(step(-1)!.id)}>
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
                    <IconButton label={t(collection() ? 'Next section' : 'Next day')} disabled={!step(1)} onClick={() => selectDay(step(1)!.id)}>
                      <ChevronIcon />
                    </IconButton>
                  </span>
                </span>
                <Show when={!collection()}>
                  <IconButton label={neighboursLabel()} pressed={showNeighbours()} onClick={() => setShowNeighbours(!showNeighbours())}>
                    <NeighboursIcon />
                  </IconButton>
                  <IconButton label={t('Edit {what}', { what: label() })} onClick={() => setEditTarget({ kind: 'day', id: shown().id })}>
                    <PencilIcon />
                  </IconButton>
                  <JournalButton target={{ dayId: shown().id }} of={label()} />
                </Show>
              </>
            }
          >
            <Show when={collection()} fallback={<DayDetails day={shown()} />}>
              <SectionDetails day={shown()} />
            </Show>
          </SidePane>
        );
      }}
    </Show>
  );
}
