import type { Route, RoutedRoute } from '../model/trip';

/** The route as the routed route a test knows it to be; throws for a track. */
export function routedOf(route: Route): RoutedRoute {
  if (route.kind !== 'routed') throw new Error(`${route.id} is a track`);
  return route;
}
