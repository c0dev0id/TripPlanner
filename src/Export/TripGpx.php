<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;

/**
 * A trip document as GPX: every route as a track, or as a route of its points, named
 * after its day, and the stops of those routes as waypoints, however far beside their
 * route they stand; optional routes and stops are included or left out as the options
 * say. Where only some routes are asked for, the stops of the others are left out. Stops that routes share, alike in name, position and symbol, are
 * written once: a GPX file's waypoints are of none of its routes.
 */
final class TripGpx
{
    /** The whole trip in one file. */
    public static function trip(array $document, DateTimeImmutable $time, ExportOptions $options = new ExportOptions()): string
    {
        return self::file($document, array_keys($document['days']), $document['name'], $time, $options);
    }

    /** One day of the trip; `$index` is the day's position, counted from 0. Of its routes only those of `$routeIds`, where given. */
    public static function day(array $document, int $index, DateTimeImmutable $time, ExportOptions $options = new ExportOptions(), ?array $routeIds = null): string
    {
        return self::file($document, [$index], self::dayName($document, $index), $time, $options, $routeIds);
    }

    /** The days at `$indices` in one file named after the trip; of their routes only those of `$routeIds`, where given. */
    public static function days(array $document, array $indices, DateTimeImmutable $time, ExportOptions $options = new ExportOptions(), ?array $routeIds = null): string
    {
        return self::file($document, $indices, $document['name'], $time, $options, $routeIds);
    }

    /** The name of a day's file, without the extension. */
    public static function dayFileName(array $document, int $index): string
    {
        return self::fileName(self::dayName($document, $index));
    }

    /** The name of the file of one route of a day, without the extension: the day's, and where the day has other routes the route's as well. */
    public static function routeFileName(array $document, int $index, string $routeId): string
    {
        $routes = $document['days'][$index]['routes'];
        $position = array_search($routeId, array_column($routes, 'id'), true);
        $name = $routes[$position]['name'] === '' ? t('Route {n}', ['n' => $position + 1]) : $routes[$position]['name'];
        return self::fileName(self::dayName($document, $index) . (count($routes) > 1 ? ' – ' . $name : ''));
    }

    /** A name as part of a file name. */
    public static function fileName(string $name): string
    {
        $slug = trim(preg_replace('/[^\p{L}\p{N}._-]+/u', '-', $name), '-');
        return $slug === '' ? 'trip' : $slug;
    }

    private static function dayName(array $document, int $index): string
    {
        return $document['name'] . ' – ' . self::dayLabel($document['days'][$index], $index);
    }

    private static function file(array $document, array $indices, string $name, DateTimeImmutable $time, ExportOptions $options, ?array $routeIds = null): string
    {
        $included = fn (array $part): bool => $options->optional || !$part['optional'];
        $waypoints = [];
        $lines = [];
        foreach ($indices as $index) {
            $day = $document['days'][$index];
            $routes = array_values(array_filter($day['routes'], fn (array $route): bool => $included($route) && ($routeIds === null || in_array($route['id'], $routeIds, true))));
            $dayLabel = self::dayLabel($day, $index);
            $several = count($routes) > 1;
            foreach ($routes as $i => $route) {
                $label = $several ? $dayLabel . ' – ' . ($route['name'] === '' ? t('Route {n}', ['n' => $i + 1]) : $route['name']) : $dayLabel;
                $points = $options->form === 'routes' && $route['kind'] === 'routed' ? array_column($route['points'], 'lngLat') : RouteGeometry::line($route);
                $lines[] = ['name' => $label, 'points' => $points];
            }
            $routeIdsWritten = array_column($routes, 'id');
            foreach ($day['stops'] as $stop) {
                if ($included($stop) && in_array($stop['routeId'], $routeIdsWritten, true)) {
                    $waypoint = ['name' => $stop['name'], 'lngLat' => $stop['lngLat'], 'symbol' => $stop['symbol']];
                    $waypoints[json_encode($waypoint)] = $waypoint;
                }
            }
        }
        $waypoints = array_values($waypoints);
        return $options->form === 'routes' ? Gpx::document($name, $waypoints, $lines, [], $time) : Gpx::document($name, $waypoints, [], $lines, $time);
    }

    private static function dayLabel(array $day, int $index): string
    {
        $label = t('Day {n}', ['n' => $index + 1]);
        return $day['name'] === '' ? $label : "$label $day[name]";
    }
}
