import { createSignal, For, Show } from 'solid-js';
import { t } from '../i18n/t';
import { mediaFileUrl, mediaPreviewUrl } from '../api';
import type { Entry } from '../model/journal';
import { mediaDetail, mediaName, mediaOpens } from '../model/media';
import type { Day } from '../model/trip';
import { webAddress } from '../poi/details';
import { copyMedia, isCutMedia } from '../state/clipboard';
import { addFiles, addLink, mediaAction, mediaById, mediaNote, mediaOf, moveToDay, removeMedia, renameMedia } from '../state/media';
import { clearPartSelection, clickPart, isPartSelected, partsOfMenu, togglePart } from '../state/partSelection';
import { cardMenu } from '../ui/cardMenu';
import { askConfirmation } from '../ui/confirm';
import { EditDialog } from '../ui/EditDialog';
import { field } from '../ui/form';
import { counted } from '../ui/format';
import { IconButton } from '../ui/IconButton';
import { FileIcon, LinkIcon, PhotoIcon, PlusIcon } from '../ui/icons';
import { openDocument, openImage } from '../ui/Lightbox';
import type { MenuItem } from '../ui/menu';
import { MenuButton } from '../ui/MenuButton';
import { NameDialog } from '../ui/NameDialog';
import { pickFiles } from '../ui/pickFile';
import { moveToDayItem } from './partMenu';

/** Puts files and links of days of the open trip on the clipboard: cut, to be moved where they are pasted. */
export function clipMedia(chosen: readonly Entry[], move: boolean): void {
  const [first] = chosen;
  if (first) copyMedia({ tripId: first.tripId, ids: chosen.map((m) => m.id), names: chosen.map(mediaName), move });
}

/** Deletes files and links of a day of the open trip, once the user agrees. */
export async function deleteMediaAsked(chosen: readonly Entry[]): Promise<void> {
  const [first] = chosen;
  if (!first) return;
  const question = chosen.length > 1 ? t('Delete {what}?', { what: counted(chosen.length, 'attachment') }) : t('Delete “{name}”?', { name: mediaName(first) });
  if (!(await askConfirmation(question, t('Delete')))) return;
  await mediaAction(first.dayId!, async () => {
    await removeMedia(chosen);
    clearPartSelection();
  });
}

/**
 * The opened day's additional media: the files and links kept with it, a row each. Files
 * are added with the plus, as many as are picked, a link with its own button.
 */
export function DayMedia(props: { day: Day }) {
  /** The link whose dialog is open: one being edited, or true for a new one. */
  const [linked, setLinked] = createSignal<Entry | true>();
  const [renamed, setRenamed] = createSignal<Entry>();
  const act = (job: () => Promise<void>) => void mediaAction(props.day.id, job);
  const addPicked = () => void pickFiles({}).then((files) => files.length > 0 && act(() => addFiles(props.day.id, files)));
  const saveLink = (form: FormData, link: Entry | true) => {
    const url = webAddress(field(form, 'url'));
    if (!url) return;
    act(() => (link === true ? addLink(props.day.id, field(form, 'name'), url) : renameMedia(link, field(form, 'name'), url)));
  };
  return (
    <>
      <div class="row">
        <h4 class="grow">{t('Additional Media')}</h4>
        <IconButton label={t('Add link…')} onClick={() => setLinked(true)}>
          <LinkIcon />
        </IconButton>
        <IconButton label={t('Add files…')} onClick={addPicked}>
          <PlusIcon />
        </IconButton>
      </div>
      <ul class="media">
        <For each={mediaOf(props.day.id)}>{(entry) => <MediaItem entry={entry} onEdit={(m) => (m.url === null ? setRenamed(m) : setLinked(m))} />}</For>
      </ul>
      <Show when={mediaNote(props.day.id)}>{(note) => <p class="hint error">{note().text}</p>}</Show>
      <EditDialog label={t('Link')} value={linked()} title={(link) => t(link === true ? 'Add link' : 'Edit link')} onClose={() => setLinked(undefined)} onSubmit={saveLink} submit={t('Save')}>
        {(link) => (
          <>
            <label>
              {t('Name')}
              <input name="name" value={link === true ? '' : link.text} maxlength={200} required />
            </label>
            <label>
              {t('Address')}
              <input name="url" inputmode="url" value={link === true ? '' : (link.url ?? '')} placeholder="https://" maxlength={2000} pattern="\s*(https?://\S+|[\w\-]+(\.[\w\-]+)+(/\S*)?)\s*" title={t('An address of the web')} required />
            </label>
          </>
        )}
      </EditDialog>
      <NameDialog
        title={t('Rename file')}
        open={renamed() !== undefined}
        placeholder={renamed()?.file?.name ?? ''}
        initial={renamed() && mediaName(renamed()!)}
        onClose={() => setRenamed(undefined)}
        onSubmit={(name) => act(() => renameMedia(renamed()!, name))}
      />
    </>
  );
}

