import { t } from '../i18n/t';
import { setShowingDuplicates, showingDuplicates } from '../state/pane';
import { IconButton } from '../ui/IconButton';
import { CopyIcon } from '../ui/icons';

/** The library's switches as icons: the duplicates report. What is made or imported is asked for in a tab, from its menu or that of the folder or trip it goes into. */
export function LibraryActions() {
  return (
    <div class="row library-actions" role="toolbar" aria-label={t('Library')}>
      <IconButton label={t('Routes kept more than once')} pressed={showingDuplicates()} onClick={() => setShowingDuplicates(!showingDuplicates())}>
        <CopyIcon />
      </IconButton>
    </div>
  );
}
