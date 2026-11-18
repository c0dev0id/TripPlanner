import { createResource, createRoot, createSignal } from 'solid-js';
import { changeTag, createTag, deleteTag, listTags, tagTrip } from '../api';
import type { Tag } from '../model/tag';
import type { TripSummary } from '../model/trip';
import { relistTrips } from './library';

/** The user's tags, the trips they are put on, and the tags the list of trips is limited to. */

const [listed, { refetch }] = createRoot(() => createResource(listTags));

/** The tags by name; none until they are read. */
export const tags = (): Tag[] => (listed.state === 'ready' || listed.state === 'refreshing' ? listed() : []);

const [wanted, setWanted] = createSignal<ReadonlySet<number>>(new Set());

/** The tags the trips are limited to: those that have all of them are listed. */
export const wantedTags = wanted;

/** Limits the trips to those with the tag as well, or no longer to it. */
export function toggleWanted(tagId: number): void {
  const next = new Set(wanted());
  if (!next.delete(tagId)) next.add(tagId);
  setWanted(next);
}

export async function addTag(name: string, color: string): Promise<void> {
  await createTag(name, color);
  await refetch();
}

export async function saveTag(tag: Tag): Promise<void> {
  await changeTag(tag);
  await refetch();
}

/** Deletes a tag, which takes it off its trips and out of what the trips are limited to. */
export async function removeTag(id: number): Promise<void> {
  await deleteTag(id);
  setWanted(new Set([...wanted()].filter((tagId) => tagId !== id)));
  await refetch();
  relistTrips();
}

/** Puts a tag on trips, or takes it off them. */
export async function setTagOn(trips: readonly TripSummary[], tagId: number, on: boolean): Promise<void> {
  await Promise.all(trips.filter((trip) => trip.tagIds.includes(tagId) !== on).map((trip) => tagTrip(trip.id, tagId, on)));
  relistTrips();
}
