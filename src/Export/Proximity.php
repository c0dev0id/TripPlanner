<?php

declare(strict_types=1);

namespace Planner\Export;

/** Distances between a position and lines, in metres, on a flat map around the position. */
final class Proximity
{
    private const METRES_PER_DEGREE = 111_195.0;

    /**
     * The distance in metres from a position to the nearest point of a line; infinite for
     * a line without points.
     *
     * @param array{0: float, 1: float} $position
     * @param list<array{0: float, 1: float}> $line
     */
    public static function toLine(array $position, array $line): float
    {
        $scale = cos(deg2rad($position[1]));
        $x = fn (array $p): float => ($p[0] - $position[0]) * $scale;
        $y = fn (array $p): float => $p[1] - $position[1];
        $best = INF;
        for ($i = 0, $n = count($line); $i < $n; $i++) {
            [$ax, $ay] = [$x($line[$i]), $y($line[$i])];
            if ($i === 0) {
                $best = min($best, hypot($ax, $ay));
            }
            if ($i + 1 < $n) {
                [$bx, $by] = [$x($line[$i + 1]), $y($line[$i + 1])];
                [$dx, $dy] = [$bx - $ax, $by - $ay];
                $length2 = $dx * $dx + $dy * $dy;
                $t = $length2 === 0.0 ? 0.0 : max(0.0, min(1.0, -($ax * $dx + $ay * $dy) / $length2));
                $best = min($best, hypot($ax + $t * $dx, $ay + $t * $dy));
            }
        }
        return $best * self::METRES_PER_DEGREE;
    }
}
