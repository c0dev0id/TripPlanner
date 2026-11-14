<?php

declare(strict_types=1);

namespace Planner\Tests\Stash;

use PHPUnit\Framework\TestCase;
use Planner\Export\Polyline;
use Planner\Stash\GpxIndex;

final class GpxIndexTest extends TestCase
{
    public function testListsRoutesAndTracksByTheirPlaceAndCountsTheWaypoints(): void
    {
        $index = GpxIndex::of(StashFixture::gpx());
        self::assertSame(2, $index->waypoints);
        self::assertSame(
            [['route', 0, 'Over the pass', 2], ['track', 0, 'Morning', 3], ['track', 1, '', 2]],
            array_map(fn (array $item) => [$item['kind'], $item['position'], $item['name'], $item['points']], $index->items),
        );
    }

    public function testATracksLineLengthAndStartComeFromItsPoints(): void
    {
        $track = GpxIndex::of(StashFixture::gpx())->items[1];
        self::assertSame([[8.7, 49.4], [8.8, 49.4], [8.8, 49.5]], Polyline::decode($track['line']));
        // 0.1° east at 49.4° north, 7.2 km, then 0.1° north, 11.1 km.
        self::assertEqualsWithDelta(18_360, $track['distanceM'], 60);
        self::assertSame('2025-07-08T15:24:36Z', $track['startedAt']);
        self::assertNull(GpxIndex::of(StashFixture::gpx())->items[2]['startedAt']);
    }

    public function testARoutesLineFollowsTheWayGarminGivesBetweenItsPoints(): void
    {
        $route = GpxIndex::of(StashFixture::gpx())->items[0];
        self::assertSame([[8.7, 49.4], [8.75, 49.45], [8.8, 49.4]], Polyline::decode($route['line']));
        self::assertNull($route['startedAt']);
    }

    public function testAFileThatIsNoXmlHoldsNothing(): void
    {
        $index = GpxIndex::of('not a file');
        self::assertSame([0, []], [$index->waypoints, $index->items]);
    }
}
