import { t } from '../i18n/t';
import { groupEye, routeEye, setGroupEye, setRouteEyes, type EyeGroup } from '../state/eyes';
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

/** The eye of a route, named `of`. */
export function RouteEye(props: { id: string; of: string }) {
  return <Eye of={props.of} open={routeEye(props.id)} veiled={!groupEye('routes')} onToggle={(open) => setRouteEyes([props.id], open)} />;
}

/** The eye of all the routes, or of all the recordings. */
export function GroupEye(props: { group: EyeGroup }) {
  return <Eye of={t(props.group === 'routes' ? 'the routes' : 'the recordings')} open={groupEye(props.group)} onToggle={(open) => setGroupEye(props.group, open)} />;
}
