import { language } from './i18n/language';
import { t } from './i18n/t';
import { daysToSend } from './model/delta';
import type { Entry, EntryTarget } from './model/journal';
import type { RouteColoring } from './model/routeLook';
import type { Folder, LngLat, Route, Trip, TripKind, TripSummary } from './model/trip';
import type { StashFile } from './model/stash';
import type { OwnPlace } from './poi/ownPlaces';
import type { Joint, Ride, Suggestion } from './recording/rides';
import { stopsInRidingOrder } from './routing/sequence';

/** Requests to the JSON API, and the one form the app posts: sign out. */

export interface Me {
  email: string;
  isAdmin: boolean;
}

/** An answer other than success, with the server's message where it gave one. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Sends a JSON body, or a form with a file in it, which the browser encodes itself; throws with the server's message for an answer other than success. */
async function send(method: string, url: string, body?: unknown, keepalive = false): Promise<Response> {
  const form = body instanceof FormData;
  const response = await fetch(url, {
    method,
    // The server answers, names and exports in the page's language.
    headers: { 'Accept-Language': language, ...(body === undefined || form ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined || form ? body : JSON.stringify(body),
    keepalive,
  });
  if (!response.ok) {
    const message = await response
      .json()
      .then((data: { error?: unknown }) => (typeof data.error === 'string' ? data.error : undefined))
      .catch(() => undefined);
    throw new ApiError(response.status, message ?? t('The server answered {status}.', { status: response.status }));
  }
  return response;
}

/** A request whose answer is JSON, or nothing. */
async function request<T>(method: string, url: string, body?: unknown, keepalive = false): Promise<T> {
  const response = await send(method, url, body, keepalive);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const fetchMe = (): Promise<Me> => request('GET', '/api/me');

export const listTrips = (): Promise<TripSummary[]> => request('GET', '/api/trips');

export const createTrip = (name: string, folderId: number | null, kind: TripKind = 'trip'): Promise<TripSummary> => request('POST', '/api/trips', { name, folderId, kind });

/** A route's line thinned to a few points, as polyline6, with the colour the route has of its own. */
export interface OutlineLine {
  line: string;
  color: string | null;
}

/** A route or a track of a day that has a name, as the search of the library finds it. */
export interface NamedRoute {
  id: string;
  name: string;
  kind: Route['kind'];
}

/** A day as the library knows it without its trip's document: what names it, how many routes, stops, recordings and media it holds, those of its routes that have a name, its length in metres, and the lines of its routes. */
export interface OutlineDay {
  id: string;
  name: string;
  date: string | null;
  routes: number;
  stops: number;
  recordings: number;
  media: number;
  namedRoutes: NamedRoute[];
  distanceM: number;
  lines: OutlineLine[];
}

/** The outlines of every trip by its id: its days in order. */
export const fetchOutlines = (): Promise<Record<string, OutlineDay[]>> => request('GET', '/api/trips/outlines');

/** Where the trips are downloaded from as a zip to keep or to import again: with their journal, recordings and a GPX file per day. */
export const tripArchiveUrl = (ids: readonly number[]): string => `/api/trips/archive?ids=${ids.join(',')}`;

/** A copy of the trip with all its days, next to it in the library; the answer is the copy's id. */
export const duplicateTrip = (id: number): Promise<{ id: number }> => request('POST', `/api/trips/${id}/copies`);

/** Puts a trip into a folder, or into none. */
export const moveTrip = (id: number, folderId: number | null): Promise<void> => request('PATCH', `/api/trips/${id}`, { folderId });

export const renameTrip = (id: number, name: string): Promise<void> => request('PATCH', `/api/trips/${id}`, { name });

export const listFolders = (): Promise<Folder[]> => request('GET', '/api/folders');

export const createFolder = (name: string, parentId: number | null): Promise<Folder> => request('POST', '/api/folders', { name, parentId });

export const renameFolder = (id: number, name: string): Promise<void> => request('PATCH', `/api/folders/${id}`, { name });

/** Puts a folder into another folder, or at the top. */
export const moveFolder = (id: number, parentId: number | null): Promise<void> => request('PATCH', `/api/folders/${id}`, { parentId });

/** Deletes the folder; what it holds moves up into its parent, or is deleted with it. */
export const deleteFolder = (id: number, contents: 'move' | 'delete'): Promise<void> => request('DELETE', `/api/folders/${id}?contents=${contents}`);

export const tripApi = (id: number): string => `/api/trips/${id}`;

/** How far a download has come: the bytes read so far, and of the whole where the server says how long it is. */
export interface Progress {
  received: number;
  total?: number;
}

/** Reads a trip, telling `onProgress` how far its document has come as it arrives. */
export async function fetchTrip(id: number, onProgress?: (progress: Progress) => void): Promise<Trip> {
  const response = await send('GET', tripApi(id));
  if (!onProgress || !response.body) return (await response.json()) as Trip;
  // The browser unpacks the answer as it reads it, so only the server's word for the unpacked length counts.
  const total = Number(response.headers.get('X-Uncompressed-Length')) || undefined;
  let received = 0;
  const counted = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      onProgress({ received, total });
      controller.enqueue(chunk);
    },
  });
  return (await new Response(response.body.pipeThrough(counted)).json()) as Trip;
}

