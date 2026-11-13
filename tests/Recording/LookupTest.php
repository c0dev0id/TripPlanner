<?php

declare(strict_types=1);

namespace Planner\Tests\Recording;

use PHPUnit\Framework\TestCase;
use Planner\Export\Polyline;
use Planner\Recording\Lookup;
use Planner\Tests\Trip\TripFixture;

final class LookupTest extends TestCase
{
    /** The fixture's day: a route of some 90 km from [11.5, 48.1] by [11.45, 47.8] to [11.4, 47.3], on 2027-06-12. */
    private array $day;

    protected function setUp(): void
    {
        $this->day = TripFixture::document()['days'][0];
    }

    public function testFindsWhatRanAlongTheDaysRoutesWholeOrInPieces(): void
    {
        $found = Lookup::of($this->day, [
            self::recording(1, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]]),
            self::recording(2, [[11.5, 48.1], [11.45, 47.8]]),
            self::recording(3, [[11.5, 48.1], [11.4995, 48.097]]),
            self::recording(4, [[11.6, 48.6], [11.5, 48.1], [11.45, 47.8], [11.4, 47.3], [11.3, 47.0]]),
            self::recording(5, [[11.5, 48.1], [11.9, 47.8], [11.4, 47.3]]),
            self::recording(6, [[9.5, 46.1], [9.4, 46.3]]),
        ], 0);
        self::assertSame([1, 2, 4], array_column($found, 'id'));
        self::assertSame([false, false, false], array_column($found, 'sameDate'));
        self::assertSame([1.0, 1.0, 1.0], array_column($found, 'share'));
    }

    public function testFindsWhatBeganOnTheDaysDateByTheUsersClockFirst(): void
    {
        $elsewhere = [[9.5, 46.1], [9.4, 46.3]];
        $found = Lookup::of($this->day, [
            self::recording(1, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]], '2026-05-01T08:00:00Z'),
            self::recording(2, $elsewhere, '2027-06-11T22:30:00Z'),
            self::recording(3, $elsewhere, '2027-06-12T22:30:00Z'),
        ], 120);
        self::assertSame([[2, true, 0.0], [1, false, 1.0]], array_map(fn (array $r) => [$r['id'], $r['sameDate'], $r['share']], $found));

        $undated = ['date' => null] + $this->day;
        self::assertSame([1], array_column(Lookup::of($undated, [self::recording(1, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]]), self::recording(2, $elsewhere, '2027-06-12T08:00:00Z')], 0), 'id'));
    }

    public function testFindsOnlyByTheDateOnADayWithoutRoutes(): void
    {
        $empty = ['routes' => []] + $this->day;
        $found = Lookup::of($empty, [self::recording(1, [[11.5, 48.1], [11.4, 47.3]]), self::recording(2, [[11.5, 48.1], [11.4, 47.3]], '2027-06-12T08:00:00Z')], 0);
        self::assertSame([2], array_column($found, 'id'));
    }

    private static function recording(int $id, array $line, ?string $startedAt = null): array
    {
        return ['id' => $id, 'line' => Polyline::encode($line), 'distanceM' => 0, 'startedAt' => $startedAt];
    }
}
