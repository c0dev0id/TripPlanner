import { entryFileUrl, entryPreviewUrl } from '../api';
import { entryTitle, type Entry } from '../model/journal';
import type { Stop } from '../model/trip';
import { NotebookIcon } from '../ui/icons';
import { openImage } from '../ui/Lightbox';
import { StopShape } from '../ui/StopShape';
import { BOUND_COLOR, FREE_COLOR } from './routeOverlay';

/** What stands inside a marker, in the planner and on the read-only page alike. */

/** A marker's root element, which MapLibre owns (it sets transform, opacity and pointer-events), around the content. */
export function markerElement(className: string, content: Node): HTMLDivElement {
  const root = document.createElement('div');
  root.className = className;
  root.append(content);
  return root;
}

/** A stop drawn by its kind, in the colour of its binding, named beside it; its foot is the anchor. Follows the stop as it changes. */
export function stopContent(stop: () => Stop): HTMLElement {
  return (
    <div class="stop" classList={{ free: stop().pointId === null }}>
      <StopShape kind={stop().kind} color={stop().pointId === null ? FREE_COLOR : BOUND_COLOR} foot />
      <span class="stop-name">{stop().name}</span>
    </div>
  ) as HTMLElement;
}

/**
 * A journal entry's marker element: a photo as a small preview that opens it over the page,
 * under the API base the page reads from; anything else as a journal icon that says what
 * the entry is and runs `open` on a click, where given.
 */
export function entryMarkerElement(entry: Entry, base: string, open?: () => void): HTMLDivElement {
  if (entry.file?.image) {
    const image = { src: entryFileUrl(base, entry.id), preview: entryPreviewUrl(base, entry.id), name: entry.file.name };
    const photo = (
      <a class="photo" href={image.src} target="_blank" rel="noopener" title={image.name} on:click={(e) => openImage(e, image)}>
        <img src={image.preview} alt={image.name} />
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
