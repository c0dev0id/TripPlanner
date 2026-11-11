import { createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { createFolder, createTrip, errorMessage } from '../api';
import { folderPath } from './folders';
import { importFolder, pickedPath, planFolderImport, type ImportSource, type PlannedTrip } from './folderImport';
import { ImportDialog } from './ImportDialog';
import { archiveFolders, inFolders } from './tripArchive';
import { zipEntries } from './zip';
import { libraryFolders, relistFolders, relistTrips, runLibrary, setImportNote, showDuplicates, shownFolderId } from '../state/library';
import { placesListOpen, setPlacesListOpen } from '../state/places';
import { counted } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CopyIcon, FileImportIcon, FolderImportIcon, FolderPlusIcon, MapPlusIcon, PinIcon } from '../ui/icons';
import { NameDialog } from '../ui/NameDialog';

/**
 * The panel's actions as icons, the same at every level of the explorer: a new trip or
 * folder in the folder shown, a folder of GPX files or a zip of exported trips imported into it, the duplicates
 * report, and the list of places to show on the map. The library's but a new trip leave an
 * open trip first.
 */
export function LibraryActions(props: { onOpen: (id: number) => void; onLeave: () => Promise<void>; opening: boolean }) {
  const [dialog, setDialog] = createSignal<'trip' | 'folder'>();
  const [importing, setImporting] = createSignal(false);
  /** What was picked for import, while the dialog asks how its GPX files are organized: the files, the paths of those to plan from, and the folders of exported trips. */
  const [picked, setPicked] = createSignal<{ sources: ImportSource[]; paths: string[]; archives: string[] }>();
  let folderInput!: HTMLInputElement;
  let zipInput!: HTMLInputElement;
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
  const pickZip = async (file: File | undefined) => {
    zipInput.value = '';
    if (!file) return;
    try {
      pick((await zipEntries(file)).map((entry) => ({ path: entry.path, open: async () => new File([await entry.read()], entry.path.slice(entry.path.lastIndexOf('/') + 1)) })));
    } catch (error) {
      setImportNote({ text: errorMessage(error), errors: [] });
    }
  };
  const importPicked = async (sources: ImportSource[], plan: PlannedTrip[], archives: string[]) => {
    await props.onLeave();
    setImporting(true);
    await runLibrary(async () => {
      const result = await importFolder(sources, plan, archives, shownFolderId(), (text) => setImportNote({ text, errors: [] }));
      setImportNote({ text: t('{trips} imported.', { trips: counted(result.trips, plan[0]?.kind ?? 'trip') }), errors: result.errors });
    });
    setImporting(false);
    relistFolders();
    relistTrips();
  };
  const openDuplicates = () => void props.onLeave().then(showDuplicates);
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
      <IconButton label={t('Import exported trips (zip)…')} disabled={importing()} onClick={() => zipInput.click()}>
        <FileImportIcon />
      </IconButton>
      <IconButton label={t('Duplicates…')} onClick={openDuplicates}>
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
      <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => void pickZip(e.currentTarget.files?.[0])} />
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
