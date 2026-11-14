<?php

declare(strict_types=1);

namespace Planner\Recording;

/**
 * The days of trips that rides on no day may be of, to be put on them or declined: what
 * a lookup finds for a day among the rides that are on no day yet and were not declined
 * for it.
 */
final class Suggestions
{
    private readonly Lookup $lookup;

    /**
     * @param list<array{id: int, line: string, startedAt: ?string, days: list<array{dayId: string}>}> $rides as Recordings::rides gives them
     * @param array<string, list<int>> $declined the rides declined for a day, by the day's id
     * @param int $utcOffsetMinutes how far the user's clock is ahead of UTC, for the date a ride began on
     */
    public function __construct(array $rides, private readonly array $declined, int $utcOffsetMinutes)
    {
        $this->lookup = new Lookup($rides, $utcOffsetMinutes, fn (array $ride) => $ride['days'] === []);
    }

    /**
     * What is suggested for a day of a trip, the likeliest first.
     *
     * @param array{id: string, tripId: int, date: ?string, routes: list<array<string, mixed>>} $day
     * @return list<array{tripId: int, dayId: string, date: ?string, sameDate: bool, share: float, rideIds: list<int>}>
     */
    public function of(array $day): array
    {
        $suggestions = [];
        foreach ($this->lookup->of($day) as $found) {
            $rideIds = array_values(array_diff(array_column($found['rides'], 'id'), $this->declined[$day['id']] ?? []));
            if ($rideIds !== []) {
                $suggestions[] = ['tripId' => $day['tripId'], 'dayId' => $day['id'], 'date' => $found['date'], 'sameDate' => $found['sameDate'], 'share' => $found['share'], 'rideIds' => $rideIds];
            }
        }
        return $suggestions;
    }
}
