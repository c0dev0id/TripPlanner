<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;

/**
 * A trip document as GPX: the places of its stops as waypoints, once each, and every
 * route as a track named after its day and the stops it joins.
 */
final class TripGpx
{
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
        $places = array_column($document['places'], null, 'id');
        $waypoints = [];
        $tracks = [];
        foreach ($indices as $index) {
            $day = $document['days'][$index];
            foreach ($day['stops'] as $stop) {
                $place = $places[$stop['placeId']];
                $waypoints[$place['id']] ??= ['name' => $place['name'], 'lngLat' => $place['lngLat'], 'type' => $place['kind']];
            }
            foreach ($day['routes'] as $i => $route) {
                $from = $places[$day['stops'][$i]['placeId']]['name'];
                $to = $places[$day['stops'][$i + 1]['placeId']]['name'];
                $tracks[] = ['name' => self::dayLabel($day, $index) . ': ' . $from . ' – ' . $to, 'points' => RouteGeometry::line($route)];
            }
        }
        return Gpx::document($name, array_values($waypoints), $tracks, $time);
    }

    private static function dayLabel(array $day, int $index): string
    {
        $label = 'Day ' . ($index + 1);
        return $day['name'] === '' ? $label : "$label $day[name]";
    }
}
