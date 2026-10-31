import type { Folder, TripSummary } from '../model/trip';
import { counted } from '../ui/format';

/** The names of the folders from the top of the library down to the folder `id`; none for the top. */
export function folderNames(folders: readonly Folder[], id: number | null): string[] {
  const names: string[] = [];
  for (let folder = folders.find((f) => f.id === id); folder; folder = folders.find((f) => f.id === folder!.parentId)) names.unshift(folder.name);
  return names;
}

/** The names of the folders from the top of the library down to the folder `id`, joined; empty for none. */
export const folderPath = (folders: readonly Folder[], id: number | null): string => folderNames(folders, id).join(' / ');

/** How many folders and trips each folder holds itself, by its id; null stands for the top of the library. */
export function heldCounts(folders: readonly Folder[], trips: readonly TripSummary[]): (id: number | null) => { folders: number; trips: number } {
  const counts = new Map<number | null, { folders: number; trips: number }>();
  const of = (id: number | null) => counts.get(id) ?? counts.set(id, { folders: 0, trips: 0 }).get(id)!;
  for (const f of folders) of(f.parentId).folders++;
  for (const trip of trips) of(trip.folderId).trips++;
  return (id) => counts.get(id) ?? { folders: 0, trips: 0 };
}

/** What a folder holds, as its card says it: "2 folders · 1 trip". */
export const heldText = (held: { folders: number; trips: number }): string =>
  [held.folders > 0 && counted(held.folders, 'folder'), counted(held.trips, 'trip')].filter(Boolean).join(' · ');

/** How many folders and trips a folder holds at any depth, from what each folder holds itself (see heldCounts). */
export function heldInAll(folders: readonly Folder[], held: ReturnType<typeof heldCounts>, id: number): { folders: number; trips: number } {
  const total = { folders: 0, trips: 0 };
  const visit = (at: number) => {
    total.folders += held(at).folders;
    total.trips += held(at).trips;
    for (const f of folders) if (f.parentId === at) visit(f.id);
  };
  visit(id);
  return total;
}
