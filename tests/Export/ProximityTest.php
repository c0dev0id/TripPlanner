<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use PHPUnit\Framework\TestCase;
use Planner\Export\Proximity;

final class ProximityTest extends TestCase
{
    public function testALineReachesAPositionWithinTheDistanceOfIt(): void
    {
        $line = [[11.0, 47.0], [11.1, 47.0]];
        $bounds = Proximity::bounds($line);
        self::assertSame([11.0, 47.0, 11.1, 47.0], $bounds);
        // 0.01° of latitude is about 1.1 km.
        self::assertTrue(Proximity::reaches([11.05, 47.01], $line, $bounds, 2000));
        self::assertFalse(Proximity::reaches([11.05, 47.01], $line, $bounds, 1000));
        self::assertTrue(Proximity::reaches([11.11, 47.0], $line, $bounds, 1000));
        self::assertFalse(Proximity::reaches([12.0, 47.0], $line, $bounds, 2000));
    }

    public function testALineWithoutPointsReachesNothing(): void
    {
        self::assertFalse(Proximity::reaches([11.0, 47.0], [], Proximity::bounds([]), 2000));
    }
}
