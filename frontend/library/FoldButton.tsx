import { t } from '../i18n/t';
import { autoFold, foldPanel, panelFolded, setAutoFold, sideBySide } from '../state/panel';
import { cardMenu } from '../ui/cardMenu';
import { MenuIcon } from '../ui/icons';

/**
 * The button that folds the library away to its strip and brings it back. Its menu
 * (right-click or a long press) says whether the library folds by itself for the pane
 * beside it, and turns that on and off; greyed out where the screen has no room for both
 * and it folds either way. While it folds by itself, the button bears an A.
 */
export function FoldButton() {
  const label = () => t(panelFolded() ? 'Show library' : 'Hide library');
  return (
    <button
      class="icon fold-button"
      classList={{ auto: autoFold() }}
      title={label()}
      aria-label={label()}
      aria-pressed={!panelFolded()}
      ref={(el) => cardMenu(el, () => [{ label: t('Fold automatically'), checked: autoFold() || !sideBySide(), disabled: !sideBySide(), run: () => setAutoFold(!autoFold()) }])}
      onClick={() => foldPanel(!panelFolded())}
    >
      <MenuIcon />
    </button>
  );
}
