import { t } from '../i18n/t';
import type { Folder, FolderKind, TripSummary } from '../model/trip';
import { counted } from '../ui/format';

/** The names of the folders from the top of the library down to the folder `id`; none for the top. */
function folderNames(folders: readonly Folder[], id: number | null): string[] {
  const names: string[] = [];
  for (let folder = folders.find((f) => f.id === id); folder; folder = folders.find((f) => f.id === folder!.parentId)) names.unshift(folder.name);
  return names;
}

/** The names of the folders from the top of the library down to the folder `id`, joined; empty for none. */
export const folderPath = (folders: readonly Folder[], id: number | null): string => folderNames(folders, id).join(' / ');

/** The kind of the top folder the folder `id` is or lies in: the special ones and the folders in them hold collections, the others and the top of the library, a plain folder's kind, trips. */
export function kindAround(folders: readonly Folder[], id: number | null): FolderKind {
  let folder = folders.find((f) => f.id === id);
  while (folder && folder.parentId !== null) folder = folders.find((f) => f.id === folder!.parentId);
  return folder?.kind ?? 'folder';
}

/** How many folders and trips each folder holds itself, by its id; null stands for the top of the library. */
export function heldCounts(folders: readonly Folder[], trips: readonly TripSummary[]): (id: number | null) => { folders: number; trips: number } {
  const counts = new Map<number | null, { folders: number; trips: number }>();
  const of = (id: number | null) => counts.get(id) ?? counts.set(id, { folders: 0, trips: 0 }).get(id)!;
  for (const f of folders) of(f.parentId).folders++;
  for (const trip of trips) of(trip.folderId).trips++;
  return (id) => counts.get(id) ?? { folders: 0, trips: 0 };
}

/** What a folder holds, as its card says it: "2 folders · 1 trip", or collections or lists where it holds those. */
export const heldText = (held: { folders: number; trips: number }, noun: 'trip' | 'collection' | 'list' = 'trip'): string =>
  [held.folders > 0 && counted(held.folders, 'folder'), counted(held.trips, noun)].filter(Boolean).join(' · ');

/** How many folders and trips, as a sentence says it: "2 folders and 3 trips", "1 trip"; empty for none. */
export function countsText(folders: number, trips: number): string {
  const folderText = folders > 0 ? counted(folders, 'folder') : '';
  const tripText = trips > 0 ? counted(trips, 'trip') : '';
  return folderText && tripText ? t('{a} and {b}', { a: folderText, b: tripText }) : folderText || tripText;
}

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
