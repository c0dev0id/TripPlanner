import { distanceBetween, planeAt } from '../geo/measure';
import { routeLine } from '../routing/legs';
import type { Day, LngLat } from './trip';

/**
 * What the card of a shared trip is made of: the picture a link to the trip's page is
 * shown with where it is posted. The lines of the routes the page shows, how the map is
 * turned to fit them, the places the days begin and end at, and a mark of all of it.
 */

/** The card's size in pixels, as the places a link is posted at ask for. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
/** How far the card's map is tilted, in degrees. */
export const CARD_PITCH = 45;

/** The lines of each day's routes that the trip's page shows; days without one are left out. */
export function cardDays(of: readonly Day[], hiddenRouteIds: readonly string[]): LngLat[][][] {
  const days = of.map((day) => day.routes.filter((route) => !hiddenRouteIds.includes(route.id)).map(routeLine));
  return days.map((lines) => lines.filter((line) => line.length > 1)).filter((lines) => lines.length > 0);
}

/** Where each day begins and ends, in the order of riding. */
export const dayEnds = (days: readonly LngLat[][][]): LngLat[] => days.flatMap((lines) => [lines[0]![0]!, lines.at(-1)!.at(-1)!]);

/** How close two ends of days are to be the same place, in metres. */
const SAME_PLACE = 3000;

/**
 * The places the days begin and end at, each named once while the trip stays there: a
 * day that ends where it began, and a day that begins where the one before ended, add
 * nothing. An end close to one named before is not asked for again.
 */
export async function destinationsOf(ends: readonly LngLat[], nameAt: (at: LngLat) => Promise<string | undefined>): Promise<string[]> {
  const known: { at: LngLat; name: string | undefined }[] = [];
  const names: string[] = [];
  for (const at of ends) {
    const near = known.find((place) => distanceBetween(place.at, at) < SAME_PLACE);
    const name = near ? near.name : await nameAt(at);
    if (!near) known.push({ at, name });
    if (name !== undefined && name !== names.at(-1)) names.push(name);
  }
  return names;
}

/** The bearings tried: north up first, then every fifth degree to either side by turns, so that of two that fill the picture alike the one nearer to north up is taken. */
const BEARINGS = [0, ...Array.from({ length: 17 }, (_, i) => [(i + 1) * 5, -(i + 1) * 5]).flat(), 90];

/**
 * The bearing at which lines fill a tilted picture of the given shape best: the turn of
 * the map, in degrees and between north-west and north-east of east and west, at which
 * the lines' extent is nearest to the picture's shape, the height counted as the tilt
 * shortens it.
 */
export function bestBearing(lines: readonly (readonly LngLat[])[], aspect: number, pitch: number): number {
  const points = lines.flat();
  const plane = planeAt(points[0]!);
  const flat = points.map(plane);
  const shortened = Math.cos((pitch * Math.PI) / 180);
  let best = { bearing: 0, scale: 0 };
  for (const bearing of BEARINGS) {
    const turn = (bearing * Math.PI) / 180;
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    let [left, right, bottom, top] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of flat) {
      const [across, up] = [x * cos - y * sin, x * sin + y * cos];
      [left, right, bottom, top] = [Math.min(left, across), Math.max(right, across), Math.min(bottom, up), Math.max(top, up)];
    }
    const scale = Math.min(aspect / Math.max(right - left, 1), 1 / Math.max((top - bottom) * shortened, 1));
    if (scale > best.scale * 1.02) best = { bearing, scale };
  }
  return best.bearing;
}

/** The look of the card, counted up when it changes, so that the cards made before are made anew. */
const LOOK = 1;

/** A mark of what a card shows: another one once the trip's name or a line on it is another. */
export function cardMark(name: string, days: readonly LngLat[][][]): string {
  let hash = 0x811c9dc5;
  const add = (value: number) => {
    hash = Math.imul(hash ^ value, 0x01000193);
  };
  for (const char of `${LOOK}\n${name}`) add(char.codePointAt(0)!);
  for (const lines of days) {
    add(lines.length);
    for (const line of lines) {
      add(line.length);
      for (const [lng, lat] of line) {
        add(Math.round(lng * 1e5));
        add(Math.round(lat * 1e5));
      }
    }
  }
  return (hash >>> 0).toString(36);
}
