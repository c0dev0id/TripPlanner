import { createSignal, Show } from 'solid-js';
import type { Day } from '../model/trip';
import { dayColor } from '../model/routeLook';
import { routeColoring } from '../state/preferences';
import { PlaceKindMark } from '../map/PlaceKinds';
import { routesDistance } from '../routing/legs';
import { isPlaceList } from '../state/library';
import { mediaOf } from '../state/media';
import { foldPanel } from '../state/panel';
import { recordingsOf } from '../state/recordings';
import { openTrip, openTripId, selectDay, selectedDayId } from '../state/trip';
import { ForById } from '../ui/ForById';
import { dayDetail, dayHeading, dayHolds, dayTitleOf } from './labels';

/**
 * The open trip's days in the strip the library folds away to: a numbered button each, in
 * the colour its routes have where the days are coloured apart; of a list of places, its
 * kinds, each by its mark. A click shows the day or kind, or closes it where it is shown
 * already, which leaves the library folded away. The button under the mouse says at once
 * what is behind it (`DayTip`).
 */
export function DayStrip() {
  /** Closes the day shown and leaves the library folded away, as it is asked for here: the pane's own button brings the library back. */
  const closeDay = () => {
    foldPanel(true);
    selectDay(undefined);
  };
  /** The day whose button the mouse is on, and where its card stands: beside the button, at its middle. */
  const [hovered, setHovered] = createSignal<{ id: string; top: number; left: number }>();
  const hover = (id: string) => (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHovered({ id, top: box.top + box.height / 2, left: box.right + 10 });
  };
  const hoveredDay = () => openTrip()!.days.find((day) => day.id === hovered()?.id);
  return (
    <>
      <ol class="day-strip" onScroll={() => setHovered(undefined)}>
        <ForById each={openTrip()!.days}>
          {(day, index) => {
            const shown = () => selectedDayId() === day().id;
            const places = () => isPlaceList(openTripId());
            const color = () => (places() ? undefined : dayColor(index(), routeColoring()));
            const label = () => dayTitleOf(openTrip()!, day());
            return (
              <li>
                <button
                  class="day-chip"
                  classList={{ colored: color() !== undefined }}
                  style={{ background: color() }}
                  aria-label={label()}
                  aria-pressed={shown()}
                  onPointerEnter={hover(day().id)}
                  onPointerLeave={() => setHovered(undefined)}
                  onClick={() => {
                    // The pane that opens says the same, where the card would lie on it.
                    setHovered(undefined);
                    if (shown()) closeDay();
                    else selectDay(day().id);
                  }}
                >
                  <Show when={places()} fallback={index() + 1}>
                    <PlaceKindMark id={day().id} />
                  </Show>
                </button>
              </li>
            );
          }}
        </ForById>
      </ol>
      <Show when={hoveredDay()}>{(day) => <DayTip day={day()} top={hovered()!.top} left={hovered()!.left} />}</Show>
    </>
  );
}

/** What the strip says of the day under the mouse: its heading, its date and length, and what it holds; of a list's kind, its name and its places. */
function DayTip(props: { day: Day; top: number; left: number }) {
  const trip = () => openTrip()!;
  const holds = () => ({ date: props.day.date, routes: props.day.routes.length, stops: props.day.stops.length, recordings: recordingsOf(props.day.id).length, media: mediaOf(props.day.id).length, distanceM: routesDistance(props.day.routes) });
  return (
    // Kept on the page where the button stands near its top or bottom.
    <div class="strip-tip" style={{ top: `clamp(40px, ${props.top}px, 100dvh - 40px)`, left: `${props.left}px` }}>
      <span class="name">{dayHeading(trip().kind, trip().days.indexOf(props.day), props.day.name)}</span>
      <span class="muted">{dayDetail(trip().kind, holds(), isPlaceList(openTripId()))}</span>
      <Show when={trip().kind === 'trip'}>
        <span class="muted">{dayHolds(holds(), 'stop')}</span>
      </Show>
    </div>
  );
}
