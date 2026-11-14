import { t } from '../i18n/t';
import { isRoutePinned, pinRoutes } from '../state/pins';
import { TackedIcon, TackIcon } from '../ui/icons';

/**
 * The pin of a route or a recording: pinned, it stays on the map while something else is
 * taken up; a click pins it or lets it go.
 */
export function Pin(props: { of: string; pinned: boolean; onToggle: (pinned: boolean) => void }) {
  const label = () => t(props.pinned ? 'Unpin {what} from the map' : 'Pin {what} to the map', { what: props.of });
  return (
    <button class="icon pin" aria-pressed={props.pinned} title={label()} aria-label={label()} onClick={() => props.onToggle(!props.pinned)}>
      {props.pinned ? <TackedIcon /> : <TackIcon />}
    </button>
  );
}

/** The pin of a route, named `of`. */
export function RoutePin(props: { id: string; of: string }) {
  return <Pin of={props.of} pinned={isRoutePinned(props.id)} onToggle={(pinned) => pinRoutes([props.id], pinned)} />;
}
