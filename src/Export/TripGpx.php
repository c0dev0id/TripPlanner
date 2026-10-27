<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;

/**
 * A trip document as GPX: the stops as waypoints and every route as a track named after
 * its day. A free stop is included where a route of its day passes within reach.
 */
final class TripGpx
{
    /** How far from a route a free stop may stand to be exported, in metres. */
    public const FREE_STOP_REACH_M = 2000;

    /** The whole trip in one file. */
    public static function trip(array $document, DateTimeImmutable $time): string
    {
        return self::file($document, array_keys($document['days']), $document['name'], $time);
    }

    /** One day of the trip; `$index` is the day's position, counted from 0. */
    public static function day(array $document, int $index, DateTimeImmutable $time): string
    {
        return self::file($document, [$index], self::dayName($document, $index), $time);
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

    private static function file(array $document, array $indices, string $name, DateTimeImmutable $time): string
    {
        $waypoints = [];
        $tracks = [];
        foreach ($indices as $index) {
            $day = $document['days'][$index];
            $lines = array_map(RouteGeometry::line(...), $day['routes']);
            $dayLabel = self::dayLabel($day, $index);
            $several = count($day['routes']) > 1;
            foreach ($day['routes'] as $i => $route) {
                $label = $several ? $dayLabel . ' – ' . ($route['name'] === '' ? 'Route ' . ($i + 1) : $route['name']) : $dayLabel;
                $tracks[] = ['name' => $label, 'points' => $lines[$i]];
            }
            foreach ($day['stops'] as $stop) {
                if ($stop['pointId'] !== null || self::nearARoute($stop['lngLat'], $lines)) {
                    $waypoints[] = ['name' => $stop['name'], 'lngLat' => $stop['lngLat'], 'type' => $stop['kind']];
                }
            }
        }
        return Gpx::document($name, $waypoints, $tracks, $time);
    }

    private static function nearARoute(array $position, array $lines): bool
    {
        foreach ($lines as $line) {
            if (Proximity::toLine($position, $line) <= self::FREE_STOP_REACH_M) {
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
