import { createMemo, createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Day } from '../model/trip';
import { dayColor } from '../model/routeLook';
import { routeColoring } from '../state/preferences';
import { PlaceKindMark } from '../map/PlaceKinds';
import { dropsOnPart } from '../state/clipboard';
import { isPlaceList } from '../state/library';
import { openRouteColors } from '../state/routeColors';
import { showDayWhole } from '../state/recordingView';
import { isRouteActive, openTrip, openTripId, selectedDayId, takeUpRouteOf } from '../state/trip';
import { ForById } from '../ui/ForById';
import { dayCounts } from './DayPane';
import { dayDetail, dayHeading, dayHolds, dayTitleOf, routeLabel } from './labels';

/**
 * The open trip's days in the strip their pane folds to: a numbered button each, in
 * the colour its routes have where the days are coloured apart; of a list of places, its
 * kinds, each by its mark. A click shows the day or kind whole, as a click on its row
 * does. The button under the mouse says at once
 * what is behind it (`DayTip`).
 */
export function DayStrip() {
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
                  ref={(el) => dropsOnPart(el, 'day', () => day().id)}
                  class="day-chip"
                  classList={{ colored: color() !== undefined }}
                  style={{ background: color() }}
                  aria-label={label()}
                  aria-pressed={shown()}
                  onPointerEnter={hover(day().id)}
                  onPointerLeave={() => setHovered(undefined)}
                  onClick={() => {
                    setHovered(undefined);
                    showDayWhole(day().id);
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

/**
 * A day's routes and tracks in the strip the pane of its contents folds to: a numbered
 * button each, in the route's colour. A click takes the route up, as a click on its row
 * does.
 */
export function RouteStrip(props: { day: Day }) {
  return (
    <ol class="day-strip">
      <ForById each={props.day.routes}>
        {(route, index) => {
          const label = () => routeLabel(route(), props.day);
          return (
            <li>
              <button
                class="day-chip colored"
                style={{ background: openRouteColors().get(route().id) }}
                title={label()}
                aria-label={label()}
                aria-pressed={isRouteActive(route().id)}
                onClick={() => takeUpRouteOf(props.day.id, route().id)}
              >
                {index() + 1}
              </button>
            </li>
          );
        }}
      </ForById>
    </ol>
  );
}

/** What the strip says of the day under the mouse: its heading, its date and length, and what it holds; of a list's kind, its name and its places. */
function DayTip(props: { day: Day; top: number; left: number }) {
  const trip = () => openTrip()!;
  const counts = createMemo(() => dayCounts(props.day));
  return (
    // Outside the panel, which hides and clips what is in it while folded; kept on the page where the button stands near its top or bottom.
    <Portal>
      <div class="strip-tip" style={{ top: `clamp(40px, ${props.top}px, 100dvh - 40px)`, left: `${props.left}px` }}>
        <span class="name">{dayHeading(trip().kind, trip().days.indexOf(props.day), props.day.name)}</span>
        <span class="muted">{dayDetail(trip().kind, counts(), isPlaceList(openTripId()))}</span>
        <Show when={trip().kind === 'trip'}>
          <span class="muted">{dayHolds(counts(), 'stop')}</span>
        </Show>
      </div>
    </Portal>
  );
}
