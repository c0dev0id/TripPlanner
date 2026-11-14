import { For } from 'solid-js';
import { plural, t } from '../i18n/t';
import { setTripSource, tripSource, type TripSource } from '../state/library';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';

/** The folder the last trip was made in, offered again: what is sorted out of a collection mostly goes to one place. */
let lastFolder = '';

/**
 * Asks what the trip made from a collection, or from sections of it, is called, which of
 * the folders that hold trips it goes into, and whether what it is made from leaves the
 * collection.
 */
export function TripFromDialog(props: { folders: readonly { id: number; path: string }[]; onCreate: (source: TripSource, name: string, folderId: number | null, move: boolean) => void }) {
  const submit = (form: FormData, source: TripSource) => {
    lastFolder = field(form, 'folder');
    props.onCreate(source, field(form, 'name'), lastFolder === '' ? null : Number(lastFolder), form.has('move'));
  };
  const title = (source: TripSource) => t(source.dayIds ? 'Create trip from selection' : 'Create trip from collection');
  return (
    <EditDialog label={t('Create trip')} value={tripSource()} title={title} onClose={() => setTripSource(undefined)} onSubmit={submit} submit={t('Create')}>
      {(source) => (
        <>
          <label>
            {t('Name')}
            <input name="name" value={source.name} placeholder={t('Name of the trip')} maxlength={200} required />
          </label>
          <label>
            {t('Folder')}
            <select name="folder" value={props.folders.some((f) => String(f.id) === lastFolder) ? lastFolder : ''}>
              <option value="">{t('No folder')}</option>
              <For each={props.folders}>{(f) => <option value={f.id}>{f.path}</option>}</For>
            </select>
          </label>
          <label class="toggle">
            <input type="checkbox" name="move" checked />{' '}
            {source.dayIds ? plural(source.dayIds.length, 'Take the section out of the collection|Take the {n} sections out of the collection') : t('Delete the collection once the trip is made')}
          </label>
        </>
      )}
    </EditDialog>
  );
}
