import { keepStashRides, removeStashItems, renameStashFile, renameStashItem, stashFileUrl } from '../api';
import { t } from '../i18n/t';
import { copyStashFiles, copyStashParts } from '../state/clipboard';
import { runLibrary, setImportNote } from '../state/library';
import { ridesChanged } from '../state/rides';
import { relistStash, showInStash, shownInStash } from '../state/stash';
import { askConfirmation } from '../ui/confirm';
import { counted } from '../ui/format';
import { menuNote, type MenuItem } from '../ui/menu';
import { keptText } from './dropImport';
import { countText, filesOf, type FileItem, type Item } from './items';
import { stashItemName } from './StashFileCard';
import type { StashFile, StashPart } from '../model/stash';
import type { Picked } from './stashOut';

/**
 * What is done with the Stash's files and their routes and tracks, and the menus that
 * offer it. Nothing is edited there: things are taken out by the clipboard, a route or
 * a track also among the rides, renamed, moved and deleted.
 */

/** What the menus ask of the library around them: its rename dialog, where the chosen can be moved, what is pasted into a file, deleting them, and listing afresh. */
export interface StashMenuHost {
  rename: (title: string, placeholder: string, name: string, save: (name: string) => Promise<unknown>, saved: () => void) => void;
  moveItem: (chosen: readonly Item[]) => MenuItem[];
  pasteInto: (file: StashFile) => MenuItem[];
  remove: (chosen: readonly Item[]) => void;
  relist: () => void;
}

/** Takes something out of the Stash and says, where the imports say what they did, what came of it. */
const takeOut = (work: () => Promise<string>): void => void runLibrary(async () => setImportNote({ text: await work(), errors: [] }));

/** Keeps tracks of the Stash as rides, which the rides then list. */
const keepRides = (picked: readonly Picked[]) =>
  takeOut(async () => {
    let [kept, known] = [0, 0];
    for (const { file, items } of picked) {
      const count = await keepStashRides(file.id, items?.map((item) => item.position));
      kept += count.kept;
      known += count.known;
    }
    ridesChanged();
    return keptText(kept, known, 'ride', t('No tracks found.'));
  });

/** The paste entries, or Paste greyed out where the clipboard holds nothing for the place. */
const pasteOr = (paste: MenuItem[]): MenuItem[] => (paste.length > 0 ? paste : [menuNote(t('Paste'))]);

/**
 * The menu of what is selected once files of the Stash are among it. Files alone are
 * copied, to be imported where they are pasted. One file is renamed, takes the routes,
 * tracks and waypoints copied from other files, or is exported as it is kept, and
 * files, with the folders selected beside them, are moved and deleted.
 */
export function filesMenu(chosen: readonly Item[], host: StashMenuHost): MenuItem[] {
  const several = chosen.length > 1;
  const chosenFiles = filesOf(chosen);
  const onlyFiles = chosenFiles.length === chosen.length;
  return [
    ...(several ? [menuNote(t('{what} selected', { what: countText(chosen) }))] : []),
    // Files alone are copied; one file takes what is copied of others, greyed out while the clipboard holds none of it, and is renamed and exported.
    ...(onlyFiles ? [{ label: t('Copy'), run: () => copyStashFiles(chosenFiles) }] : []),
    ...(several ? [] : pasteOr(host.pasteInto(chosenFiles[0]!))),
    ...(several ? [] : [{ label: t('Rename…'), run: () => host.rename(t('Rename file'), t('File name'), chosenFiles[0]!.name, (name) => renameStashFile(chosenFiles[0]!.id, name), relistStash) }]),
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
 * The menu of what the `selected` rows take of files: their routes and tracks and their
 * waypoints, which are one row of a file. They are copied, to be pasted into another
 * file, a day, a trip or a list of places; routes and tracks alone are kept as rides,
 * one renamed, and deleted from their files. With anything else selected besides, it
 * says that they are not acted on together.
 */
export function partsMenu(taken: readonly StashPart[], selected: number, host: StashMenuHost): MenuItem[] {
  const parts: FileItem[] = taken.flatMap(({ file, items }) => items.map((item) => ({ file, item })));
  const waypoints = taken.filter((part) => part.waypoints).length;
  if (parts.length + waypoints < selected) return [menuNote(t('Routes and tracks inside files cannot be changed together with files and folders'))];
  const one = parts.length === 1 && waypoints === 0 ? parts[0]! : undefined;
  const tracks = parts.filter((at) => at.item.kind === 'track');
  return [
    ...(parts.length > 1 ? [menuNote(t('{what} selected', { what: t('{n} routes and tracks', { n: parts.length }) }))] : []),
    { label: t('Copy'), run: () => copyStashParts([...taken]) },
    ...(waypoints > 0
      ? []
      : [
          // Tracks are kept as rides, routes are not; one route or track is renamed.
          ...(tracks.length > 0 ? [{ label: t(one ? 'Save as ride' : 'Save tracks as rides'), run: () => keepRides(pickedOf(tracks)) }] : []),
          ...(one ? [{ label: t('Rename…'), run: () => host.rename(one.item.kind === 'track' ? t('Rename track') : t('Rename route'), t('Name'), one.item.name, (name) => renameStashItem(one.file.id, one.item, name), relistStash) }] : []),
          { label: t('Delete'), run: () => void removeItems(parts, host.relist) },
        ]),
  ];
}
