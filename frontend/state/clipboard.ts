import { createSignal } from 'solid-js';
import type { Day, Route, Stop } from '../model/trip';
import { copiedRoute, type CopiedRoute } from '../routing/dayEdit';
import type { MenuItem } from '../ui/menu';
import { pasteRoutes, pasteStop, selectDay } from './trip';

/** What was copied to be pasted: routes with the stops bound to them, or a stop. Kept while the app runs, from one trip to another. */
type Clip = { routes: CopiedRoute[] } | { stop: Stop };

const [clip, setClip] = createSignal<Clip>();

/** Copies routes with the stops bound to them. */
export function copyRoutes(routes: CopiedRoute[]): void {
  setClip({ routes });
}

/** Copies a route of the day, with the stops bound to it. */
export function copyRoute(day: Day, route: Route): void {
  copyRoutes([copiedRoute(day, route)]);
}

export function copyStop(stop: Stop): void {
  setClip({ stop });
}

/** What a paste menu item says it pastes: Paste route “Loop”, Paste 3 routes, Paste stop “Café”. */
function pasteLabel(copied: Clip): string {
  if ('stop' in copied) return copied.stop.name ? `Paste stop “${copied.stop.name}”` : 'Paste stop';
  const [first, ...more] = copied.routes;
  if (more.length > 0) return `Paste ${copied.routes.length} routes`;
  return first?.route.name ? `Paste route “${first.route.name}”` : 'Paste route';
}

/** The menu item that pastes what was copied into the day of the open trip and shows the day; none while nothing is copied. */
export function pasteItem(dayId: string): MenuItem[] {
  const copied = clip();
  if (!copied) return [];
  const paste = () => {
    if ('stop' in copied) pasteStop(dayId, copied.stop);
    else pasteRoutes(dayId, copied.routes);
    selectDay(dayId);
  };
  return [{ label: pasteLabel(copied), run: paste }];
}

/** The menu item that hands the copied routes to `paste`, which puts them into a trip or a folder of the library; none while no route is copied. */
export function routesPasteItem(paste: (routes: CopiedRoute[]) => void): MenuItem[] {
  const copied = clip();
  return copied && 'routes' in copied ? [{ label: pasteLabel(copied), run: () => paste(copied.routes) }] : [];
}
