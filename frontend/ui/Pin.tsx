import { t } from '../i18n/t';
import { TackedIcon, TackIcon } from './icons';
import type { MenuItem } from './menu';

/**
 * The pin of a row whose thing the map draws: pinned, it stays on the map while
 * something else is taken up; a click pins it or lets it go.
 */
export function Pin(props: { of: string; pinned: boolean; onToggle: (pinned: boolean) => void }) {
  const label = () => t(props.pinned ? 'Unpin {what} from the map' : 'Pin {what} to the map', { what: props.of });
  return (
    <button class="icon pin" aria-pressed={props.pinned} title={label()} aria-label={label()} onClick={() => props.onToggle(!props.pinned)}>
      {props.pinned ? <TackedIcon /> : <TackIcon />}
    </button>
  );
}

/** The menu items that pin what is selected to the map and let go of it, which `pin` does. */
export function pinItems(pin: (pinned: boolean) => void): MenuItem[] {
  return [
    { label: t('Pin selected to the map'), run: () => pin(true) },
    { label: t('Unpin selected'), run: () => pin(false) },
  ];
}
