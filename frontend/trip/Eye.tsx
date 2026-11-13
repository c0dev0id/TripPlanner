import { t } from '../i18n/t';
import { EyeIcon, EyeOffIcon } from '../ui/icons';

/**
 * The eye of a route, a recording or a group of them: open while it is on the map, and a
 * click opens or closes it. `veiled` is an open eye whose group's eye is closed, so that
 * the thing is off the map all the same.
 */
export function Eye(props: { of: string; open: boolean; veiled?: boolean; onToggle: (open: boolean) => void }) {
  const label = () => t(props.open ? 'Take {what} off the map' : 'Put {what} on the map', { what: props.of });
  return (
    <button class="icon eye" classList={{ veiled: props.veiled }} aria-pressed={props.open} title={label()} aria-label={label()} onClick={() => props.onToggle(!props.open)}>
      {props.open ? <EyeIcon /> : <EyeOffIcon />}
    </button>
  );
}
