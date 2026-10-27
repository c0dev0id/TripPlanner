<?php

declare(strict_types=1);

namespace Planner\Trip;

/** A trip document as a copy: every day, route, point and stop under a new id, bound stops following their points. */
final class TripCopy
{
    public static function withNewIds(array $document): array
    {
        $days = [];
        foreach ($document['days'] as $day) {
            $pointIds = [];
            $routes = [];
            foreach ($day['routes'] as $route) {
                $points = [];
                foreach ($route['points'] as $point) {
                    $pointIds[$point['id']] = self::id();
                    $points[] = ['id' => $pointIds[$point['id']]] + $point;
                }
                $routes[] = ['id' => self::id(), 'points' => $points] + $route;
            }
            $stops = [];
            foreach ($day['stops'] as $stop) {
                $stops[] = ['id' => self::id(), 'pointId' => $stop['pointId'] === null ? null : $pointIds[$stop['pointId']]] + $stop;
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
