<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;

/**
 * A trip document as GPX: the stops as waypoints and every route as a track, or as a
 * route of its points, named after its day. A free stop is included where a route of its
 * day passes within reach; optional routes and stops are included or left out as the
 * options say.
 */
final class TripGpx
{
    /** The whole trip in one file. */
    public static function trip(array $document, DateTimeImmutable $time, ExportOptions $options = new ExportOptions()): string
    {
        return self::file($document, array_keys($document['days']), $document['name'], $time, $options);
    }

    /** One day of the trip; `$index` is the day's position, counted from 0. */
    public static function day(array $document, int $index, DateTimeImmutable $time, ExportOptions $options = new ExportOptions()): string
    {
        return self::file($document, [$index], self::dayName($document, $index), $time, $options);
    }

    /** The name of a day's file, without the extension. */
    public static function dayFileName(array $document, int $index): string
    {
        return self::fileName(self::dayName($document, $index));
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

    private static function file(array $document, array $indices, string $name, DateTimeImmutable $time, ExportOptions $options): string
    {
        $included = fn (array $part): bool => $options->optional || !$part['optional'];
        $waypoints = [];
        $lines = [];
        foreach ($indices as $index) {
            $day = $document['days'][$index];
            $routes = array_values(array_filter($day['routes'], $included));
            // The routes' full lines, decoded once and only where they are needed: the tracks form, a track's points, and free stops.
            $dayLines = null;
            $linesOf = function () use (&$dayLines, $routes): array {
                return $dayLines ??= array_map(RouteGeometry::line(...), $routes);
            };
            $dayLabel = self::dayLabel($day, $index);
            $several = count($routes) > 1;
            foreach ($routes as $i => $route) {
                $label = $several ? $dayLabel . ' – ' . ($route['name'] === '' ? 'Route ' . ($i + 1) : $route['name']) : $dayLabel;
                $points = $options->form === 'routes' && $route['kind'] === 'routed' ? array_column($route['points'], 'lngLat') : $linesOf()[$i];
                $lines[] = ['name' => $label, 'points' => $points];
            }
            $pointIds = array_merge([], ...array_map(fn (array $route) => array_column($route['points'] ?? [], 'id'), $routes));
            foreach ($day['stops'] as $stop) {
                $bound = $stop['pointId'] !== null && in_array($stop['pointId'], $pointIds, true);
                if ($included($stop) && ($bound || self::nearALine($stop['lngLat'], $linesOf(), $options->reachM))) {
                    $waypoints[] = ['name' => $stop['name'], 'lngLat' => $stop['lngLat'], 'symbol' => $stop['symbol']];
                }
            }
        }
        return $options->form === 'routes' ? Gpx::document($name, $waypoints, $lines, [], $time) : Gpx::document($name, $waypoints, [], $lines, $time);
    }

    private static function nearALine(array $position, array $lines, int $reachM): bool
    {
        foreach ($lines as $line) {
            if (Proximity::toLine($position, $line) <= $reachM) {
                return true;
            }
        }
        return false;
    }

    private static function dayLabel(array $day, int $index): string
    {
        $label = 'Day ' . ($index + 1);
        return $day['name'] === '' ? $label : "$label $day[name]";
    }
}
