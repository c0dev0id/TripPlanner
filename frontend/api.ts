import type { Folder, Trip, TripSummary } from './model/trip';

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

async function request<T>(method: string, url: string, body?: unknown, keepalive = false): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
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

export const createTrip = (name: string, folderId: number | null): Promise<TripSummary> => request('POST', '/api/trips', { name, folderId });

/** Puts a trip into a folder, or into none. */
export const moveTrip = (id: number, folderId: number | null): Promise<void> => request('PATCH', `/api/trips/${id}`, { folderId });

export const listFolders = (): Promise<Folder[]> => request('GET', '/api/folders');

export const createFolder = (name: string): Promise<Folder> => request('POST', '/api/folders', { name });

export const renameFolder = (id: number, name: string): Promise<void> => request('PATCH', `/api/folders/${id}`, { name });

/** Deletes a folder; its trips stay, in no folder. */
export const deleteFolder = (id: number): Promise<void> => request('DELETE', `/api/folders/${id}`);

export const fetchTrip = (id: number): Promise<Trip> => request('GET', `/api/trips/${id}`);

/** Saves the whole trip; the answer is its new version. */
export async function saveTrip(trip: Trip, keepalive = false): Promise<number> {
  const { version } = await request<{ version: number }>('PUT', `/api/trips/${trip.id}`, trip, keepalive);
  return version;
}

export const deleteTrip = (id: number): Promise<void> => request('DELETE', `/api/trips/${id}`);

/** The GPX download of a trip, or of one of its days. */
export const gpxUrl = (tripId: number, dayId?: string): string => `/api/trips/${tripId}/gpx${dayId ? `?day=${encodeURIComponent(dayId)}` : ''}`;

/** The zip with one GPX file per day. */
export const gpxZipUrl = (tripId: number): string => `/api/trips/${tripId}/gpx?per=day`;

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
