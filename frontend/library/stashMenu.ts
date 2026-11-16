import { addStashMedia, addStashParts, deleteStashMedia, fetchStashMedia, keepStashRides, moveStashFile, removeStashItems, renameStashFile, renameStashItem, stashFileUrl, type StashRide } from '../api';
import { t } from '../i18n/t';
import { copyStashParts } from '../state/clipboard';
import { runLibrary, setImportNote } from '../state/library';
import { ridesChanged } from '../state/rides';
import { relistStash, showInStash, shownInStash } from '../state/stash';
import { askConfirmation } from '../ui/confirm';
import { localDate } from '../recording/rides';
import { counted, dateText } from '../ui/format';
import { menuNote, type MenuItem } from '../ui/menu';
import { pickFiles } from '../ui/pickFile';
import { keptText } from './dropImport';
import { foldersUnder } from './folderImport';
import type { FileGroup } from './grouping';
import { countText, filesOf, type FileItem, type Item } from './items';
import { stashItemName } from './StashFileCard';
import type { StashFile, StashPart } from '../model/stash';
import type { Picked } from './stashOut';

/**
 * What is done with the Stash's files and their routes and tracks, and the menus that
 * offer it. Nothing is edited there: things are taken out by the clipboard, a route or
 * a track also among the rides, renamed, moved and deleted.
 */

/** What the menus ask of the library around them: its rename dialog, copying the chosen with what the folders among them hold, where they can be moved, what is pasted into a file, deleting them, and listing afresh. */
export interface StashMenuHost {
  rename: (title: string, placeholder: string, name: string, save: (name: string) => Promise<unknown>, saved: () => void) => void;
  copy: (chosen: readonly Item[]) => void;
  moveItem: (chosen: readonly Item[]) => MenuItem[];
  pasteInto: (file: StashFile) => MenuItem[];
  remove: (chosen: readonly Item[]) => void;
  relist: () => void;
}

/** Does something with the Stash and says, where the imports say what they did, what came of it; `then` runs once it is done. */
export const takeOut = (work: () => Promise<string>, then?: () => void): void => void runLibrary(async () => setImportNote({ text: await work(), errors: [] }), then);

/** Keeps tracks of the Stash as rides, which the rides then list. */
const keepRides = (picked: readonly Picked[]) =>
  takeOut(async () => {
    const rides: StashRide[] = [];
    for (const { file, items } of picked) rides.push(...(await keepStashRides(file.id, items?.map((item) => item.position))).rides);
    ridesChanged();
    return keptRidesText(rides);
  });

/** How many rides are each said by name before the note counts them. */
const NAMED_RIDES = 3;

/** What came of adding tracks to the recordings: of a few, each by its name and the date it is listed under, added or there already; of more, how many of either. */
function keptRidesText(rides: readonly StashRide[]): string {
  if (rides.length > NAMED_RIDES) return keptText(rides.filter((ride) => ride.added).length, rides.filter((ride) => !ride.added).length, 'recording', '');
  return rides
    .map(({ name, startedAt, added }) => {
      const on = startedAt === null ? undefined : { name, date: dateText(localDate(startedAt)) };
      if (added) return on ? t('Recording “{name}” added to {date}.', on) : t('Recording “{name}” added.', { name });
      return on ? t('Already available as “{name}” on {date}.', on) : t('Already available as “{name}”.', { name });
    })
    .join(' ');
}

/** Asks for files and keeps them with a file of the Stash as its media, and says how many it took and how many it had. */
async function addMedia(file: StashFile): Promise<void> {
  const picked = await pickFiles({});
  if (picked.length === 0) return;
  takeOut(async () => {
    let kept = 0;
    for (const one of picked) kept += (await addStashMedia(file.id, one)).added ? 1 : 0;
    return keptText(kept, picked.length - kept, 'file', '');
  }, relistStash);
}

/** Deletes all the media of files of the Stash, once that is confirmed. */
async function removeMedia(files: readonly StashFile[]): Promise<void> {
  const question = files.length === 1 ? t('Delete the media of “{name}”?', { name: files[0]!.name }) : t('Delete the media of {files}?', { files: counted(files.length, 'file') });
  if (await askConfirmation(question, t('Delete'))) await runLibrary(() => Promise.all(files.map((file) => deleteStashMedia(file.id))), relistStash);
}

/**
 * Adds what was copied of other files to a file of the Stash: the routes, tracks and
 * waypoints on the server, which rewrites the file, and the media taken, one after the
 * other.
 */
export async function addPartsTo(file: StashFile, parts: readonly StashPart[]): Promise<void> {
  const written = parts.filter((part) => part.items.length > 0 || part.waypoints);
  if (written.length > 0) await addStashParts(file.id, written);
  for (const part of parts.filter((taken) => taken.media && taken.file.id !== file.id)) {
    for (const one of part.file.media) await addStashMedia(file.id, await fetchStashMedia(part.file.id, one));
  }
}

/**
 * Gives each group a folder in the folder, the one of its name where there is one, and
 * moves the group's files into it. Says how many files went into how many folders.
 */
export async function applyGroups(folderId: number, groups: readonly FileGroup[]): Promise<string> {
  const folderOf = await foldersUnder(folderId);
  for (const group of groups) {
    const into = await folderOf([group.name]);
    await Promise.all(group.files.map((file) => moveStashFile(file.id, into)));
  }
  const files = groups.reduce((n, group) => n + group.files.length, 0);
  return t('{files} moved into {folders}.', { files: counted(files, 'file'), folders: counted(groups.length, 'folder') });
}

