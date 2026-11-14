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

    public function testFindsWhatRanAlongTheDaysRoutesWholeOrInPart(): void
    {
        $found = Lookup::of($this->day, [
            self::ride(1, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]]),
            self::ride(2, [[11.5, 48.1], [11.45, 47.8]]),
            self::ride(3, [[11.5, 48.1], [11.4995, 48.097]]),
            self::ride(4, [[11.6, 48.6], [11.5, 48.1], [11.45, 47.8], [11.4, 47.3], [11.3, 47.0]]),
            self::ride(5, [[11.5, 48.1], [11.9, 47.8], [11.4, 47.3]]),
            self::ride(6, [[9.5, 46.1], [9.4, 46.3]]),
        ], 0);
        self::assertSame([[1], [2], [4]], self::ids($found));
        self::assertSame([null, null, null], array_column($found, 'date'));
        self::assertSame([false, false, false], array_column($found, 'sameDate'));
        self::assertSame([1.0, 1.0, 1.0], array_column($found, 'share'));
    }

    public function testJudgesTheRidesOfOneDateTogether(): void
    {
        // Five files of some 18 km each, none a quarter of the day's routes, and a detour between two of them left out.
        $pieces = [];
        foreach ([[48.1, 47.94], [47.94, 47.8], [47.8, 47.64], [47.64, 47.47], [47.47, 47.3]] as $i => [$from, $to]) {
            $pieces[] = self::ride($i + 1, [self::onRoute($from), self::onRoute($to)], sprintf('2026-05-01T%02d:00:00Z', 8 + $i));
        }
        $found = Lookup::of($this->day, [...$pieces, self::ride(9, [self::onRoute(47.9), self::onRoute(47.89)], '2026-05-02T08:00:00Z')], 0);
        self::assertSame([['2026-05-01', false, 1.0, [1, 2, 3, 4, 5]]], array_map(fn (array $d) => [$d['date'], $d['sameDate'], $d['share'], array_column($d['rides'], 'id')], $found));

        // Those on the day already count toward the share and are not listed again; a day of riding that is on it whole is not listed.
        foreach ([0, 1] as $i) {
            $pieces[$i]['days'] = [['dayId' => $this->day['id']]];
        }
        self::assertSame([[3, 4, 5]], self::ids(Lookup::of($this->day, $pieces, 0)));
        self::assertSame([], Lookup::of($this->day, [['days' => [['dayId' => $this->day['id']]]] + self::ride(1, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]])], 0));
    }

    public function testFindsWhatBeganOnTheDaysDateByTheUsersClockFirst(): void
    {
        $elsewhere = [[9.5, 46.1], [9.4, 46.3]];
        $found = Lookup::of($this->day, [
            self::ride(1, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]], '2026-05-01T08:00:00Z'),
            self::ride(2, $elsewhere, '2027-06-11T22:30:00Z'),
            self::ride(3, $elsewhere, '2027-06-12T22:30:00Z'),
        ], 120);
        self::assertSame([['2027-06-12', [2], true, 0.0], ['2026-05-01', [1], false, 1.0]], array_map(fn (array $d) => [$d['date'], array_column($d['rides'], 'id'), $d['sameDate'], $d['share']], $found));

        $undated = ['date' => null] + $this->day;
        self::assertSame([[1]], self::ids(Lookup::of($undated, [self::ride(1, [[11.5, 48.1], [11.45, 47.8], [11.4, 47.3]]), self::ride(2, $elsewhere, '2027-06-12T08:00:00Z')], 0)));
    }

    public function testFindsOnlyByTheDateOnADayWithoutRoutes(): void
    {
        $empty = ['routes' => []] + $this->day;
        $found = Lookup::of($empty, [self::ride(1, [[11.5, 48.1], [11.4, 47.3]]), self::ride(2, [[11.5, 48.1], [11.4, 47.3]], '2027-06-12T08:00:00Z')], 0);
        self::assertSame([[2]], self::ids($found));
    }

    /** @return list<list<int>> the ids of the rides of each day of riding found */
    private static function ids(array $found): array
    {
        return array_map(fn (array $ridingDay) => array_column($ridingDay['rides'], 'id'), $found);
    }

    /** The point of the fixture's route at the latitude. */
    private static function onRoute(float $lat): array
    {
        return $lat >= 47.8 ? [11.45 + (11.5 - 11.45) * ($lat - 47.8) / (48.1 - 47.8), $lat] : [11.4 + (11.45 - 11.4) * ($lat - 47.3) / (47.8 - 47.3), $lat];
    }

    private static function ride(int $id, array $line, ?string $startedAt = null): array
    {
        return ['id' => $id, 'line' => Polyline::encode($line), 'distanceM' => 0, 'startedAt' => $startedAt, 'days' => []];
    }
}
