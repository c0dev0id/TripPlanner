import type { Folder } from '../model/trip';

/** The names of the folders from the top of the library down to the folder `id`, joined; empty for none. */
export function folderPath(folders: readonly Folder[], id: number | null): string {
  const names: string[] = [];
  for (let folder = folders.find((f) => f.id === id); folder; folder = folders.find((f) => f.id === folder!.parentId)) names.unshift(folder.name);
  return names.join(' / ');
}

/** A count with its noun, plural where it is not one. */
export const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;
