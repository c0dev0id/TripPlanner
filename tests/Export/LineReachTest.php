<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use PHPUnit\Framework\TestCase;
use Planner\Export\LineReach;
use Planner\Export\Proximity;

final class LineReachTest extends TestCase
{
    public function testSaysWhatALineOfManyRunsComesNear(): void
    {
        // A hundred points north along a meridian, some eleven metres apart: more than three runs.
        $line = array_map(fn (int $i) => [11.5, 48.0 + $i * 0.0001], range(0, 100));
        $reach = new LineReach($line);
        self::assertSame(Proximity::bounds($line), $reach->bounds);
        foreach ([[[11.5, 48.0], true], [[11.5005, 48.0049], true], [[11.5005, 48.0101], true], [[11.502, 48.005], false], [[11.5, 48.0108], false], [[11.5, 47.9995], true], [[12.0, 48.005], false]] as [$position, $near]) {
            self::assertSame($near, $reach->reaches($position, 75), implode(',', $position));
            self::assertSame($near, Proximity::toLine($position, $line) <= 75, implode(',', $position));
        }
    }
}
