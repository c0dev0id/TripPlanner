import { createMemo, Show } from 'solid-js';
import { t } from '../i18n/t';
import { routesDistance } from '../routing/legs';
import { setEditTarget } from '../state/drawing';
import { openTrip, selectDay, selectedDay } from '../state/trip';
import { counted, distanceText, shortDateText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CloseIcon, PencilIcon } from '../ui/icons';
import { PanelResizer } from '../ui/PanelResizer';
import { SectionDetails } from './CollectionPanel';
import { dayLabelOf } from './labels';
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
        const label = createMemo(() => (collection() ? shown().name : dayLabelOf(openTrip()!, shown())));
        /** The label without the date, which stands under it. */
        const heading = () => (collection() ? shown().name : [t('Day {n}', { n: openTrip()!.days.indexOf(shown()) + 1 }), shown().name].filter(Boolean).join(' · '));
        const distance = createMemo(() => routesDistance(shown().routes));
        const detail = () =>
          (collection() ? [counted(shown().routes.length, 'route'), distance() > 0 && distanceText(distance())] : [shown().date ? shortDateText(shown().date!) : t('No date'), distance() > 0 && distanceText(distance())])
            .filter(Boolean)
            .join(' · ');
        return (
          <aside class="panel day-pane" aria-label={label()}>
            <PanelResizer />
            <header class="row day-pane-header">
              <span class="lines grow">
                <span class="name" title={label()}>
                  {heading()}
                </span>
                <span class="muted detail">{detail()}</span>
              </span>
              <Show when={!collection()}>
                <IconButton label={t('Edit {what}', { what: label() })} onClick={() => setEditTarget({ kind: 'day', id: shown().id })}>
                  <PencilIcon />
                </IconButton>
                <JournalButton target={{ dayId: shown().id }} of={label()} />
              </Show>
              <IconButton label={t('Close {what}', { what: label() })} onClick={() => selectDay(undefined)}>
                <CloseIcon />
              </IconButton>
            </header>
            <Show when={collection()} fallback={<DayDetails day={shown()} />}>
              <SectionDetails day={shown()} />
            </Show>
          </aside>
        );
      }}
    </Show>
  );
}
