import { createSignal, type JSX } from 'solid-js';
import { createFolder, createTrip } from '../api';
import { folderPath } from './folders';
import { importFolder, pickedPath, planFolderImport, type PlannedTrip } from './folderImport';
import { ImportDialog } from './ImportDialog';
import {
  libraryFolders,
  listFolderId,
  relistFolders,
  relistTrips,
  runLibrary,
  setImportNote,
  setQuery,
  setShowingDuplicates,
} from '../state/library';
import { counted } from '../ui/format';
import { CopyIcon, FolderImportIcon, FolderPlusIcon, MapPlusIcon } from '../ui/icons';
import { NameDialog } from '../ui/NameDialog';

function ActionButton(props: { label: string; onClick: () => void; disabled?: boolean; children: JSX.Element }) {
  return (
    <button class="icon" title={props.label} aria-label={props.label} disabled={props.disabled} onClick={() => props.onClick()}>
      {props.children}
    </button>
  );
}

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
  const folderId = () => listFolderId() ?? null;
  let folderInput!: HTMLInputElement;
  const pick = (list: FileList | null) => {
    const files = [...(list ?? [])];
    folderInput.value = '';
    const paths = files.map(pickedPath);
    if (planFolderImport(paths, 'trip-per-folder').length === 0) setImportNote({ text: 'No GPX files in that folder.', errors: [] });
    else setPicked({ files, paths });
  };
  /** Imports the picked folder tree into the folder shown as planned. */
  const importPicked = async (files: File[], plan: PlannedTrip[]) => {
    await props.onLeave();
    setImporting(true);
    await runLibrary(async () => {
      const result = await importFolder(files, plan, folderId(), (text) => setImportNote({ text, errors: [] }));
      setImportNote({ text: `${counted(result.trips, plan[0]!.kind)} imported.`, errors: result.errors });
    });
    setImporting(false);
    relistFolders();
    relistTrips();
  };
  const showDuplicates = async () => {
    await props.onLeave();
    setQuery('');
    setShowingDuplicates(true);
  };
  return (
    <div class="row library-actions" role="toolbar" aria-label="Library">
      <ActionButton label="New trip…" disabled={props.opening} onClick={() => setDialog('trip')}>
        <MapPlusIcon />
      </ActionButton>
      <ActionButton label="New folder…" onClick={() => setDialog('folder')}>
        <FolderPlusIcon />
      </ActionButton>
      <ActionButton label="Import a folder of GPX files…" disabled={importing()} onClick={() => folderInput.click()}>
        <FolderImportIcon />
      </ActionButton>
      <ActionButton label="Duplicates…" onClick={() => void showDuplicates()}>
        <CopyIcon />
      </ActionButton>
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
        into={folderPath(libraryFolders() ?? [], folderId())}
        onClose={() => setPicked(undefined)}
        onImport={(plan) => void importPicked(picked()!.files, plan)}
      />
      <NameDialog
        title="New trip"
        open={dialog() === 'trip'}
        placeholder="Name of the trip"
        submit="Start"
        onClose={() => setDialog(undefined)}
        onSubmit={(name) => void runLibrary(async () => props.onOpen((await createTrip(name, folderId())).id), relistTrips)}
      />
      <NameDialog
        title="New folder"
        open={dialog() === 'folder'}
        placeholder="Name of the folder"
        submit="Create"
        onClose={() => setDialog(undefined)}
        onSubmit={(name) =>
          void runLibrary(async () => {
            await props.onLeave();
            await createFolder(name, folderId());
          }, relistFolders)
        }
      />
    </div>
  );
}
