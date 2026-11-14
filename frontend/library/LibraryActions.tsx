import { t } from '../i18n/t';
import { setShowingDuplicates, showingDuplicates, shownReport, showReport } from '../state/library';
import { placesListOpen, setPlacesListOpen } from '../state/places';
import { IconButton } from '../ui/IconButton';
import { ClockIcon, CopyIcon, PinIcon } from '../ui/icons';

/** The library's switches as icons: the duplicates report, the rides by when they were ridden, and the list of places to show on the map. What is made or imported is asked for in the tree, from the menu of the folder or trip it goes into. */
export function LibraryActions() {
  return (
    <div class="row library-actions" role="toolbar" aria-label={t('Library')}>
      <IconButton label={t('Routes kept more than once')} pressed={showingDuplicates()} onClick={() => setShowingDuplicates(!showingDuplicates())}>
        <CopyIcon />
      </IconButton>
      <IconButton label={t('Rides')} pressed={shownReport() === 'rides'} onClick={() => showReport((report) => (report === 'rides' ? undefined : 'rides'))}>
        <ClockIcon />
      </IconButton>
      <IconButton label={t('Places')} pressed={placesListOpen()} onClick={() => setPlacesListOpen(!placesListOpen())}>
        <PinIcon />
      </IconButton>
    </div>
  );
}
