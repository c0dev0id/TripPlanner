import { createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { createFolder, createTrip, errorMessage } from '../api';
import { importDropped } from './dropImport';
import { droppedSources, onFileDrop } from './fileDrop';
import { folderPath, kindAround } from './folders';
import { importFolder, pickedPath, planFolderImport, type ImportSource, type PlannedTrip } from './folderImport';
import { ImportDialog } from './ImportDialog';
import { archiveFolders, inFolders } from './tripArchive';
import { zipEntries } from './zip';
import { libraryFolders, relistFolders, relistTrips, runLibrary, setImportNote, setShowingDuplicates, showingDuplicates, shownFolderId } from '../state/library';
import { placesListOpen, setPlacesListOpen } from '../state/places';
import { counted } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CopyIcon, FileImportIcon, FolderImportIcon, FolderPlusIcon, MapPlusIcon, PinIcon } from '../ui/icons';
import { NameDialog } from '../ui/NameDialog';
import { pickFile } from '../ui/pickFile';

/**
 * The library's actions as icons: a new trip or folder in the folder shown, a folder of
 * GPX files or a zip of exported trips imported into it, the duplicates report and the
 * list of places to show on the map, each switched on and off. Files and folders dropped
 * on a folder of the tree are imported into it without asking. A new folder and an
 * import leave an open trip first.
 */
export function LibraryActions(props: { onOpen: (id: number) => void; onLeave: () => Promise<void>; opening: boolean }) {
  const [dialog, setDialog] = createSignal<'trip' | 'folder'>();
  const [importing, setImporting] = createSignal(false);
  /** What was picked for import, while the dialog asks how its GPX files are organized: the files, the paths of those to plan from, and the folders of exported trips. */
  const [picked, setPicked] = createSignal<{ sources: ImportSource[]; paths: string[]; archives: string[] }>();
  let folderInput!: HTMLInputElement;
  /** Imports the sources into the folder shown: exported trips as they were, GPX files beside them as the dialog then says. */
  const pick = (sources: ImportSource[]) => {
    const archives = archiveFolders(sources.map((source) => source.path));
    // An exported trip's own GPX files are its trip once more, for other programs.
    const paths = sources.map((source) => (inFolders(source.path, archives) ? '' : source.path));
    if (planFolderImport(paths, 'trip-per-folder').length > 0) setPicked({ sources, paths, archives });
    else if (archives.length > 0) void importPicked(sources, [], archives);
    else setImportNote({ text: t('No GPX files and no exported trips in there.'), errors: [] });
  };
  const pickFolder = (list: FileList | null) => {
    const files = [...(list ?? [])];
    folderInput.value = '';
    pick(files.map((file) => ({ path: pickedPath(file), open: async () => file })));
  };
  const pickZip = async () => {
    const file = await pickFile('.zip,application/zip');
    if (!file) return;
    try {
      pick((await zipEntries(file)).map((entry) => ({ path: entry.path, open: async () => new File([await entry.read()], entry.path.slice(entry.path.lastIndexOf('/') + 1)) })));
    } catch (error) {
      setImportNote({ text: errorMessage(error), errors: [] });
    }
  };
  /** Runs an import, which says how it goes and then what it made and could not read: the open trip is left first, and the library listed afresh after. */
  const runImport = async (work: (onProgress: (text: string) => void) => Promise<{ text: string; errors: string[] }>) => {
    await props.onLeave();
    setImporting(true);
    await runLibrary(async () => setImportNote(await work((text) => setImportNote({ text, errors: [] }))));
    setImporting(false);
    relistFolders();
    relistTrips();
  };
  const importPicked = (sources: ImportSource[], plan: PlannedTrip[], archives: string[]) =>
    runImport(async (onProgress) => {
      const result = await importFolder(sources, plan, archives, shownFolderId(), onProgress);
      return { text: t('{trips} imported.', { trips: counted(result.trips, plan[0]?.kind ?? 'trip') }), errors: result.errors };
    });
  onFileDrop((data, folderId) => {
    if (importing()) return;
    const dropped = droppedSources(data);
    void runImport(async (onProgress) => importDropped(await dropped, folderId, kindAround(libraryFolders() ?? [], folderId), onProgress));
  });
  return (
    <div class="row library-actions" role="toolbar" aria-label={t('Library')}>
      <IconButton label={t('New trip…')} disabled={props.opening} onClick={() => setDialog('trip')}>
        <MapPlusIcon />
      </IconButton>
      <IconButton label={t('New folder…')} onClick={() => setDialog('folder')}>
        <FolderPlusIcon />
      </IconButton>
      <IconButton label={t('Import a folder of GPX files or exported trips…')} disabled={importing()} onClick={() => folderInput.click()}>
        <FolderImportIcon />
      </IconButton>
      <IconButton label={t('Import exported trips (zip)…')} disabled={importing()} onClick={() => void pickZip()}>
        <FileImportIcon />
      </IconButton>
      <IconButton label={t('Routes kept more than once')} pressed={showingDuplicates()} onClick={() => setShowingDuplicates(!showingDuplicates())}>
        <CopyIcon />
      </IconButton>
      <IconButton label={t('Places')} pressed={placesListOpen()} onClick={() => setPlacesListOpen(!placesListOpen())}>
        <PinIcon />
      </IconButton>
      <input
        ref={(el) => {
          folderInput = el;
          el.webkitdirectory = true;
        }}
        type="file"
        hidden
        onChange={(e) => pickFolder(e.currentTarget.files)}
      />
      <ImportDialog
        paths={picked()?.paths}
        into={folderPath(libraryFolders() ?? [], shownFolderId())}
        onClose={() => setPicked(undefined)}
        onImport={(plan) => void importPicked(picked()!.sources, plan, picked()!.archives)}
      />
      <NameDialog
        title={t('New trip')}
        open={dialog() === 'trip'}
        placeholder={t('Name of the trip')}
        submit={t('Start')}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => void runLibrary(async () => props.onOpen((await createTrip(name, shownFolderId())).id), relistTrips)}
      />
      <NameDialog
        title={t('New folder')}
        open={dialog() === 'folder'}
        placeholder={t('Name of the folder')}
        submit={t('Create')}
        onClose={() => setDialog(undefined)}
        onSubmit={(name) =>
          void runLibrary(async () => {
            await props.onLeave();
            await createFolder(name, shownFolderId());
          }, relistFolders)
        }
      />
    </div>
  );
}
