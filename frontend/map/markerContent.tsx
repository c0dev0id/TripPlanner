import { Show, type JSX } from 'solid-js';
import { t } from '../i18n/t';
import { entryImageUrl } from '../api';
import { entryTitle, type Entry } from '../model/journal';
import type { Stop } from '../model/trip';
import { NotebookIcon } from '../ui/icons';
import { openImage } from '../ui/Lightbox';
import { StopShape } from '../ui/StopShape';
import { BOUND_COLOR, FREE_COLOR } from '../model/routeLook';

/** What stands inside a marker, in the planner and on the read-only page alike. */

/** A marker's root element, which MapLibre owns (it sets transform, opacity and pointer-events), around the content. */
export function markerElement(className: string, content: Node): HTMLDivElement {
  const root = document.createElement('div');
  root.className = className;
  root.append(content);
  return root;
}

/**
 * A stop drawn by its kind, in the colour of its binding, named beside it; its foot is the
 * anchor. A place of a list is drawn as its kind's look (`mark`), centred on its spot.
 * Follows the stop as it changes.
 */
export function stopContent(stop: () => Stop, mark?: () => JSX.Element): HTMLElement {
  return (
    <div class="stop" classList={{ free: stop().pointId === null, marked: mark !== undefined }}>
      <Show when={mark} fallback={<StopShape symbol={stop().symbol} color={stop().pointId === null ? FREE_COLOR : BOUND_COLOR} foot />}>
        {(own) => own()()}
      </Show>
      <span class="stop-name">{stop().name}</span>
    </div>
  ) as HTMLElement;
}

/**
 * A journal entry's marker element, under the API base the page reads from: a photo
 * small and called by its note, anything else as a journal icon that says what the entry is. A click runs what
 * `on` has for it; without that a photo opens large over the page and a note does nothing.
 */
export function entryMarkerElement(entry: Entry, base: string, on: { photo?: () => void; note?: () => void } = {}): HTMLDivElement {
  const open = on.note;
  if (entry.file?.image) {
    const image = { src: entryImageUrl(base, entry, 2048), preview: entryImageUrl(base, entry, 400), name: entry.file.name };
    const click = (e: MouseEvent) => {
      if (!on.photo) return openImage(e, image);
      e.preventDefault();
      on.photo();
    };
    const photo = (
      <a class="photo" href={image.src} target="_blank" rel="noopener" title={entry.text ? entryTitle(entry) : undefined} on:click={click}>
        <img src={image.preview} alt={entry.text ? entryTitle(entry) : t('Photo')} />
      </a>
    ) as HTMLElement;
    return markerElement('photo-marker', photo);
  }
  const note = (
    <span class="note" role={open && 'button'} title={entryTitle(entry)}>
      <NotebookIcon />
    </span>
  ) as HTMLElement;
  if (open) note.addEventListener('click', open);
  return markerElement('note-marker', note);
}