/**
 * The menu of a file or a link, or of the selected ones it is one of: rename or edit,
 * cut, copy, move to another day, select, delete. What takes one alone is greyed out
 * for several.
 */
function mediaMenu(entry: Entry, onEdit: (entry: Entry) => void): MenuItem[] {
  const chosen = partsOfMenu('media', String(entry.id)).flatMap((id) => mediaById(Number(id)) ?? []);
  const several = chosen.length > 1;
  const move = (to: string) =>
    void mediaAction(entry.dayId!, async () => {
      await moveToDay(chosen, to);
      clearPartSelection();
    });
  return [
    ...(several ? [{ label: t('{what} selected', { what: counted(chosen.length, 'attachment') }), disabled: true, run: () => undefined }] : []),
    { label: t(entry.url === null ? 'Rename…' : 'Edit…'), disabled: several, run: () => onEdit(entry) },
    { label: t('Cut'), run: () => clipMedia(chosen, true) },
    { label: t('Copy'), run: () => clipMedia(chosen, false) },
    ...moveToDayItem(entry.dayId!, move),
    ...(several || isPartSelected('media', String(entry.id)) ? [] : [{ label: t('Select'), run: () => togglePart('media', String(entry.id)) }]),
    { label: t('Delete'), run: () => void deleteMediaAsked(chosen) },
  ];
}

/**
 * A file or a link as a row: what it is, its name over its size or its address. A click
 * opens an image or a PDF over the page, a link in a new tab, and downloads any other
 * file; with Cmd, Ctrl or Shift it selects; its menu is mediaMenu.
 */
function MediaItem(props: { entry: Entry; onEdit: (entry: Entry) => void }) {
  const id = () => String(props.entry.id);
  const name = () => mediaName(props.entry);
  const opens = () => mediaOpens(props.entry);
  const href = () => props.entry.url ?? mediaFileUrl(props.entry.tripId, props.entry.id);
  const click = (e: MouseEvent) => {
    if (clickPart('media', mediaOf(props.entry.dayId!).map((m) => String(m.id)), id(), e)) return e.preventDefault();
    if (opens() === 'image') openImage(e, { src: href(), preview: mediaPreviewUrl(props.entry.tripId, props.entry.id), name: name() });
    else if (opens() === 'pdf') openDocument(e, { src: href(), name: name() });
  };
  return (
    <li class="media-item" classList={{ picked: isPartSelected('media', id()), cut: isCutMedia(props.entry.id) }} ref={(el) => cardMenu(el, () => mediaMenu(props.entry, props.onEdit))}>
      <div class="row">
        <a class="text grow" href={href()} target="_blank" rel="noopener noreferrer" download={opens() === 'download' ? props.entry.file!.name : undefined} onClick={click}>
          <span class="media-kind">{opens() === 'link' ? <LinkIcon /> : opens() === 'image' ? <PhotoIcon /> : <FileIcon />}</span>
          <span class="lines grow">
            <span class="name">{name()}</span>
            <span class="muted detail">{mediaDetail(props.entry)}</span>
          </span>
        </a>
        <MenuButton of={name()} items={() => mediaMenu(props.entry, props.onEdit)} />
      </div>
    </li>
  );
}
