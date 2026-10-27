<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use PHPUnit\Framework\TestCase;
use Planner\Export\Polyline;
use Planner\Export\RouteGeometry;

final class RouteGeometryTest extends TestCase
{
    public function testWritesLegKeysAsTheClientDoes(): void
    {
        self::assertSame('car/11.5,48.1;11.6,48.2', RouteGeometry::legKey('car', [11.5, 48.1], [11.6, 48.2]));
        self::assertSame('bike/11,48;0,0', RouteGeometry::legKey('bike', [11.0, 48.0], [0.0, -0.0]));
        self::assertSame('foot/0.000001,-0.1;179.999999,-85.05', RouteGeometry::legKey('foot', [0.000001, -0.1], [179.999999, -85.05]));
        self::assertSame('car/11.123457,48.987654;1,2', RouteGeometry::legKey('car', [11.123457, 48.987654], [1, 2]));
    }

    public function testDecodesPolylines(): void
    {
        self::assertSame([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]], Polyline::decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5));
        self::assertSame([], Polyline::decode(''));
    }

    public function testJoinsRoutedLegsAndFallsBackToStraightLines(): void
    {
        $route = [
            'profile' => 'car',
            'points' => [
                ['id' => 'a', 'lngLat' => [1.0, 1.0]],
                ['id' => 'b', 'lngLat' => [2.0, 2.0]],
                ['id' => 'c', 'lngLat' => [3.0, 3.0], 'straight' => true],
                ['id' => 'd', 'lngLat' => [4.0, 4.0]],
            ],
            'legs' => [
                // 1,1 -> 1.5,1.2 -> 2,2 as polyline6
                'car/1,1;2,2' => ['geometry' => '_c`|@_c`|@_seK_qo]_oyo@_qo]', 'distanceM' => 1, 'durationS' => 1],
                // Kept for a straight leg by mistake: a straight leg is drawn straight all the same.
                'car/2,2;3,3' => ['geometry' => '_gayB_gayB_{fjL_{fjL', 'distanceM' => 1, 'durationS' => 1],
            ],
        ];
        self::assertSame([[1.0, 1.0], [1.5, 1.2], [2.0, 2.0], [3.0, 3.0], [4.0, 4.0]], RouteGeometry::line($route));
    }
}
