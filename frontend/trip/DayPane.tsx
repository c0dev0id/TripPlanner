import { createMemo, Show } from 'solid-js';
import { t } from '../i18n/t';
import { routesDistance } from '../routing/legs';
import { setEditTarget } from '../state/drawing';
import { openTrip, selectDay, selectedDay } from '../state/trip';
import { counted, distanceText, shortDateText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { ChevronIcon, PencilIcon } from '../ui/icons';
import { SidePane } from '../ui/SidePane';
import { SectionDetails } from './CollectionPanel';
import { dayTitleOf } from './labels';
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
        const heading = () => (collection() ? shown().name : [t('Day {n}', { n: openTrip()!.days.indexOf(shown()) + 1 }), shown().name].filter(Boolean).join(' · '));
        const distance = createMemo(() => routesDistance(shown().routes));
        /** The day `by` days on from the one shown, where there is one. */
        const step = (by: number) => openTrip()!.days[openTrip()!.days.indexOf(shown()) + by];
        const detail = () =>
          (collection() ? [counted(shown().routes.length, 'route'), distance() > 0 && distanceText(distance())] : [shown().date ? shortDateText(shown().date!) : t('No date'), distance() > 0 && distanceText(distance())])
            .filter(Boolean)
            .join(' · ');
        return (
          <SidePane
            label={label()}
            onClose={() => selectDay(undefined)}
            heading={
              <>
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
                <Show when={!collection()}>
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
