<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use PHPUnit\Framework\TestCase;
use Planner\Export\Proximity;

final class ProximityTest extends TestCase
{
    public function testTellsWhetherBoundsShareGround(): void
    {
        self::assertTrue(Proximity::overlap([8.0, 47.0, 9.0, 48.0], [8.5, 47.5, 10.0, 49.0]));
        self::assertTrue(Proximity::overlap([8.0, 47.0, 9.0, 48.0], [9.0, 48.0, 10.0, 49.0]));
        self::assertFalse(Proximity::overlap([8.0, 47.0, 9.0, 48.0], [9.1, 47.0, 10.0, 48.0]));
        self::assertFalse(Proximity::overlap([8.0, 47.0, 9.0, 48.0], Proximity::bounds([])));
    }
}
