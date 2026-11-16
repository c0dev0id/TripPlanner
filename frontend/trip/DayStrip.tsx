import { Show } from 'solid-js';
import { dayColor } from '../model/routeLook';
import { routeColoring } from '../state/preferences';
import { PlaceKindMark } from '../map/PlaceKinds';
import { isPlaceList } from '../state/library';
import { openTrip, openTripId, selectDay, selectedDayId } from '../state/trip';
import { ForById } from '../ui/ForById';
import { dayTitleOf } from './labels';

/**
 * The open trip's days in the strip the library folds away to: a numbered button each, in
 * the colour its routes have where the days are coloured apart; of a list of places, its
 * kinds, each by its mark. A click shows the day or kind, or closes it where it is shown
 * already.
 */
export function DayStrip() {
  return (
    <ol class="day-strip">
      <ForById each={openTrip()!.days}>
        {(day, index) => {
          const shown = () => selectedDayId() === day().id;
          const places = () => isPlaceList(openTripId());
          const color = () => (places() ? undefined : dayColor(index(), routeColoring()));
          const label = () => dayTitleOf(openTrip()!, day());
          return (
            <li>
              <button class="day-chip" classList={{ colored: color() !== undefined }} style={{ background: color() }} title={label()} aria-label={label()} aria-pressed={shown()} onClick={() => selectDay(shown() ? undefined : day().id)}>
                <Show when={places()} fallback={index() + 1}>
                  <PlaceKindMark id={day().id} />
                </Show>
              </button>
            </li>
          );
        }}
      </ForById>
    </ol>
  );
}
