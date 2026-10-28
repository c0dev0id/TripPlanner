import { entryFileUrl, entryPreviewUrl } from '../api';
import type { Entry } from '../model/journal';
import type { Stop } from '../model/trip';
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

/** A stop drawn by its kind, in the colour of its binding, named beside it; its foot is the anchor. */
export function stopContent(stop: Stop): HTMLElement {
  return (
    <div class="stop" classList={{ free: stop.pointId === null }}>
      <StopShape kind={stop.kind} color={stop.pointId === null ? FREE_COLOR : BOUND_COLOR} foot />
      <span class="stop-name">{stop.name}</span>
    </div>
  ) as HTMLElement;
}

/** A photo as a small preview that opens the photo over the page, under the API base the page reads from. */
export function photoContent(photo: Entry, base: string): HTMLElement {
  const image = { src: entryFileUrl(base, photo.id), preview: entryPreviewUrl(base, photo.id), name: photo.file!.name };
  return (
    <a class="photo" href={image.src} target="_blank" rel="noopener" title={image.name} on:click={(e) => openImage(e, image)}>
      <img src={image.preview} alt={image.name} />
    </a>
  ) as HTMLElement;
}
