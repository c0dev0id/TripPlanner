import { For } from 'solid-js';
import { t } from '../i18n/t';
import { asName } from '../model/trip';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import type { FileGroup, GroupClue } from './grouping';

/** A folder of the Stash with the groups proposed among its loose files. */
export interface Grouping {
  id: number;
  groups: FileGroup[];
}

/** What tied a group's files, as its chips say it. */
const CLUES: Record<GroupClue, string> = {
  name: t('Names alike'),
  onward: t('One continues the other'),
  thereAndBack: t('There and back'),
  together: t('Exported together'),
};

/**
 * The groups proposed among a folder's files, to confirm: each with the name its folder
 * gets, which can be changed, what tied its files, and the files. A group unticked stays
 * as it is; the others are handed to `onApply` under their names.
 */
export function GroupDialog(props: { grouping: Grouping | undefined; onClose: () => void; onApply: (groups: FileGroup[]) => void }) {
  const ticked = (form: FormData, groups: readonly FileGroup[]): FileGroup[] =>
    groups.flatMap((group, i) => (form.has(`group-${i}`) ? [{ ...group, name: asName(field(form, `name-${i}`)) || group.name }] : []));
  return (
    <EditDialog label={t('Group files')} value={props.grouping} title={() => t('Group files')} submit={t('Create folders')} onClose={props.onClose} onSubmit={(form, { groups }) => props.onApply(ticked(form, groups))}>
      {({ groups }) => (
        <>
          <p class="muted">{t('Each group becomes a folder holding its files. Untick a group to leave its files where they are.')}</p>
          <ul class="groups">
            <For each={groups}>
              {(group, i) => (
                <li>
                  <span class="row">
                    <input type="checkbox" name={`group-${i()}`} checked aria-label={t('Group “{name}”', { name: group.name })} />
                    <input class="grow" name={`name-${i()}`} value={group.name} aria-label={t('Folder name')} />
                  </span>
                  <span class="chips">
                    <For each={group.clues}>{(clue) => <span class="chip">{CLUES[clue]}</span>}</For>
                  </span>
                  <ul class="muted detail">
                    <For each={group.files}>{(file) => <li>{file.name}</li>}</For>
                  </ul>
                </li>
              )}
            </For>
          </ul>
        </>
      )}
    </EditDialog>
  );
}
