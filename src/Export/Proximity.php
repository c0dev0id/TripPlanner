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
     * Whether the line comes within `$reachM` of the position; a line whose bounds lie
     * farther away is not walked.
     *
     * @param array{0: float, 1: float} $position
     * @param list<array{0: float, 1: float}> $line
     * @param array{0: float, 1: float, 2: float, 3: float} $bounds the line's, as `bounds` gives them
     */
    public static function reaches(array $position, array $line, array $bounds, float $reachM): bool
    {
        $lat = $reachM / self::METRES_PER_DEGREE;
        $lng = $lat / max(cos(deg2rad($position[1])), 0.01);
        if ($position[0] < $bounds[0] - $lng || $position[0] > $bounds[2] + $lng || $position[1] < $bounds[1] - $lat || $position[1] > $bounds[3] + $lat) {
            return false;
        }
        return self::toLine($position, $line) <= $reachM;
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
