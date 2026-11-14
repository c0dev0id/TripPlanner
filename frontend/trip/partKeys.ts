import { copyParts, pasteItems } from '../state/clipboard';
import { selectedParts } from '../state/partSelection';
import { mediaById } from '../state/media';
import { recordingsAmong } from '../state/recordings';
import { editingRouteId, openTrip, selectedDayId } from '../state/trip';
import { fileVerb } from '../ui/fileVerb';
import { selectionOwner } from '../ui/selection';
import { clipMedia, deleteMediaAsked } from './Media';
import { removeAsked } from './partMenu';
import { clipRecordings, takeRecordingsOff } from './Recordings';

/**
 * The keys that cut, copy, paste and delete in the open trip, as its menus do. Cut, copy
 * and delete act on the selected days, routes, stops, recordings or media, where delete
 * takes a recording off its day; with nothing
 * selected in any list, cut and copy take the route being edited. Paste goes into the route being
 * edited where it takes what was copied, else into the day picked.
 */
export function partKeys(e: KeyboardEvent): void {
  const verb = openTrip() && fileVerb(e);
  if (!verb) return;
  if (verb === 'paste') {
    const route = editingRouteId();
    const day = selectedDayId();
    const [paste] = [...(route ? pasteItems('route', route) : []), ...(day ? pasteItems('day', day) : [])];
    if (!paste || !('run' in paste)) return;
    e.preventDefault();
    paste.run();
    return;
  }
  const edited = editingRouteId();
  const chosen = selectedParts() ?? (verb !== 'delete' && edited && !selectionOwner() ? { kind: 'route' as const, ids: [edited] } : undefined);
  if (!chosen) return;
  e.preventDefault();
  if (chosen.kind === 'recording') {
    const recordings = recordingsAmong(selectedDayId() ?? '', chosen.ids);
    if (verb === 'delete') void takeRecordingsOff(recordings);
    else clipRecordings(recordings, verb === 'cut');
  } else if (chosen.kind === 'media') {
    const media = chosen.ids.flatMap((id) => mediaById(Number(id)) ?? []);
    if (verb === 'delete') void deleteMediaAsked(media);
    else clipMedia(media, verb === 'cut');
  } else if (verb === 'delete') void removeAsked(chosen.kind, chosen.ids);
  else copyParts(chosen.kind, chosen.ids, verb === 'cut');
}
