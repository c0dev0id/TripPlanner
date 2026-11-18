/**
 * Where the names of places on a map are set: each a little off its place, on the side
 * that has room, with a line to it, so that names do not lie on each other or on the
 * places. Pure reckoning in the pixels of the map's box.
 */

/** A place to name: where its foot is on the map, and how large its name is set. */
export interface Named {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A name set: its box, and the line from its place's head to the box. */
export interface Callout {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  line: { x1: number; y1: number; x2: number; y2: number };
}

/** How high a place's pin stands over its foot, how wide it is, and how far its head is from the foot. */
const PIN = { height: 38, half: 14, head: 24 };
/** How far a name stands from its place's head, nearer first, and how far names keep from each other and from the edge. */
const REACHES = [34, 64];
const GAP = 6;
/** The sides a name is tried on, in turn: up and to the right first, under the place last. */
const SIDES: readonly (readonly [number, number])[] = [[0.75, -0.66], [-0.75, -0.66], [1, 0], [-1, 0], [0, -1], [0.75, 0.66], [-0.75, 0.66], [0, 1]];

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
const meet = (a: Rect, b: Rect, by = 0): boolean => a.left < b.right + by && a.right > b.left - by && a.top < b.bottom + by && a.bottom > b.top - by;
const pinOf = (place: Named): Rect => ({ left: place.x - PIN.half, right: place.x + PIN.half, top: place.y - PIN.height, bottom: place.y + 2 });

/**
 * Sets the names of the places that are in the box, in their order and at most `most`:
 * each on the first side where it lies within the box and on no name set before and
 * on no place, nor on what is `taken` of the box already. A place without such a side is
 * left without its name.
 */
export function placeCallouts(places: readonly Named[], box: { width: number; height: number }, most: number, taken: readonly Rect[] = []): Callout[] {
  const within = places.filter((place) => place.x >= 0 && place.x <= box.width && place.y >= 0 && place.y <= box.height);
  const pins = within.map(pinOf);
  const set: Callout[] = [];
  for (const place of within) {
    if (set.length === most) break;
    const head = { x: place.x, y: place.y - PIN.head };
    for (const [reach, [ux, uy]] of REACHES.flatMap((r) => SIDES.map((side) => [r, side] as const))) {
      const left = head.x + ux * (reach + place.width / 2) - place.width / 2;
      const top = head.y + uy * (reach + place.height / 2) - place.height / 2;
      const rect = { left, top, right: left + place.width, bottom: top + place.height };
      if (rect.left < GAP || rect.top < GAP || rect.right > box.width - GAP || rect.bottom > box.height - GAP) continue;
      if (set.some((other) => meet(rect, { left: other.left, top: other.top, right: other.left + other.width, bottom: other.top + other.height }, GAP)) || pins.some((pin) => meet(rect, pin, 2)) || taken.some((other) => meet(rect, other, GAP))) continue;
      // The line starts at the rim of the pin's head and ends at the nearest point of the name's box.
      const to = { x: Math.min(Math.max(head.x, rect.left), rect.right), y: Math.min(Math.max(head.y, rect.top), rect.bottom) };
      const far = Math.hypot(to.x - head.x, to.y - head.y) || 1;
      set.push({ id: place.id, left, top, width: place.width, height: place.height, line: { x1: head.x + ((to.x - head.x) / far) * 11, y1: head.y + ((to.y - head.y) / far) * 11, x2: to.x, y2: to.y } });
      break;
    }
  }
  return set;
}
