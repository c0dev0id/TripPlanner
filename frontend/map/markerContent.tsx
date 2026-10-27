import { entryFileUrl, entryPreviewUrl } from '../api';
import type { Entry } from '../model/journal';
import type { Stop } from '../model/trip';
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

/** A photo as a small preview that opens the photo, under the API base the page reads from. */
export function photoContent(photo: Entry, base: string): HTMLElement {
  return (
    <a class="photo" href={entryFileUrl(base, photo.id)} target="_blank" rel="noopener" title={photo.file!.name}>
      <img src={entryPreviewUrl(base, photo.id)} alt={photo.file!.name} />
    </a>
  ) as HTMLElement;
}
