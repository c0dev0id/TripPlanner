import { t } from '../i18n/t';
import { foldPanel, panelFolded } from '../state/panel';
import { IconButton } from '../ui/IconButton';
import { MenuIcon } from '../ui/icons';

/** The button that folds the library away to its strip and brings it back. */
export function FoldButton() {
  return (
    <IconButton label={t(panelFolded() ? 'Show library' : 'Hide library')} pressed={!panelFolded()} onClick={() => foldPanel(!panelFolded())}>
      <MenuIcon />
    </IconButton>
  );
}
