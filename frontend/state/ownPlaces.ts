import { createMemo, createResource, createRoot, createSignal } from 'solid-js';
import { fetchOwnPlaces } from '../api';
import { newId } from '../model/trip';
import { type OwnKind, type OwnPlace, ownKindsOf } from '../poi/ownPlaces';
import { newStop } from '../routing/dayEdit';
import { readPreference, writePreference } from '../ui/preferences';
import { kindAround } from '../library/folders';
import { libraryFolders, libraryTrips } from './library';
import { placesListOpen } from './places';
import { addParts, openTripId } from './trip';

/**
 * The user's own places on the map: those of the kinds switched on, each kind a section of
 * a list in the folder for places. Which kinds are on is kept for this browser.
 */

const [shownIds, setShownIds] = createSignal<readonly string[]>((readPreference('ownPlaceKinds') ?? '').split(',').filter(Boolean));

const own = createRoot(() => {
  /** Whether the places are wanted: for the list of kinds, or for the map. */
  const wanted = createMemo(() => placesListOpen() || shownIds().length > 0);
  /** The lists of places as the library lists them, each with when it last changed; empty without any. */
  const lists = createMemo(() => {
    const folders = libraryFolders.error ? [] : (libraryFolders() ?? []);
    const trips = libraryTrips.error ? [] : (libraryTrips() ?? []);
    return trips.flatMap((trip) => (kindAround(folders, trip.folderId) === 'places' ? `${trip.id}:${trip.updatedAt}` : [])).join(',');
  });
  // Read when a list is new, gone or changed, and not for what else the library lists afresh.
  const [places] = createResource(
    () => wanted() && lists(),
    () => fetchOwnPlaces(),
  );
  const all = createMemo((): OwnPlace[] => (lists() && !places.error ? (places.latest ?? []) : []));
  const kinds = createMemo(() => ownKindsOf(all()));
  const shown = createMemo(() => {
    const colors = new Map(kinds().filter((kind) => shownIds().includes(kind.dayId)).map((kind) => [kind.dayId, kind.color]));
    // The open list's places are on the map as its stops already.
    return all().flatMap((place) => (colors.has(place.dayId) && place.tripId !== openTripId() ? [{ place, color: colors.get(place.dayId)! }] : []));
  });
  return { all, kinds, shown };
});

/** The kinds of the user's own places, by list. */
export const ownKinds = own.kinds;

/** The own places the map shows, each with its kind's colour. */
export const ownPlacesOnMap = own.shown;

export const ownPlaceById = (id: string): OwnPlace | undefined => own.all().find((place) => place.id === id);

export const isOwnKindShown = (kind: OwnKind): boolean => shownIds().includes(kind.dayId);

export function toggleOwnKind(kind: OwnKind): void {
  const ids = isOwnKindShown(kind) ? shownIds().filter((id) => id !== kind.dayId) : [...shownIds(), kind.dayId];
  setShownIds(ids);
  writePreference('ownPlaceKinds', ids.length > 0 ? ids.join(',') : undefined);
}

/** Adds a copy of the place to the selected day as a free stop: what the place says goes with it, and stays as it is when the place changes. */
export function addOwnPlaceAsStop(place: OwnPlace): void {
  const { name, symbol, lngLat, address, contact, website, notes } = place;
  addParts({ routes: [], stops: [{ ...newStop(newId(), name, lngLat, null), symbol, address, contact, website, notes }] });
}
