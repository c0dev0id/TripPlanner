<?php

declare(strict_types=1);

namespace Planner\Export;

/** Distances between a position and lines, in metres, on a flat map around the position. */
final class Proximity
{
    public const METRES_PER_DEGREE = 111_195.0;

    /**
     * The distance in metres between two positions, close enough for a few kilometres.
     *
     * @param array{0: float, 1: float} $a
     * @param array{0: float, 1: float} $b
     */
    public static function between(array $a, array $b): float
    {
        $dx = ($b[0] - $a[0]) * cos(deg2rad($a[1]));
        $dy = $b[1] - $a[1];
        return sqrt($dx * $dx + $dy * $dy) * self::METRES_PER_DEGREE;
    }

    /**
     * The west, south, east and north of a line; of a line without points, bounds nothing lies in.
     *
     * @param list<array{0: float, 1: float}> $line
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public static function bounds(array $line): array
    {
        if ($line === []) {
            return [INF, INF, -INF, -INF];
        }
        $lngs = array_column($line, 0);
        $lats = array_column($line, 1);
        return [min($lngs), min($lats), max($lngs), max($lats)];
    }

    /**
     * Whether two bounds, as `bounds` gives them, share any ground.
     *
     * @param array{0: float, 1: float, 2: float, 3: float} $a
     * @param array{0: float, 1: float, 2: float, 3: float} $b
     */
    public static function overlap(array $a, array $b): bool
    {
        return $a[0] <= $b[2] && $b[0] <= $a[2] && $a[1] <= $b[3] && $b[1] <= $a[3];
    }

    /**
     * The distance in metres from a position to the nearest point of a line; infinite for
     * a line without points.
     *
     * @param array{0: float, 1: float} $position
     * @param list<array{0: float, 1: float}> $line
     */
    public static function toLine(array $position, array $line): float
    {
        if ($line === []) {
            return INF;
        }
        $scale = cos(deg2rad($position[1]));
        // The position is the origin; each vertex is projected once and carried to the next segment.
        $ax = ($line[0][0] - $position[0]) * $scale;
        $ay = $line[0][1] - $position[1];
        $best = $ax * $ax + $ay * $ay;
        for ($i = 1, $n = count($line); $i < $n; $i++) {
            $bx = ($line[$i][0] - $position[0]) * $scale;
            $by = $line[$i][1] - $position[1];
            $dx = $bx - $ax;
            $dy = $by - $ay;
            $length2 = $dx * $dx + $dy * $dy;
            $t = $length2 === 0.0 ? 0.0 : max(0.0, min(1.0, -($ax * $dx + $ay * $dy) / $length2));
            $px = $ax + $t * $dx;
            $py = $ay + $t * $dy;
            $best = min($best, $px * $px + $py * $py);
            $ax = $bx;
            $ay = $by;
        }
        return sqrt($best) * self::METRES_PER_DEGREE;
    }
}
