import type { LngLat } from '../model/trip';
import { ROUTE_PALETTE } from '../model/routeLook';

/** A place of the user's own: what a stop says of itself, with the list it is kept in and, as its kind, the section of that list. */
export interface OwnPlace {
  id: string;
  name: string;
  symbol: string | null;
  lngLat: LngLat;
  address: string;
  contact: string;
  website: string;
  notes: string;
  tripId: number;
  list: string;
  dayId: string;
  kind: string;
}

/** A kind of own places: a section of a list, with its list's name, its own, how many places it holds and the colour they are drawn in. */
export interface OwnKind {
  dayId: string;
  list: string;
  name: string;
  count: number;
  color: string;
}

/** The kinds in the order the places come in, each with the palette's next colour. */
export function ownKindsOf(places: readonly OwnPlace[]): OwnKind[] {
  const found = new Map<string, OwnKind>();
  for (const place of places) {
    const kind = found.get(place.dayId) ?? { dayId: place.dayId, list: place.list, name: place.kind, count: 0, color: ROUTE_PALETTE[found.size % ROUTE_PALETTE.length]!.color };
    found.set(place.dayId, { ...kind, count: kind.count + 1 });
  }
  return [...found.values()];
}
