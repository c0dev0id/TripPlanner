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
        return self::file($document, $document['days'], $document['name'], $time);
    }

    /** One day of the trip; `$index` is the day's position, counted from 0. */
    public static function day(array $document, int $index, DateTimeImmutable $time): string
    {
        $day = $document['days'][$index];
        return self::file($document, [$day], $document['name'] . ' – ' . self::dayLabel($day, $index), $time);
    }

    /** The name of a day's file, without the extension. */
    public static function dayFileName(array $document, int $index): string
    {
        return self::fileName($document['name'] . ' ' . self::dayLabel($document['days'][$index], $index));
    }

    /** A name as part of a file name. */
    public static function fileName(string $name): string
    {
        $slug = trim(preg_replace('/[^\p{L}\p{N}._-]+/u', '-', $name), '-');
        return $slug === '' ? 'trip' : $slug;
    }

    private static function file(array $document, array $days, string $name, DateTimeImmutable $time): string
    {
        $places = array_column($document['places'], null, 'id');
        $waypoints = [];
        $tracks = [];
        foreach ($days as $day) {
            $index = array_search($day['id'], array_column($document['days'], 'id'), true);
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
