import { createSignal } from 'solid-js';
import type { Day, Route, Stop } from '../model/trip';
import { copiedRoute } from '../routing/dayEdit';
import type { MenuItem } from '../ui/menu';
import { pasteRoute, pasteStop, selectDay } from './trip';

/** What was copied to be pasted into a day: what it is, its name, and how it is pasted. Kept while the app runs, from one trip to another. */
interface Clip {
  what: 'route' | 'stop';
  name: string;
  paste: (dayId: string) => void;
}

const [clip, setClip] = createSignal<Clip>();

/** Copies a route of the day, with the stops bound to it. */
export function copyRoute(day: Day, route: Route): void {
  const copied = copiedRoute(day, route);
  setClip({ what: 'route', name: route.name, paste: (dayId) => pasteRoute(dayId, copied) });
}

export function copyStop(stop: Stop): void {
  setClip({ what: 'stop', name: stop.name, paste: (dayId) => pasteStop(dayId, stop) });
}

/** The menu item that pastes what was copied into the day and shows the day; none while nothing is copied. */
export function pasteItem(dayId: string): MenuItem[] {
  const copied = clip();
  if (!copied) return [];
  const paste = () => {
    copied.paste(dayId);
    selectDay(dayId);
  };
  return [{ label: copied.name ? `Paste ${copied.what} “${copied.name}”` : `Paste ${copied.what}`, run: paste }];
}
