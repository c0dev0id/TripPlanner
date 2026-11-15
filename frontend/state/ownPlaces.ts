import { createMemo, createResource, createRoot } from 'solid-js';
import { fetchOwnPlaces } from '../api';
import { newId } from '../model/trip';
import { type OwnPlace, ownKindsOf } from '../poi/ownPlaces';
import { newStop } from '../routing/dayEdit';
import { kindAround } from '../library/folders';
import { placesNear } from '../poi/near';
import { libraryFolders, libraryTab, libraryTrips, tripShown } from './library';
import { anyOwnKindShown, dayRouteLines, placeMode } from './places';
import { placeReachM } from './preferences';
import { addParts, openTripId } from './trip';

/**
 * The user's own places on the map, each kind a section of a list in the folder for
 * places: of each kind all, those along the selected day's routes or none, as its mode
 * says.
 */

const own = createRoot(() => {
  /** Whether the places are wanted: for the kinds the Places tab shows, or for the map. */
  const wanted = createMemo(() => libraryTab() === 'places' || anyOwnKindShown());
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
  const shown = createMemo(() => {
    const colors = new Map(ownKindsOf(all()).map((kind) => [kind.dayId, kind.color]));
    // The open list's places are on the map as its stops already, while its tab is the one the map follows.
    const others = all().filter((place) => place.tripId !== openTripId() || !tripShown());
    const along = placesNear(others.filter((place) => placeMode(place.dayId) === 'along'), dayRouteLines(), (place) => placeReachM(place.dayId));
    return [...others.filter((place) => placeMode(place.dayId) === 'all'), ...along].map((place) => ({ place, color: colors.get(place.dayId)! }));
  });
  return { all, shown };
});

/** The kinds of the user's own places, by list. */
export const ownKinds = createRoot(() => createMemo(() => ownKindsOf(own.all())));

/** The own places the map shows, each with its kind's colour. */
export const ownPlacesOnMap = own.shown;

export const ownPlaceById = (id: string): OwnPlace | undefined => own.all().find((place) => place.id === id);


/** Adds a copy of the place to the selected day as a free stop: what the place says goes with it, and stays as it is when the place changes. */
export function addOwnPlaceAsStop(place: OwnPlace): void {
  const { name, symbol, lngLat, address, contact, website, notes } = place;
  addParts({ routes: [], stops: [{ ...newStop(newId(), name, lngLat, null), symbol, address, contact, website, notes }] });
}
