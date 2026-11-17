<?php

declare(strict_types=1);

namespace Planner\Share;

use Planner\Journal\Entry;

/** What a visitor gets of a shared trip. Everything that is public is made here. */
final class PublicTrip
{
    /**
     * The trip's document without what is its owner's alone: the routes and tracks the
     * page leaves out, with the stops bound to them, and a stop's contact and booking
     * reference. With what its page shows besides the plan under `public`.
     *
     * @param array{journal: bool, gpx: bool, coverEntryId: ?int, hiddenRouteIds: list<string>} $publication
     */
    public static function document(array $document, array $publication): array
    {
        foreach ($document['days'] as &$day) {
            $hidden = array_filter($day['routes'], fn (array $route): bool => in_array($route['id'], $publication['hiddenRouteIds'], true));
            $pointIds = array_merge([], ...array_map(fn (array $route) => array_column($route['points'] ?? [], 'id'), array_values($hidden)));
            $day['routes'] = array_values(array_diff_key($day['routes'], $hidden));
            $day['stops'] = array_values(array_filter($day['stops'], fn (array $stop): bool => !in_array($stop['pointId'], $pointIds, true)));
            foreach ($day['stops'] as &$stop) {
                $stop['contact'] = '';
                $stop['bookingReference'] = '';
            }
        }
        unset($day, $stop);
        return $document + ['public' => ['journal' => $publication['journal'], 'gpx' => $publication['gpx'], 'coverEntryId' => $publication['coverEntryId']]];
    }

    /** A journal entry without where its photo was taken, which need not be where the entry stands. */
    public static function entry(Entry $entry): array
    {
        return ['takenLngLat' => null] + get_object_vars($entry);
    }
}
