<?php

declare(strict_types=1);

namespace Planner\Trip;

/**
 * The days of trips merged into another, placed as an import of their files would place
 * them: in a trip a day joins the day of its date, its routes and stops after that day's,
 * or goes in among the dated days as a day of its own; an undated day, and every section
 * of a collection, goes at the end. Every part keeps its id.
 */
final class TripMerge
{
    /**
     * @param array[] $into the days of the trip merged into
     * @param array[] $from the days of the trips merged into it, in order
     * @return array{days: array[], joined: array<string, string>} the merged days, and the id of each day that joined another with the id of that other
     */
    public static function days(string $kind, array $into, array $from): array
    {
        $days = $into;
        $joined = [];
        foreach ($from as $day) {
            $date = $kind === 'collection' ? null : $day['date'];
            $same = $date === null ? false : array_search($date, array_column($days, 'date'), true);
            if ($same !== false) {
                $days[$same] = self::joined($days[$same], $day);
                $joined[$day['id']] = $days[$same]['id'];
                continue;
            }
            array_splice($days, self::placeFor($days, $date), 0, [$day]);
        }
        return ['days' => $days, 'joined' => $joined];
    }

    /** Where a day of the date goes among the days: before the first of a later date; at the end where none is later, or for no date. */
    private static function placeFor(array $days, ?string $date): int
    {
        foreach ($date === null ? [] : $days as $i => $day) {
            if ($day['date'] !== null && $day['date'] > $date) {
                return $i;
            }
        }
        return count($days);
    }

    /** The day with the other day's routes and stops after its own, its name where it has none, and both notes, cut to what a document may hold. */
    private static function joined(array $day, array $other): array
    {
        $notes = implode("\n\n", array_filter([$day['notes'], $other['notes']], fn (string $n) => $n !== ''));
        return [
            'name' => $day['name'] !== '' ? $day['name'] : $other['name'],
            'notes' => mb_substr($notes, 0, TripDocumentValidator::MAX_TEXT),
            'routes' => [...$day['routes'], ...$other['routes']],
            'stops' => [...$day['stops'], ...$other['stops']],
        ] + $day;
    }
}
