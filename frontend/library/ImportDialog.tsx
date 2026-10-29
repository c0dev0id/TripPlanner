import { createMemo, createSignal, For } from 'solid-js';
import { counted } from '../ui/format';
import { EditDialog } from '../ui/EditDialog';
import { planFolderImport, type ImportMode, type PlannedTrip } from './folderImport';

/** The ways a folder tree can be organized, as the dialog offers them. */
const MODES: { mode: ImportMode; label: string; hint: string }[] = [
  { mode: 'trip-per-folder', label: 'A trip per folder', hint: 'Each folder of GPX files is a trip, each file a day, or each date in the file names.' },
  { mode: 'trip-per-file', label: 'A trip per file', hint: 'Each GPX file is a trip of one day; the folders stay folders.' },
  { mode: 'planning-material', label: 'Planning material', hint: 'Each folder of GPX files is a collection to copy routes from, each file a section of it, without days.' },
];

/** What a plan makes, in a few words. */
function planText(plan: readonly PlannedTrip[]): string {
  const parts = plan.reduce((sum, trip) => sum + trip.days.length, 0);
  if (plan[0]?.kind === 'collection') return `${counted(plan.length, 'collection')} with ${counted(parts, 'section')}`;
  return parts === plan.length ? counted(plan.length, 'trip') : `${counted(plan.length, 'trip')} with ${counted(parts, 'day')}`;
}

/**
 * Asks how the picked folder tree, given by its files' paths, is organized, showing what
 * each way makes of it, and imports it into `into` (a folder's path, or none for the top)
 * the way chosen.
 */
export function ImportDialog(props: { paths: string[] | undefined; into: string; onClose: () => void; onImport: (plan: PlannedTrip[]) => void }) {
  const [mode, setMode] = createSignal<ImportMode>('trip-per-folder');
  const plan = createMemo(() => (props.paths ? planFolderImport(props.paths, mode()) : []));
  return (
    <EditDialog
      label="Import folder"
      value={props.paths && true}
      title={() => 'Import folder'}
      submit="Import"
      onClose={props.onClose}
      onSubmit={() => props.onImport(plan())}
    >
      {() => (
        <>
          <fieldset class="choices">
            <legend>How the folder is organized</legend>
            <For each={MODES}>
              {(m) => (
                <label>
                  <input type="radio" name="mode" checked={mode() === m.mode} onChange={() => setMode(m.mode)} />
                  <span class="lines">
                    <span>{m.label}</span>
                    <span class="muted">{m.hint}</span>
                  </span>
                </label>
              )}
            </For>
          </fieldset>
          <p>
            Makes {planText(plan())}
            {props.into ? ` in “${props.into}”` : ''}.
          </p>
        </>
      )}
    </EditDialog>
  );
}