/**
 * The read-only page reads a trip and its journal from the owner's trip API or from the
 * shared one, whichever `base` the page names.
 */
export const fetchTripAt = (base: string): Promise<Trip> => request('GET', base);

export const listEntriesAt = (base: string): Promise<Entry[]> => request('GET', `${base}/entries`);

export const entryFileUrl = (base: string, entryId: number): string => `${base}/entries/${entryId}/file`;

export const entryPreviewUrl = (base: string, entryId: number): string => `${base}/entries/${entryId}/preview`;

/** Adds a journal entry on the trip or on the part the target names, with a file where given, at a spot on the map where given; an imported one as written at `createdAt`. */
export function addEntry(tripId: number, target: EntryTarget, text: string, file: File | undefined, spot: LngLat | undefined, createdAt?: string): Promise<Entry> {
  const form = new FormData();
  form.set('text', text);
  for (const [key, value] of Object.entries(target)) form.set(key, value);
  if (file) form.set('file', file);
  if (spot) {
    form.set('lng', String(spot[0]));
    form.set('lat', String(spot[1]));
  }
  if (createdAt) form.set('createdAt', createdAt);
  return request('POST', `${tripApi(tripId)}/entries`, form);
}

export const updateEntry = (tripId: number, entryId: number, text: string): Promise<void> => request('PATCH', `${tripApi(tripId)}/entries/${entryId}`, { text });

export const deleteEntry = (tripId: number, entryId: number): Promise<void> => request('DELETE', `${tripApi(tripId)}/entries/${entryId}`);

/** The additional media of the trip's days: files and links, each an entry of the kind `media` on its day. */
export const listMedia = (tripId: number): Promise<Entry[]> => request('GET', `${tripApi(tripId)}/media`);

export const mediaFileUrl = (tripId: number, id: number): string => `${tripApi(tripId)}/media/${id}/file`;

export const mediaPreviewUrl = (tripId: number, id: number): string => `${tripApi(tripId)}/media/${id}/preview`;

/** Keeps a file or a link with a day of the trip, under a name; a file without one goes by its own. */
export function addMedia(tripId: number, dayId: string, what: File | { url: string }, name = ''): Promise<Entry> {
  const form = new FormData();
  form.set('dayId', dayId);
  form.set('name', name);
  if (what instanceof File) form.set('file', what);
  else form.set('url', what.url);
  return request('POST', `${tripApi(tripId)}/media`, form);
}

/** Names a file or a link anew, a link with its address. */
export const changeMedia = (tripId: number, id: number, name: string, url?: string): Promise<void> => request('PATCH', `${tripApi(tripId)}/media/${id}`, { name, ...(url !== undefined && { url }) });

/** Moves a file or a link to a day of the user's, in this trip or another. */
export const moveMedia = (tripId: number, id: number, dayId: string): Promise<void> => request('PATCH', `${tripApi(tripId)}/media/${id}`, { dayId });

