import { createMemo, Show } from 'solid-js';
import { t } from '../i18n/t';
import { routesDistance } from '../routing/legs';
import { setEditTarget, setShowNeighbours, showNeighbours } from '../state/drawing';
import { openTrip, selectDay, selectedDay } from '../state/trip';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, NeighboursIcon, PencilIcon } from '../ui/icons';
import { SidePane } from '../ui/SidePane';
import { SectionDetails } from './CollectionPanel';
import { dayDetail, dayHeading, dayTitleOf } from './labels';
import { DayDetails, JournalButton } from './TripPanel';

/**
 * The pane of the day picked in the list, beside it: a trip's day with its routes, stops
 * and recordings, or a collection's section with its routes and waypoints. Not there
 * while no day is picked.
 */
export function DayPane() {
  const day = () => (openTrip() ? selectedDay() : undefined);
  return (
    <Show when={day()}>
      {(shown) => {
        const collection = () => openTrip()!.kind === 'collection';
        const label = createMemo(() => dayTitleOf(openTrip()!, shown()));
        /** The label without the date, which stands under it. */
        const heading = () => dayHeading(openTrip()!.kind, openTrip()!.days.indexOf(shown()), shown().name);
        const distance = createMemo(() => routesDistance(shown().routes));
        /** The day `by` days on from the one shown, where there is one. */
        const step = (by: number) => openTrip()!.days[openTrip()!.days.indexOf(shown()) + by];
        const detail = () => dayDetail(openTrip()!.kind, { date: shown().date, routes: shown().routes.length, stops: shown().stops.length, distanceM: distance() });
        const neighboursLabel = () => t(showNeighbours() ? 'Hide the neighbouring days on the map' : 'Show the neighbouring days on the map, dimmed');
        return (
          <SidePane
            label={label()}
            onClose={() => selectDay(undefined)}
            heading={
              <>
                <span class="day-title">
                  <span class="day-step">
                    <IconButton label={t(collection() ? 'The section before' : 'The day before')} disabled={!step(-1)} onClick={() => selectDay(step(-1)!.id)}>
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
                    <IconButton label={t(collection() ? 'The section after' : 'The day after')} disabled={!step(1)} onClick={() => selectDay(step(1)!.id)}>
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
