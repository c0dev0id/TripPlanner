import { createSignal } from 'solid-js';
import { t } from '../i18n/t';
import { createFolder, createTrip } from '../api';
import { folderPath } from './folders';
import { importFolder, pickedPath, planFolderImport, type PlannedTrip } from './folderImport';
import { ImportDialog } from './ImportDialog';
import { libraryFolders, relistFolders, relistTrips, runLibrary, setImportNote, showDuplicates, shownFolderId } from '../state/library';
import { counted } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { CopyIcon, FolderImportIcon, FolderPlusIcon, MapPlusIcon } from '../ui/icons';
import { NameDialog } from '../ui/NameDialog';

/**
 * The library's actions as icons, the same at every level of the explorer: a new trip or
 * folder in the folder shown, a folder of GPX files imported into it, the duplicates
 * report. All but a new trip leave an open trip first.
 */
export function LibraryActions(props: { onOpen: (id: number) => void; onLeave: () => Promise<void>; opening: boolean }) {
  const [dialog, setDialog] = createSignal<'trip' | 'folder'>();
  const [importing, setImporting] = createSignal(false);
  /** The folder tree picked for import, while the dialog asks how it is organized. */
  const [picked, setPicked] = createSignal<{ files: File[]; paths: string[] }>();
  let folderInput!: HTMLInputElement;
  const pick = (list: FileList | null) => {
    const files = [...(list ?? [])];
    folderInput.value = '';
    const paths = files.map(pickedPath);
    if (planFolderImport(paths, 'trip-per-folder').length === 0) setImportNote({ text: t('No GPX files in that folder.'), errors: [] });
    else setPicked({ files, paths });
  };
  /** Imports the picked folder tree into the folder shown as planned. */
  const importPicked = async (files: File[], plan: PlannedTrip[]) => {
    await props.onLeave();
    setImporting(true);
    await runLibrary(async () => {
      const result = await importFolder(files, plan, shownFolderId(), (text) => setImportNote({ text, errors: [] }));
      setImportNote({ text: t('{trips} imported.', { trips: counted(result.trips, plan[0]!.kind) }), errors: result.errors });
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
      <IconButton label={t('Import a folder of GPX files…')} disabled={importing()} onClick={() => folderInput.click()}>
        <FolderImportIcon />
      </IconButton>
      <IconButton label={t('Duplicates…')} onClick={openDuplicates}>
        <CopyIcon />
      </IconButton>
      <input
        ref={(el) => {
          folderInput = el;
          el.webkitdirectory = true;
        }}
        type="file"
        hidden
        onChange={(e) => pick(e.currentTarget.files)}
      />
      <ImportDialog
        paths={picked()?.paths}
        into={folderPath(libraryFolders() ?? [], shownFolderId())}
        onClose={() => setPicked(undefined)}
        onImport={(plan) => void importPicked(picked()!.files, plan)}
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