/** The paste entries, or Paste greyed out where the clipboard holds nothing for the place. */
const pasteOr = (paste: MenuItem[]): MenuItem[] => (paste.length > 0 ? paste : [menuNote(t('Paste'))]);

/**
 * The menu of what is selected once files of the Stash are among it. They are copied,
 * and the folders selected with them, to be imported where they are pasted. One file is renamed, takes the routes,
 * tracks and waypoints copied from other files, or is exported as it is kept, and
 * files, with the folders selected beside them, are moved and deleted.
 */
export function filesMenu(chosen: readonly Item[], host: StashMenuHost): MenuItem[] {
  const several = chosen.length > 1;
  const chosenFiles = filesOf(chosen);
  return [
    ...(several ? [menuNote(t('{what} selected', { what: countText(chosen) }))] : []),
    // Files are copied, and folders with them; one file takes what is copied of others, greyed out while the clipboard holds none of it, and is renamed and exported.
    { label: t('Copy'), run: () => host.copy(chosen) },
    ...(several ? [] : pasteOr(host.pasteInto(chosenFiles[0]!))),
    ...(several ? [] : [{ label: t('Rename…'), run: () => host.rename(t('Rename file'), t('File name'), chosenFiles[0]!.name, (name) => renameStashFile(chosenFiles[0]!.id, name), relistStash) }]),
    ...(several ? [] : [{ label: t('Add media…'), run: () => void addMedia(chosenFiles[0]!) }]),
    ...host.moveItem(chosen),
    ...(several ? [] : [{ label: t('Export'), run: () => window.location.assign(stashFileUrl(chosenFiles[0]!.id)) }]),
    { label: t('Delete'), run: () => host.remove(chosen) },
  ];
}

/** Routes and tracks by their files, as what is taken of each. */
const pickedOf = (parts: readonly FileItem[]): Picked[] => [...new Set(parts.map((at) => at.file))].map((file) => ({ file, items: parts.filter((at) => at.file === file).map((at) => at.item) }));

/** Deletes routes and tracks from their files, once that is confirmed, which rewrites the files; one of them shown alone on the map gives way to its file, and `removed` lists the Stash afresh. */
export async function removeItems(doomed: readonly FileItem[], removed: () => void): Promise<void> {
  const [only] = doomed;
  const picked = pickedOf(doomed);
  const question =
    doomed.length === 1
      ? t('Delete “{name}” from the file “{file}”?', { name: stashItemName(only!.item), file: only!.file.name })
      : t('Delete {n} routes and tracks from {files}?', { n: doomed.length, files: counted(picked.length, 'file') });
  if (!(await askConfirmation(question, t('Delete')))) return;
  await runLibrary(() => Promise.all(picked.map(({ file, items }) => removeStashItems(file.id, items!))), () => {
    const shown = shownInStash();
    if (shown?.item && picked.some(({ file }) => file.id === shown.fileId)) showInStash({ fileId: shown.fileId });
    removed();
  });
}

/**
 * The menu of what the `selected` rows take of files: their routes and tracks, their
 * waypoints and their media, each of the two one row of a file. They are copied, to be
 * pasted into another file, a day, a trip or a list of places; routes and tracks alone
 * are kept as rides, one renamed, and deleted from their files; media alone take more
 * files and are deleted, a file's all together. With anything else selected besides, it
 * says that they are not acted on together.
 */
export function partsMenu(taken: readonly StashPart[], selected: number, host: StashMenuHost): MenuItem[] {
  const parts: FileItem[] = taken.flatMap(({ file, items }) => items.map((item) => ({ file, item })));
  const waypoints = taken.filter((part) => part.waypoints).length;
  const media = taken.filter((part) => part.media).map((part) => part.file);
  if (parts.length + waypoints + media.length < selected) return [menuNote(t('Routes and tracks inside files cannot be changed together with files and folders'))];
  const copy = { label: t('Copy'), run: () => copyStashParts([...taken]) };
  // The media of files, alone, take more of one file and are deleted, all of a file's together.
  if (media.length > 0 && parts.length + waypoints === 0) {
    return [copy, ...(media.length === 1 ? [{ label: t('Add media…'), run: () => void addMedia(media[0]!) }] : []), { label: t('Delete'), run: () => void removeMedia(media) }];
  }
  const note = parts.length > 1 ? [menuNote(t('{what} selected', { what: t('{n} routes and tracks', { n: parts.length }) }))] : [];
  // With waypoints or media among them they are copied, and nothing else.
  if (waypoints + media.length > 0) return [...note, copy];
  const [one] = parts.length === 1 ? parts : [];
  const tracks = parts.filter((at) => at.item.kind === 'track');
  return [
    ...note,
    copy,
    // Tracks are added to the recordings, routes are not; one route or track is renamed.
    ...(tracks.length > 0 ? [{ label: t('Add to recordings'), run: () => keepRides(pickedOf(tracks)) }] : []),
    ...(one ? [{ label: t('Rename…'), run: () => host.rename(one.item.kind === 'track' ? t('Rename track') : t('Rename route'), t('Name'), one.item.name, (name) => renameStashItem(one.file.id, one.item, name), relistStash) }] : []),
    { label: t('Delete'), run: () => void removeItems(parts, host.relist) },
  ];
}
