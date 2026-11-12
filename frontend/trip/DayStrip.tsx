import { dayColor } from '../model/routeLook';
import { routeColoring } from '../state/preferences';
import { openTrip, selectDay, selectedDayId } from '../state/trip';
import { ForById } from '../ui/ForById';
import { dayTitleOf } from './labels';

/**
 * The open trip's days in the strip the library folds away to: a numbered button each, in
 * the colour its routes have where the days are coloured apart. A click shows the day, or
 * closes it where it is shown already.
 */
export function DayStrip() {
  return (
    <ol class="day-strip">
      <ForById each={openTrip()!.days}>
        {(day, index) => {
          const shown = () => selectedDayId() === day().id;
          const color = () => dayColor(index(), routeColoring());
          const label = () => dayTitleOf(openTrip()!, day());
          return (
            <li>
              <button class="day-chip" classList={{ colored: color() !== undefined }} style={{ background: color() }} title={label()} aria-label={label()} aria-pressed={shown()} onClick={() => selectDay(shown() ? undefined : day().id)}>
                {index() + 1}
              </button>
            </li>
          );
        }}
      </ForById>
    </ol>
  );
}