/** A copy of a file or a link on a day of the user's, in this trip or another. */
export const copyMedia = (tripId: number, id: number, dayId: string): Promise<Entry> => request('POST', `${tripApi(tripId)}/media/${id}/copies`, { dayId });

export const deleteMedia = (tripId: number, id: number): Promise<void> => request('DELETE', `${tripApi(tripId)}/media/${id}`);

/** A place as the server keeps it: its OpenStreetMap id ("node/123"), kind, position and the tags its details are made of. */
export interface KeptPlace {
  id: string;
  kind: string;
  lngLat: LngLat;
  tags: Record<string, string>;
}

/** The places of the kinds in a tile of the web's maps at zoom 10. */
export const fetchPlaces = (x: number, y: number, kinds: readonly string[]): Promise<KeptPlace[]> => request('GET', `/api/places/${x}/${y}?kinds=${kinds.join(',')}`);

/** The places the user keeps in the lists of the folder for places. */
export const fetchOwnPlaces = (): Promise<OwnPlace[]> => request('GET', '/api/places/own');

/** What the user set for the planner as a whole; fields not set are absent. */
export interface Preferences {
  /** How far from a route a place of each kind is still shown along it, in metres, by kind. */
  placeReachM?: Record<string, number>;
  /** The width of a route's line in pixels. */
  routeWidth?: number;
  /** Whether routes without a colour of their own get one per day or one per route. */
  routeColoring?: RouteColoring;
  /** How opaque a ride is drawn in the overlay of all rides, from 0 to 1. */
  ridesOpacity?: number;
}

export const fetchPreferences = (): Promise<Preferences> => request('GET', `/api/preferences`);

export const savePreferences = (preferences: Preferences): Promise<void> => request('PUT', `/api/preferences`, preferences);

/** Every ride of the user's, by when it began, each with the days it is on. */
export const fetchRides = (): Promise<Ride[]> => request('GET', '/api/rides');

/** A ride for itself: its name, its length in metres and the time of its first point, null where its file has no times. Its GPX file is fetched apart. */
export interface KeptRide {
  id: number;
  name: string;
  distanceM: number;
  startedAt: string | null;
}

/** A ride as it is on a day. */
export interface Recording extends KeptRide {
  dayId: string;
}

/** The rides on the trip's days, once for each day a ride is on, by when they began. */
export const listRecordings = (tripId: number): Promise<Recording[]> => request('GET', `${tripApi(tripId)}/recordings`);

/**
 * Keeps a GPX file as a ride under the name, on the day where one is given. A file kept
 * already is not kept again: the answer is then the ride it is kept as, under the name
 * it has, and `added` is false.
 */
export async function keepRide(name: string, gpx: string, dayId?: string): Promise<{ ride: KeptRide; added: boolean }> {
  const form = new FormData();
  if (dayId !== undefined) form.set('dayId', dayId);
  form.set('name', name);
  form.set('file', await gzipped(gpx), 'recording.gpx.gz');
  const response = await send('POST', '/api/rides', form);
  return { ride: (await response.json()) as KeptRide, added: response.status === 201 };
}

/** A GPX file as an upload: compressed with gzip, which keeps it within a server's request limits. */
const gzipped = async (gpx: string): Promise<Blob> => new Response(new Blob([gpx]).stream().pipeThrough(new CompressionStream('gzip'))).blob();

export const listStash = (): Promise<StashFile[]> => request('GET', '/api/stash');

/**
 * Keeps a GPX file in a folder of the Stash under the name. A file kept already,
 * wherever in the Stash, is not kept again: the answer is then the file as it is kept,
 * and `added` is false.
 */
export async function keepStashFile(folderId: number, name: string, gpx: string): Promise<{ file: StashFile; added: boolean }> {
  const form = new FormData();
  form.set('folderId', String(folderId));
  form.set('name', name);
  form.set('file', await gzipped(gpx), 'file.gpx.gz');
  const response = await send('POST', '/api/stash/files', form);
  return { file: (await response.json()) as StashFile, added: response.status === 201 };
}

export const renameStashFile = (id: number, name: string): Promise<void> => request('PATCH', `/api/stash/files/${id}`, { name });

export const moveStashFile = (id: number, folderId: number): Promise<void> => request('PATCH', `/api/stash/files/${id}`, { folderId });

