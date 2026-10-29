<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use PHPUnit\Framework\TestCase;
use Planner\Export\Polyline;
use Planner\Export\RouteGeometry;
use Planner\Tests\Trip\TripFixture;

final class RouteGeometryTest extends TestCase
{
    public function testWritesLegKeysAsTheClientDoes(): void
    {
        self::assertSame('motorcycle:avoid/11.5,48.1;11.6,48.2', RouteGeometry::legKey('motorcycle', 'avoid', [11.5, 48.1], [11.6, 48.2]));
        self::assertSame('bicycle:allow/11,48;0,0', RouteGeometry::legKey('bicycle', 'allow', [11.0, 48.0], [0.0, -0.0]));
        self::assertSame('pedestrian:allow/0.000001,-0.1;179.999999,-85.05', RouteGeometry::legKey('pedestrian', 'allow', [0.000001, -0.1], [179.999999, -85.05]));
        self::assertSame('motorcycle:prefer/11.123457,48.987654;1,2', RouteGeometry::legKey('motorcycle', 'prefer', [11.123457, 48.987654], [1, 2]));
    }

    public function testDecodesPolylines(): void
    {
        self::assertSame([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]], Polyline::decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5));
        self::assertSame([], Polyline::decode(''));
    }

    public function testJoinsRoutedLegsAndFallsBackToStraightLines(): void
    {
        $route = [
            'kind' => 'routed',
            'profile' => 'motorcycle',
            'highways' => 'allow',
            'points' => [
                ['id' => 'a', 'lngLat' => [1.0, 1.0]],
                ['id' => 'b', 'lngLat' => [2.0, 2.0]],
                ['id' => 'c', 'lngLat' => [3.0, 3.0], 'straight' => true],
                ['id' => 'd', 'lngLat' => [4.0, 4.0]],
            ],
            'legs' => [
                // 1,1 -> 1.5,1.2 -> 2,2 as polyline6
                'motorcycle:allow/1,1;2,2' => ['geometry' => '_c`|@_c`|@_seK_qo]_oyo@_qo]', 'distanceM' => 1, 'durationS' => 1],
                // Kept for a straight leg by mistake: a straight leg is drawn straight all the same.
                'motorcycle:allow/2,2;3,3' => ['geometry' => '_gayB_gayB_{fjL_{fjL', 'distanceM' => 1, 'durationS' => 1],
            ],
        ];
        self::assertSame([[1.0, 1.0], [1.5, 1.2], [2.0, 2.0], [3.0, 3.0], [4.0, 4.0]], RouteGeometry::line($route));
    }

    public function testReadsATrackAsItsLine(): void
    {
        self::assertSame([[11.4, 47.3], [11.35, 47.2], [11.3, 47.1]], RouteGeometry::line(TripFixture::track('t1')));
    }

    public function testTellsAWellFormedPolyline(): void
    {
        self::assertTrue(Polyline::isWellFormed(''));
        self::assertTrue(Polyline::isWellFormed('_p~iF~ps|U_ulLnnqC'));
        self::assertFalse(Polyline::isWellFormed('_p~iF'), 'half a point');
        self::assertFalse(Polyline::isWellFormed('_p~iF~ps|'), 'an unfinished value');
        self::assertFalse(Polyline::isWellFormed('_p~iF ps|U'), 'a character outside the code');
    }
}
