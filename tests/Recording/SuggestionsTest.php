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

    public function testSuggestsADayOfATripForRidesOnNoDay(): void
    {
        $day = TripFixture::document()['days'][0];
        $suggestions = new Suggestions([
            self::ride(1, self::ALONG, '2026-05-01T08:00:00Z'),
            self::ride(2, self::ELSEWHERE, '2027-06-20T08:00:00Z'),
            self::ride(3, self::ALONG, '2026-05-02T08:00:00Z', [['dayId' => 'somewhere']]),
            self::ride(4, self::ELSEWHERE, '2027-07-01T08:00:00Z'),
        ], [], 0);
        self::assertSame(
            [['tripId' => 1, 'dayId' => 'a1', 'date' => '2026-05-01', 'sameDate' => false, 'share' => 1.0, 'rideIds' => [1]]],
            $suggestions->of(['id' => 'a1', 'tripId' => 1, 'date' => '2027-06-12', 'routes' => $day['routes']]),
        );
        self::assertSame(
            [['tripId' => 2, 'dayId' => 'b1', 'date' => '2027-06-20', 'sameDate' => true, 'share' => 0.0, 'rideIds' => [2]]],
            $suggestions->of(['id' => 'b1', 'tripId' => 2, 'date' => '2027-06-20', 'routes' => []]),
        );
    }

    public function testLeavesOutWhatWasDeclinedForADay(): void
    {
        $routes = TripFixture::document()['days'][0]['routes'];
        $suggestions = new Suggestions([self::ride(1, self::ALONG, '2026-05-01T08:00:00Z'), self::ride(2, self::ALONG, '2026-05-01T12:00:00Z')], ['a1' => [1, 2], 'a2' => [2]], 0);
        self::assertSame([], $suggestions->of(['id' => 'a1', 'tripId' => 1, 'date' => null, 'routes' => $routes]));
        self::assertSame([[1]], array_column($suggestions->of(['id' => 'a2', 'tripId' => 1, 'date' => null, 'routes' => $routes]), 'rideIds'));
    }

    private static function ride(int $id, array $line, string $startedAt, array $days = []): array
    {
        return ['id' => $id, 'line' => Polyline::encode($line), 'distanceM' => 0, 'startedAt' => $startedAt, 'days' => $days];
    }
}
