import { Show } from 'solid-js';
import type { Day } from '../model/trip';
import { dayLinePath } from './dayLine';

/** A day's routes as a small drawing of their shape. */
export function DayLine(props: { day: Day; width: number; height: number }) {
  const path = () => dayLinePath(props.day, props.width - 6, props.height - 6);
  return (
    <Show when={path()}>
      <svg class="day-line" width={props.width} height={props.height} viewBox={`-3 -3 ${props.width} ${props.height}`} fill="none" aria-hidden="true">
        <path d={path()} />
      </svg>
    </Show>
  );
}
