<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use PHPUnit\Framework\TestCase;
use Planner\Export\Polyline;
use Planner\Trip\Outline;

final class OutlineTest extends TestCase
{
    public function testThinsALineToItsShapeAndKeepsItsEnds(): void
    {
        $line = [];
        for ($i = 0; $i <= 1000; $i++) {
            // East along a parallel with a ripple far below the tolerance, then a corner north.
            $line[] = $i <= 500 ? [11.0 + $i * 0.001, 47.0 + 0.00001 * ($i % 2)] : [11.5, 47.0 + ($i - 500) * 0.001];
        }
        $thinned = Outline::thinned($line);
        self::assertSame($line[0], $thinned[0]);
        self::assertSame($line[1000], $thinned[count($thinned) - 1]);
        self::assertLessThan(8, count($thinned));
        self::assertContains([11.5, 47.0], array_map(fn (array $p) => [round($p[0], 3), round($p[1], 3)], $thinned));
    }

    public function testKeepsNoMorePointsThanAnOutlineMayHave(): void
    {
        $line = [];
        for ($i = 0; $i < 2000; $i++) {
            $line[] = [11.0 + $i * 0.001, 47.0 + 0.2 * sin($i / 7)];
        }
        self::assertLessThanOrEqual(Outline::MAX_POINTS, count(Outline::thinned($line)));
        self::assertSame([[1.0, 1.0], [2.0, 2.0]], Outline::thinned([[1.0, 1.0], [2.0, 2.0]]));
    }

    public function testADaysOutlineIsALinePerRouteWithItsOwnColour(): void
    {
        $day = TripFixture::day('d', [
            TripFixture::route('r1', [[11.5, 48.1], [11.45, 47.8]]) + ['color' => null],
            ['color' => '#1c7ed6'] + TripFixture::track('t1'),
            TripFixture::route('alone', [[11.0, 47.0]]),
        ]);
        $kept = Outline::stored($day, null);
        $lines = Outline::lines($kept);
        self::assertCount(2, $lines);
        self::assertSame([null, '#1c7ed6'], array_column($lines, 'color'));
        self::assertSame([[11.5, 48.1], [11.45, 47.8]], Polyline::decode($lines[0]['line']));
        self::assertSame([], Outline::lines(''));
    }

    public function testEncodingAndDecodingALineAgree(): void
    {
        $line = [[11.5, 48.1], [-0.000001, -47.999999], [179.123456, 0.0]];
        $encoded = Polyline::encode($line);
        self::assertEquals($line, Polyline::decode($encoded));
        self::assertSame('', Polyline::encode([]));
        // Cut off within a point, a line ends at the point before.
        self::assertEquals(array_slice($line, 0, 2), Polyline::decode(substr($encoded, 0, -1)));
    }

    public function testAnOutlineIsTakenOverWhileTheRoutesAreTheSame(): void
    {
        $day = TripFixture::day('d', [TripFixture::track('t1')]);
        $kept = Outline::stored($day, null);
        self::assertSame($kept, Outline::stored($day + ['name' => 'renamed'], $kept));
        $recoloured = $day;
        $recoloured['routes'][0]['color'] = '#c2255c';
        self::assertNotSame($kept, Outline::stored($recoloured, $kept));
        self::assertSame('#c2255c', Outline::lines(Outline::stored($recoloured, $kept))[0]['color']);
    }
}
