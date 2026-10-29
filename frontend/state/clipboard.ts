import { createSignal } from 'solid-js';
import type { Stop } from '../model/trip';
import { copiedRoute, type CopiedRoute } from '../routing/dayEdit';
import type { MenuItem } from '../ui/menu';
import { openTrip, pasteRoute, pasteStop, selectDay } from './trip';

/** What was copied to be pasted into a day: a route with its bound stops, or a stop. Kept while the app runs, from one trip to another. */
type Clip = { kind: 'route'; copied: CopiedRoute } | { kind: 'stop'; stop: Stop };

const [clip, setClip] = createSignal<Clip>();

/** Copies a route of the open trip, with the stops bound to it. */
export function copyRoute(routeId: string): void {
  const copied = copiedRoute(openTrip()!, routeId);
  if (copied) setClip({ kind: 'route', copied });
}

/** Copies a stop of the open trip. */
export function copyStop(stopId: string): void {
  const stop = openTrip()!.days.flatMap((d) => d.stops).find((s) => s.id === stopId);
  if (stop) setClip({ kind: 'stop', stop });
}

/** The menu item that pastes what was copied into the day and shows the day; none while nothing is copied. */
export function pasteItem(dayId: string): MenuItem[] {
  const copied = clip();
  if (!copied) return [];
  const paste = () => {
    if (copied.kind === 'route') pasteRoute(dayId, copied.copied);
    else pasteStop(dayId, copied.stop);
    selectDay(dayId);
  };
  const name = copied.kind === 'route' ? copied.copied.route.name : copied.stop.name;
  const what = copied.kind === 'route' ? 'route' : 'stop';
  return [{ label: name ? `Paste ${what} “${name}”` : `Paste ${what}`, run: paste }];
}
