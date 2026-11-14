<?php

declare(strict_types=1);

namespace Planner\Tests\Recording;

use PHPUnit\Framework\TestCase;
use Planner\Export\Polyline;
use Planner\Recording\Suggestions;
use Planner\Tests\Trip\TripFixture;

final class SuggestionsTest extends TestCase
{
    /** The fixture's route, from [11.5, 48.1] by [11.45, 47.8] to [11.4, 47.3]. */
    private const ALONG = [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]];
    private const ELSEWHERE = [[9.5, 46.1], [9.4, 46.3]];

    public function testSuggestsTheDaysOfTripsForRidesOnNoDay(): void
    {
        $day = TripFixture::document()['days'][0];
        $days = [
            ['id' => 'a1', 'tripId' => 1, 'date' => '2027-06-12', 'routes' => $day['routes']],
            ['id' => 'b1', 'tripId' => 2, 'date' => '2027-06-20', 'routes' => []],
        ];
        $rides = [
            self::ride(1, self::ALONG, '2026-05-01T08:00:00Z'),
            self::ride(2, self::ELSEWHERE, '2027-06-20T08:00:00Z'),
            self::ride(3, self::ALONG, '2026-05-02T08:00:00Z', [['dayId' => 'somewhere']]),
            self::ride(4, self::ELSEWHERE, '2027-07-01T08:00:00Z'),
        ];
        self::assertSame([
            ['tripId' => 2, 'dayId' => 'b1', 'date' => '2027-06-20', 'sameDate' => true, 'share' => 0.0, 'rideIds' => [2]],
            ['tripId' => 1, 'dayId' => 'a1', 'date' => '2026-05-01', 'sameDate' => false, 'share' => 1.0, 'rideIds' => [1]],
        ], Suggestions::of($days, $rides, [], 0));
    }

    public function testLeavesOutWhatWasDeclinedForADay(): void
    {
        $day = TripFixture::document()['days'][0];
        $days = [['id' => 'a1', 'tripId' => 1, 'date' => null, 'routes' => $day['routes']], ['id' => 'a2', 'tripId' => 1, 'date' => null, 'routes' => $day['routes']]];
        $rides = [self::ride(1, self::ALONG, '2026-05-01T08:00:00Z'), self::ride(2, self::ALONG, '2026-05-01T12:00:00Z')];
        $found = Suggestions::of($days, $rides, ['a1' => [1, 2], 'a2' => [2]], 0);
        self::assertSame([['a2', [1]]], array_map(fn (array $s) => [$s['dayId'], $s['rideIds']], $found));
    }

    private static function ride(int $id, array $line, string $startedAt, array $days = []): array
    {
        return ['id' => $id, 'line' => Polyline::encode($line), 'distanceM' => 0, 'startedAt' => $startedAt, 'days' => $days];
    }
}