export const deleteStashFile = (id: number): Promise<void> => request('DELETE', `/api/stash/files/${id}`);

/** A file of the Stash as it is kept. */
export const fetchStashGpx = async (id: number): Promise<string> => (await send('GET', `/api/stash/files/${id}/gpx`)).text();

/** A day of riding that may be a day's: its date, null for a ride without times, whether that is the day's, the share of it that ran along the day's routes, or of them along it, and those of its rides that are not on the day yet. */
export interface FoundRidingDay {
  date: string | null;
  sameDate: boolean;
  share: number;
  rides: Ride[];
}

/** The days of riding that may be the day's, the likeliest first; `utcOffsetMinutes` is how far the user's clock is ahead of UTC on that day. */
export const lookUpRides = (tripId: number, dayId: string, utcOffsetMinutes: number): Promise<FoundRidingDay[]> =>
  request('GET', `${tripApi(tripId)}/recordings/lookup?day=${encodeURIComponent(dayId)}&offset=${utcOffsetMinutes}`);

/**
 * The days of the user's trips that rides on no day may be of, without what was declined,
 * in the order of the days; `utcOffsetMinutes` is how far the user's clock is ahead of
 * UTC. The server looks through the days a few seconds' worth at a time; `onProgress`
 * hears how many are done of all.
 */
export async function suggestRideDays(utcOffsetMinutes: number, onProgress: (done: number, of: number) => void): Promise<Suggestion[]> {
  const found: Suggestion[] = [];
  let part = { done: 0, of: 0 };
  do {
    const answer = await request<{ suggestions: Suggestion[]; done: number; of: number }>('GET', `/api/rides/suggestions?offset=${utcOffsetMinutes}&from=${part.done}`);
    found.push(...answer.suggestions);
    part = answer;
    onProgress(part.done, part.of);
  } while (part.done < part.of);
  return found;
}

/** Says that a ride is not of a day it was suggested for, which is remembered. */
export const declineRideDay = (id: number, dayId: string): Promise<void> => request('PUT', `/api/rides/${id}/days/${encodeURIComponent(dayId)}/declined`);

/** Where a merge would join the rides, in the order they began: one joint for each ride after the first. */
export const rideJoints = (ids: readonly number[]): Promise<Joint[]> => request('GET', `/api/rides/joints?ids=${ids.join(',')}`);

/** Merges rides that follow one another into one, which takes their place on their days; the answer is the merged ride. */
export const mergeRides = (ids: readonly number[]): Promise<Ride> => request('POST', '/api/rides/merge', { ids });

export const renameRide = (id: number, name: string): Promise<void> => request('PATCH', `/api/rides/${id}`, { name });

/** Deletes a ride with its file, from every day it is on. */
export const deleteRide = (id: number): Promise<void> => request('DELETE', `/api/rides/${id}`);

/** Puts a ride on a day, which leaves it on the days it is on. */
export const putRideOnDay = (id: number, dayId: string): Promise<void> => request('PUT', `/api/rides/${id}/days/${encodeURIComponent(dayId)}`);

/** Takes a ride off a day; it stays a ride. */
export const takeRideOffDay = (id: number, dayId: string): Promise<void> => request('DELETE', `/api/rides/${id}/days/${encodeURIComponent(dayId)}`);

/** A ride's GPX file; the browser undoes the compression it is sent with. */
export const fetchRideGpx = async (id: number): Promise<string> => (await send('GET', `/api/rides/${id}/gpx`)).text();

/** The token the trip's read-only page is public under, or null. */
export const shareToken = (tripId: number): Promise<{ token: string | null }> => request('GET', `${tripApi(tripId)}/share`);

export const shareTrip = (tripId: number): Promise<{ token: string }> => request('POST', `${tripApi(tripId)}/share`);

export const unshareTrip = (tripId: number): Promise<void> => request('DELETE', `${tripApi(tripId)}/share`);

/** The read-only page of a trip shared under a token. */
export const sharedPageUrl = (token: string): string => `${location.origin}/t/${token}`;

/**
 * Saves the trip as the server keeps it, each day's stops in riding order; the answer is
 * its new version. Given the trip as the server has it, `saved`, the days and routes
 * untouched since go as their ids alone.
 */
