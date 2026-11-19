<?php

declare(strict_types=1);

namespace Planner\Share;

use Planner\Journal\Entry;

/** What a visitor gets of a shared trip. Everything that is public is made here. */
final class PublicTrip
{
    /** What a visitor gets of a stop, and of a journal entry. Whatever else they have, or come to have, is their owner's. */
    private const STOP = ['id', 'name', 'symbol', 'lngLat', 'routeId', 'pointId', 'address', 'website', 'notes', 'arriveAt', 'pauseMinutes', 'optional'];
    private const ENTRY = ['id', 'dayId', 'stopId', 'routeId', 'text', 'file', 'takenAt', 'lngLat', 'createdAt', 'position'];

    /**
     * The trip's document without what is its owner's alone: the routes and tracks the
     * page leaves out, with their stops, and of a stop all but what a visitor gets. With what its page shows besides the plan under `public`.
     *
     * @param array{journal: bool, gpx: bool, coverEntryId: ?int} $publication
     * @param list<string> $hiddenRouteIds
     */
    public static function document(array $document, array $publication, array $hiddenRouteIds): array
    {
        foreach ($document['days'] as &$day) {
            $hidden = array_filter($day['routes'], fn (array $route): bool => in_array($route['id'], $hiddenRouteIds, true));
            $routeIds = array_column($hidden, 'id');
            $day['routes'] = array_values(array_diff_key($day['routes'], $hidden));
            $day['stops'] = array_values(array_filter($day['stops'], fn (array $stop): bool => !in_array($stop['routeId'], $routeIds, true)));
            foreach ($day['stops'] as &$stop) {
                // The two a visitor never gets stay in the stop's shape, empty.
                $stop = array_intersect_key($stop, array_flip(self::STOP)) + ['contact' => '', 'bookingReference' => ''];
            }
        }
        unset($day, $stop);
        return $document + ['public' => ['journal' => $publication['journal'], 'gpx' => $publication['gpx'], 'coverEntryId' => $publication['coverEntryId']]];
    }

    /** A journal entry as a visitor gets it: without where its photo was taken, which need not be where the entry stands. */
    public static function entry(Entry $entry): array
    {
        return array_intersect_key(get_object_vars($entry), array_flip(self::ENTRY)) + ['takenLngLat' => null];
    }
}
