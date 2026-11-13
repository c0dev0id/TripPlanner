<?php

declare(strict_types=1);

namespace Planner\Export;

/** Lines with the points left out that lie near enough to what remains (Douglas–Peucker). */
final class Thinning
{
    /**
     * The line with the points left out that lie within `$toleranceM` metres of what remains.
     *
     * @param list<array{0: float, 1: float}> $line
     * @return list<array{0: float, 1: float}>
     */
    public static function toMetres(array $line, float $toleranceM): array
    {
        if (count($line) < 3) {
            return $line;
        }
        $lats = array_column($line, 1);
        return self::within($line, $toleranceM / Proximity::METRES_PER_DEGREE, cos(deg2rad((min($lats) + max($lats)) / 2)));
    }

    /**
     * The line of three points or more with the points left out that lie within
     * `$tolerance` degrees of latitude of what remains, longitudes counted `$scale` times.
     * Without recursion: a track has tens of thousands of points.
     *
     * @param list<array{0: float, 1: float}> $line
     * @return list<array{0: float, 1: float}>
     */
    public static function within(array $line, float $tolerance, float $scale): array
    {
        $last = count($line) - 1;
        $keep = [0 => true, $last => true];
        $spans = [[0, $last]];
        while ($spans !== []) {
            [$from, $to] = array_pop($spans);
            [$ax, $ay] = [$line[$from][0] * $scale, $line[$from][1]];
            [$dx, $dy] = [$line[$to][0] * $scale - $ax, $line[$to][1] - $ay];
            $length2 = $dx * $dx + $dy * $dy;
            $farthest = 0.0;
            $at = -1;
            for ($i = $from + 1; $i < $to; $i++) {
                [$px, $py] = [$line[$i][0] * $scale - $ax, $line[$i][1] - $ay];
                $t = $length2 === 0.0 ? 0.0 : max(0.0, min(1.0, ($px * $dx + $py * $dy) / $length2));
                $distance2 = ($px - $t * $dx) ** 2 + ($py - $t * $dy) ** 2;
                if ($distance2 > $farthest) {
                    $farthest = $distance2;
                    $at = $i;
                }
            }
            if ($at >= 0 && $farthest > $tolerance * $tolerance) {
                $keep[$at] = true;
                $spans[] = [$from, $at];
                $spans[] = [$at, $to];
            }
        }
        ksort($keep);
        return array_map(fn (int $i) => $line[$i], array_keys($keep));
    }
}
