import { createResource, createRoot } from 'solid-js';
import { fetchPublication, savePublication, shareTrip, unshareTrip } from '../api';
import type { Publication } from '../model/publication';
import { announceChange } from './changes';
import { openTripId } from './trip';

/** What the open trip's public page shows, and the token it is public under; read with the trip. */

const [publication, { mutate }] = createRoot(() => createResource(openTripId, fetchPublication));

/** None until it is read. */
export const openPublication = (): (Publication & { token: string | null }) | undefined => (publication.state === 'ready' ? publication() : undefined);

/** Makes the trip's page public, or takes it off the public. */
export async function setShared(shared: boolean): Promise<void> {
  const tripId = openTripId()!;
  const token = shared ? (await shareTrip(tripId)).token : (await unshareTrip(tripId), null);
  mutate((p) => p && { ...p, token });
}

/** Changes what the page shows besides the plan. */
export async function publish(change: Partial<Publication>): Promise<void> {
  const { journal, gpx, coverEntryId } = { ...openPublication()!, ...change };
  await savePublication(openTripId()!, { journal, gpx, coverEntryId });
  mutate((p) => p && { ...p, ...change });
  announceChange();
}