export async function saveTrip(trip: Trip, saved?: Trip, keepalive = false): Promise<number> {
  const days = daysToSend(trip.days, saved, stopsInRidingOrder);
  const { version } = await request<{ version: number }>('PUT', `/api/trips/${trip.id}`, { ...trip, days }, keepalive);
  return version;
}

/** Reads the trip, changes it with `change` and saves what that changed; the answer is its new version. */
export async function changeTrip(id: number, change: (trip: Trip) => Trip): Promise<number> {
  const loaded = await fetchTrip(id);
  return saveTrip(change(loaded), loaded);
}

export const deleteTrip = (id: number): Promise<void> => request('DELETE', `/api/trips/${id}`);

/** Merges the trips into the trip `intoId` and deletes them; see the API's merge. */
export const mergeTrips = (intoId: number, tripIds: number[]): Promise<{ version: number }> => request('POST', `/api/trips/${intoId}/merge`, { tripIds });

/** A route of the library as the duplicates report names it: where it is, and what it is. */
export interface DuplicateRoute {
  tripId: number;
  tripName: string;
  tripKind: TripKind;
  dayId: string;
  dayIndex: number;
  dayName: string;
  date: string | null;
  routeId: string;
  routeName: string;
  distanceM: number;
}

/** Routes kept more than once: exact copies, or the same ride kept from two sources on one day. */
export interface DuplicateGroup {
  kind: 'copies' | 'same ride';
  routes: DuplicateRoute[];
}

export const listDuplicates = (): Promise<DuplicateGroup[]> => request('GET', '/api/duplicates');

/** The lines of routes of the library, as polyline6 by the route's id; a route that is gone is left out. */
export const duplicateLines = (routeIds: readonly string[]): Promise<Record<string, string>> => request('GET', `/api/duplicates/lines?routes=${routeIds.map(encodeURIComponent).join(',')}`);

/** How a trip is written as GPX; the server's ExportOptions, with the packaging. */
export interface ExportOptions {
  /** One file for the whole scope, or one file per day in a zip. */
  per: 'trip' | 'day';
  /** Routes as tracks with their full line, or as routes of their points for the device to route between. */
  form: 'tracks' | 'routes';
  /** Whether optional routes and stops are written. */
  optional: boolean;
  /** How far from a route a free stop may stand to be written, in metres. */
  reachM: number;
}

export const DEFAULT_EXPORT: ExportOptions = { per: 'trip', form: 'tracks', optional: true, reachM: 2000 };

/** The GPX download of a trip as the options say, or of the days or routes of it named in `of`. */
export function gpxUrl(tripId: number, options: ExportOptions, of?: { kind: 'day' | 'route'; ids: readonly string[] }): string {
  const query = new URLSearchParams({ per: options.per, form: options.form, optional: options.optional ? '1' : '0', reachM: String(options.reachM), lang: language });
  if (of) query.set(of.kind === 'day' ? 'days' : 'routes', of.ids.join(','));
  return `/api/trips/${tripId}/gpx?${query}`;
}

/** A named set of export options kept with the account. */
export interface ExportPreset {
  id: number;
  name: string;
  options: ExportOptions;
}

export const listExportPresets = (): Promise<ExportPreset[]> => request('GET', '/api/export-presets');

/** Keeps the options under the name, replacing a preset of that name. */
export const saveExportPreset = (name: string, options: ExportOptions): Promise<ExportPreset> => request('POST', '/api/export-presets', { name, options });

export const deleteExportPreset = (id: number): Promise<void> => request('DELETE', `/api/export-presets/${id}`);

/** What an error says, for the user. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const meta = (name: string): string => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';

/** The CSRF token the page carries, as the hidden fields a form needs. */
export function csrfFields(): [name: string, value: string][] {
  return [
    [meta('csrf-name-key'), meta('csrf-name')],
    [meta('csrf-value-key'), meta('csrf-value')],
  ];
}

/** Signs out by posting the logout form, which ends in a redirect to the landing page. */
export function logout(): void {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = '/logout';
  for (const [name, value] of csrfFields()) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
