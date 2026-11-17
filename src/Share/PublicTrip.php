<?php

declare(strict_types=1);

namespace Planner\Share;

use Planner\Journal\Entry;

/** What a visitor gets of a shared trip. Everything that is public is made here. */
final class PublicTrip
{
    /**
     * The trip's document without what is its owner's alone, a stop's contact and booking
     * reference, and with what its page shows besides the plan under `public`.
     *
     * @param array{journal: bool, gpx: bool, coverEntryId: ?int} $publication
     */
    public static function document(array $document, array $publication): array
    {
        foreach ($document['days'] as &$day) {
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
