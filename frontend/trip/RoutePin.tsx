import { isRoutePinned, pinRoutes } from '../state/pins';
import { Pin } from '../ui/Pin';

/** The pin of a route, named `of`. */
export function RoutePin(props: { id: string; of: string }) {
  return <Pin of={props.of} pinned={isRoutePinned(props.id)} onToggle={(pinned) => pinRoutes([props.id], pinned)} />;
}
