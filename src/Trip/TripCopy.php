<?php

declare(strict_types=1);

namespace Planner\Trip;

/** A trip document as a copy: every day, route, point of a routed route and stop under a new id, the stops following their routes and points. */
final class TripCopy
{
    public static function withNewIds(array $document): array
    {
        $days = [];
        foreach ($document['days'] as $day) {
            $ids = [];
            $routes = [];
            foreach ($day['routes'] as $route) {
                $ids[$route['id']] = self::id();
                if ($route['kind'] === 'track') {
                    $routes[] = ['id' => $ids[$route['id']]] + $route;
                    continue;
                }
                $points = [];
                foreach ($route['points'] as $point) {
                    $ids[$point['id']] = self::id();
                    $points[] = ['id' => $ids[$point['id']]] + $point;
                }
                $routes[] = ['id' => $ids[$route['id']], 'points' => $points] + $route;
            }
            $stops = [];
            foreach ($day['stops'] as $stop) {
                $stops[] = ['id' => self::id(), 'routeId' => $stop['routeId'] === null ? null : $ids[$stop['routeId']], 'pointId' => $stop['pointId'] === null ? null : $ids[$stop['pointId']]] + $stop;
            }
            $days[] = ['id' => self::id(), 'routes' => $routes, 'stops' => $stops] + $day;
        }
        return ['days' => $days] + $document;
    }

    private static function id(): string
    {
        return bin2hex(random_bytes(16));
    }
}
