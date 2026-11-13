import { onCleanup } from 'solid-js';
import { pickedPath, type ImportSource } from './folderImport';

/** What was dropped from the file system: the files dropped themselves, and those in the folders dropped, by their path from the dropped folder down. */
export interface Dropped {
  files: ImportSource[];
  inFolders: ImportSource[];
}

/** What a folder holds itself; its reader hands the entries out in batches until one is empty. */
async function entriesIn(folder: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = folder.createReader();
  const entries: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return entries;
    entries.push(...batch);
  }
}

/** The files in a dropped folder, at any depth. */
async function filesIn(folder: FileSystemDirectoryEntry): Promise<ImportSource[]> {
  const sources: ImportSource[] = [];
  for (const entry of await entriesIn(folder)) {
    if (entry.isDirectory) sources.push(...(await filesIn(entry as FileSystemDirectoryEntry)));
    else sources.push({ path: entry.fullPath.slice(1).normalize('NFC'), open: () => new Promise((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)) });
  }
  return sources;
}

/** Reads what a drop holds. Its items are taken before anything is awaited: the browser empties the drop once its handler returns. */
export async function droppedSources(data: DataTransfer): Promise<Dropped> {
  const items = [...data.items].filter((item) => item.kind === 'file').map((item) => ({ entry: item.webkitGetAsEntry(), file: item.getAsFile() }));
  const dropped: Dropped = { files: [], inFolders: [] };
  for (const { entry, file } of items) {
    if (entry?.isDirectory) dropped.inFolders.push(...(await filesIn(entry as FileSystemDirectoryEntry)));
    else if (file) dropped.files.push({ path: pickedPath(file), open: async () => file });
  }
  return dropped;
}

/**
 * Takes files dragged in from outside the browser: the folder they are over is marked as
 * for a dragged trip (see dragToFolder), and dropped there, `onDrop` gets the drop and the
 * folder, null for the top. Anywhere else the drop is refused, so that the browser does
 * not open the file in the planner's place.
 */
export function onFileDrop(onDrop: (data: DataTransfer, folderId: number | null) => void): void {
  let target: HTMLElement | undefined;
  const mark = (to: HTMLElement | undefined) => {
    if (to === target) return;
    target?.classList.remove('drop-target');
    to?.classList.add('drop-target');
    target = to;
  };
  const over = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    mark((e.target instanceof Element && e.target.closest<HTMLElement>('[data-drop-folder]')) || undefined);
    e.dataTransfer.dropEffect = target ? 'copy' : 'none';
  };
  /** The drag left the window. */
  const leave = (e: DragEvent) => {
    if (e.relatedTarget === null) mark(undefined);
  };
  const drop = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    const folder = target?.dataset.dropFolder;
    mark(undefined);
    if (folder !== undefined) onDrop(e.dataTransfer, folder === 'top' ? null : Number(folder));
  };
  document.addEventListener('dragover', over);
  document.addEventListener('dragleave', leave);
  document.addEventListener('drop', drop);
  onCleanup(() => {
    document.removeEventListener('dragover', over);
    document.removeEventListener('dragleave', leave);
    document.removeEventListener('drop', drop);
  });
}
