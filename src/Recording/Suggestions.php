<?php

declare(strict_types=1);

namespace Planner\Recording;

/**
 * The days of trips that rides on no day may be of, to be put on them or declined: what
 * a lookup finds for each of the days among the rides that are on no day yet and were
 * not declined for it.
 */
final class Suggestions
{
    /**
     * @param iterable<array{id: string, tripId: int, date: ?string, routes: list<array<string, mixed>>}> $days the days of the user's trips
     * @param list<array{id: int, line: string, startedAt: ?string, days: list<array{dayId: string}>}> $rides as Recordings::rides gives them
     * @param array<string, list<int>> $declined the rides declined for a day, by the day's id
     * @param int $utcOffsetMinutes how far the user's clock is ahead of UTC, for the date a ride began on
     * @return list<array{tripId: int, dayId: string, date: ?string, sameDate: bool, share: float, rideIds: list<int>}> those of a day's date first, then the nearest
     */
    public static function of(iterable $days, array $rides, array $declined, int $utcOffsetMinutes): array
    {
        $lookup = new Lookup($rides, $utcOffsetMinutes);
        $suggestions = [];
        foreach ($days as $day) {
            foreach ($lookup->of($day) as $found) {
                $free = array_filter($found['rides'], fn (array $ride) => $ride['days'] === [] && !in_array($ride['id'], $declined[$day['id']] ?? [], true));
                if ($free !== []) {
                    $suggestions[] = ['tripId' => $day['tripId'], 'dayId' => $day['id'], 'date' => $found['date'], 'sameDate' => $found['sameDate'], 'share' => $found['share'], 'rideIds' => array_column($free, 'id')];
                }
            }
        }
        usort($suggestions, fn (array $a, array $b) => [$b['sameDate'], $b['share']] <=> [$a['sameDate'], $a['share']]);
        return $suggestions;
    }
}
