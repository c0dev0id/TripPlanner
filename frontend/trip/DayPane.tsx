import { createEffect, createMemo, on, Show } from 'solid-js';
import { t } from '../i18n/t';
import { routesDistance } from '../routing/legs';
import { setEditTarget } from '../state/drawing';
import { setSheet, sheet, type Sheet } from '../state/panel';
import { editingRouteId, openTrip, selectDay, selectedDay } from '../state/trip';
import { counted, distanceText, shortDateText } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { followPointer } from '../ui/followPointer';
import { ChevronIcon, CloseIcon, PencilIcon } from '../ui/icons';
import { PanelResizer } from '../ui/PanelResizer';
import { SectionDetails } from './CollectionPanel';
import { dayLabelOf } from './labels';
import { DayDetails, JournalButton } from './TripPanel';

/** The sheet a pane dragged to `height` settles as. */
const sheetOf = (height: number): Sheet => (height < window.innerHeight * 0.2 ? 'peek' : height < window.innerHeight * 0.65 ? 'half' : 'full');

/**
 * The top edge of the day's pane where it is a sheet under the map, on a phone: dragged, it
 * sets how much of the screen the sheet takes; a tap folds it down to its heading or
 * brings it back.
 */
function SheetHandle() {
  let dragged = false;
  const drag = (e: PointerEvent) => {
    const pane = (e.currentTarget as HTMLElement).parentElement!;
    const from = { y: e.clientY, height: pane.offsetHeight };
    dragged = false;
    followPointer(
      e,
      (m) => {
        if (Math.abs(m.clientY - from.y) > 4) dragged = true;
        if (!dragged) return;
        pane.classList.add('dragging');
        pane.style.height = `${from.height + from.y - m.clientY}px`;
      },
      () => {
        if (!dragged) return;
        setSheet(sheetOf(pane.offsetHeight));
        pane.classList.remove('dragging');
        pane.style.height = '';
      },
    );
  };
  const tap = () => {
    if (!dragged) setSheet(sheet() === 'peek' ? 'half' : 'peek');
  };
  const label = () => t('Drag to give the list more or less room; tap to fold it away or bring it back');
  return <button class="sheet-handle" title={label()} aria-label={label()} aria-expanded={sheet() !== 'peek'} onPointerDown={drag} onClick={tap} />;
}

/**
 * The pane of the day picked in the list, beside it: a trip's day with its routes, stops
 * and recordings, or a collection's section with its routes and waypoints. Not there
 * while no day is picked. On a phone it is a sheet under the map, which folds down to its
 * heading while a route is edited.
 */
export function DayPane() {
  const day = () => (openTrip() ? selectedDay() : undefined);
  createEffect(on(editingRouteId, (id) => setSheet(id ? 'peek' : 'half'), { defer: true }));
  return (
    <Show when={day()}>
      {(shown) => {
        const collection = () => openTrip()!.kind === 'collection';
        const label = createMemo(() => (collection() ? shown().name : dayLabelOf(openTrip()!, shown())));
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
          <aside class={`panel day-pane sheet-${sheet()}`} aria-label={label()}>
            <PanelResizer />
            <SheetHandle />
            <header class="row day-pane-header">
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
