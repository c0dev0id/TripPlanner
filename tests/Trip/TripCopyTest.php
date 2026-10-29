<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use PHPUnit\Framework\TestCase;
use Planner\Trip\TripCopy;
use Planner\Trip\TripDocumentValidator;

final class TripCopyTest extends TestCase
{
    public function testGivesEveryPartANewIdAndKeepsBoundStopsAtTheirPoints(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][] = TripFixture::track('t1');
        $original = TripDocumentValidator::validated($document);
        $copy = TripCopy::withNewIds($original);
        $day = $copy['days'][0];
        $before = $original['days'][0];
        self::assertNotSame($before['id'], $day['id']);
        self::assertSame($before['name'], $day['name']);
        self::assertSame($before['date'], $day['date']);
        $route = $day['routes'][0];
        self::assertNotSame('r1', $route['id']);
        self::assertSame(array_column($before['routes'][0]['points'], 'lngLat'), array_column($route['points'], 'lngLat'));
        self::assertNotContains('r1-0', array_column($route['points'], 'id'));
        self::assertSame($before['routes'][0]['legs'], $route['legs']);
        self::assertSame($route['points'][0]['id'], $day['stops'][0]['pointId']);
        self::assertSame($route['points'][2]['id'], $day['stops'][1]['pointId']);
        self::assertNull($day['stops'][2]['pointId']);
        self::assertSame(['id' => $day['routes'][1]['id']] + TripFixture::track('t1'), $day['routes'][1]);
        self::assertNotSame('t1', $day['routes'][1]['id']);
        self::assertSame('Café & Bar', $day['stops'][2]['name']);
        self::assertNotSame('s3', $day['stops'][2]['id']);
        // The copy is a valid document.
        TripDocumentValidator::validated($copy);
    }
}
