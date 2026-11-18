import { createResource, createRoot } from 'solid-js';
import { changeTag, createTag, deleteTag, listTags, tagTrip } from '../api';
import type { Tag } from '../model/tag';
import type { TripSummary } from '../model/trip';
import { relistTripRows, unwantTag } from './library';

/** The user's tags and the trips they are put on. */

const [listed, { refetch }] = createRoot(() => createResource(listTags));

/** The tags by name; none until they are read. */
export const tags = (): Tag[] => listed.latest ?? [];

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
  unwantTag(id);
  await refetch();
  relistTripRows();
}

/** Puts a tag on trips, or takes it off them. */
export async function setTagOn(trips: readonly TripSummary[], tagId: number, on: boolean): Promise<void> {
  await Promise.all(trips.filter((trip) => trip.tagIds.includes(tagId) !== on).map((trip) => tagTrip(trip.id, tagId, on)));
  relistTripRows();
}
