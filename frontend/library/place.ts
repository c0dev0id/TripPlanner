import type { Day, Folder, Trip } from '../model/trip';
import { folderNames } from './folders';

/** Where the explorer is: a folder, none for the top, or its duplicates report; perhaps an open trip in it; perhaps the trip's opened day. */
export interface Place {
  folderId: number | null;
  duplicates: boolean;
  trip?: Trip;
  day?: { day: Day; index: number };
}

/** The explorer's own name, its heading at the top of the library. */
export const EXPLORER = 'Trip Explorer';

/** The top of the library as a place to go back to. */
export const ALL_TRIPS = 'All trips';

/** The names of the places from the top of the library down to this one; none at the top. */
export function pathOf(place: Place, folders: readonly Folder[]): string[] {
  const names = folderNames(folders, place.folderId);
  if (place.duplicates) names.push('Duplicates');
  if (place.trip) names.push(place.trip.name);
  if (place.trip && place.day) names.push(place.trip.kind === 'collection' ? place.day.day.name || 'Section' : `Day ${place.day.index + 1}`);
  return names;
}

/** The name of the place one level up, from the path down to here; the top for a place right under it. */
export const upName = (path: readonly string[]): string => path.at(-2) ?? ALL_TRIPS;
