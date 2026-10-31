import type { Entry, EntryTarget } from './model/journal';
import type { Folder, LngLat, Trip, TripKind, TripSummary } from './model/trip';
import { withStopsInRidingOrder } from './routing/sequence';

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

/** A JSON body, or a form with a file in it, which the browser encodes itself. */
async function request<T>(method: string, url: string, body?: unknown, keepalive = false): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(url, {
    method,
    headers: body === undefined || form ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined || form ? body : JSON.stringify(body),
    keepalive,
  });
  if (!response.ok) {
    const message = await response
      .json()
      .then((data: { error?: unknown }) => (typeof data.error === 'string' ? data.error : undefined))
      .catch(() => undefined);
    throw new ApiError(response.status, message ?? `The server answered ${response.status}.`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const fetchMe = (): Promise<Me> => request('GET', '/api/me');

export const listTrips = (): Promise<TripSummary[]> => request('GET', '/api/trips');

export const createTrip = (name: string, folderId: number | null, kind: TripKind = 'trip'): Promise<TripSummary> => request('POST', '/api/trips', { name, folderId, kind });

/** A copy of the trip with all its days, next to it in the library; the answer is the copy's id. */
export const duplicateTrip = (id: number): Promise<{ id: number }> => request('POST', `/api/trips/${id}/copies`);

/** Puts a trip into a folder, or into none. */
export const moveTrip = (id: number, folderId: number | null): Promise<void> => request('PATCH', `/api/trips/${id}`, { folderId });

export const renameTrip = (id: number, name: string): Promise<void> => request('PATCH', `/api/trips/${id}`, { name });

export const listFolders = (): Promise<Folder[]> => request('GET', '/api/folders');

export const createFolder = (name: string, parentId: number | null): Promise<Folder> => request('POST', '/api/folders', { name, parentId });

export const renameFolder = (id: number, name: string): Promise<void> => request('PATCH', `/api/folders/${id}`, { name });

/** Deletes the folder; what it holds moves up into its parent, or is deleted with it. */
export const deleteFolder = (id: number, contents: 'move' | 'delete'): Promise<void> => request('DELETE', `/api/folders/${id}?contents=${contents}`);

export const tripApi = (id: number): string => `/api/trips/${id}`;

export const fetchTrip = (id: number): Promise<Trip> => fetchTripAt(tripApi(id));

/**
 * The read-only page reads a trip and its journal from the owner's trip API or from the
 * shared one, whichever `base` the page names.
 */
export const fetchTripAt = (base: string): Promise<Trip> => request('GET', base);

export const listEntriesAt = (base: string): Promise<Entry[]> => request('GET', `${base}/entries`);

export const entryFileUrl = (base: string, entryId: number): string => `${base}/entries/${entryId}/file`;

export const entryPreviewUrl = (base: string, entryId: number): string => `${base}/entries/${entryId}/preview`;

/** Adds a journal entry on the trip or on the part the target names, with a file where given, at a spot on the map where given. */
export function addEntry(tripId: number, target: EntryTarget, text: string, file: File | undefined, spot: LngLat | undefined): Promise<Entry> {
  const form = new FormData();
  form.set('text', text);
  for (const [key, value] of Object.entries(target)) form.set(key, value);
  if (file) form.set('file', file);
  if (spot) {
    form.set('lng', String(spot[0]));
    form.set('lat', String(spot[1]));
  }
  return request('POST', `${tripApi(tripId)}/entries`, form);
}

export const updateEntry = (tripId: number, entryId: number, text: string): Promise<void> => request('PATCH', `${tripApi(tripId)}/entries/${entryId}`, { text });

export const deleteEntry = (tripId: number, entryId: number): Promise<void> => request('DELETE', `${tripApi(tripId)}/entries/${entryId}`);

/** A ride as recorded, kept on a day; its GPX file is fetched apart. */
export interface Recording {
  id: number;
  dayId: string;
  name: string;
}

export const listRecordings = (tripId: number): Promise<Recording[]> => request('GET', `${tripApi(tripId)}/recordings`);

/** Adds a recording to a day: the GPX file goes compressed with gzip, which keeps it within a server's request limits. */
export async function addRecording(tripId: number, dayId: string, name: string, gpx: string): Promise<Recording> {
  const form = new FormData();
  form.set('dayId', dayId);
  form.set('name', name);
  form.set('file', await new Response(new Blob([gpx]).stream().pipeThrough(new CompressionStream('gzip'))).blob(), 'recording.gpx.gz');
  return request('POST', `${tripApi(tripId)}/recordings`, form);
}

export const renameRecording = (tripId: number, id: number, name: string): Promise<void> => request('PATCH', `${tripApi(tripId)}/recordings/${id}`, { name });

export const deleteRecording = (tripId: number, id: number): Promise<void> => request('DELETE', `${tripApi(tripId)}/recordings/${id}`);

/** A recording's GPX file; the browser undoes the compression it is sent with. */
export async function fetchRecordingGpx(tripId: number, id: number): Promise<string> {
  const response = await fetch(`${tripApi(tripId)}/recordings/${id}/gpx`);
  if (!response.ok) throw new ApiError(response.status, `The recording could not be read (${response.status}).`);
  return response.text();
}

/** The token the trip's read-only page is public under, or null. */
export const shareToken = (tripId: number): Promise<{ token: string | null }> => request('GET', `${tripApi(tripId)}/share`);

export const shareTrip = (tripId: number): Promise<{ token: string }> => request('POST', `${tripApi(tripId)}/share`);

export const unshareTrip = (tripId: number): Promise<void> => request('DELETE', `${tripApi(tripId)}/share`);

/** The read-only page of a trip shared under a token. */
export const sharedPageUrl = (token: string): string => `${location.origin}/t/${token}`;

/** Saves the whole trip as the server keeps it, each day's stops in riding order; the answer is its new version. */
export async function saveTrip(trip: Trip, keepalive = false): Promise<number> {
  const { version } = await request<{ version: number }>('PUT', `/api/trips/${trip.id}`, withStopsInRidingOrder(trip), keepalive);
  return version;
}

/** Reads the trip, changes it with `change` and saves it; the answer is its new version. */
export async function changeTrip(id: number, change: (trip: Trip) => Trip): Promise<number> {
  return saveTrip(change(await fetchTrip(id)));
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

/** The GPX download of a trip as the options say, or of one of its days. */
export function gpxUrl(tripId: number, options: ExportOptions, dayId?: string): string {
  const query = new URLSearchParams({ per: options.per, form: options.form, optional: options.optional ? '1' : '0', reachM: String(options.reachM) });
  if (dayId) query.set('day', dayId);
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
