<?php

declare(strict_types=1);

namespace Planner\Export;

/** Points taken evenly along a line, to compare lines by where they run rather than by the points they happen to have. */
final class LineSamples
{
    /**
     * @param list<array{0: float, 1: float}> $line
     * @return list<float> the metres from the start of the line to each of its points
     */
    public static function along(array $line): array
    {
        $along = [0.0];
        for ($i = 1, $n = count($line); $i < $n; $i++) {
            $along[] = $along[$i - 1] + Proximity::between($line[$i - 1], $line[$i]);
        }
        return $along;
    }

    /**
     * `$count` points spread evenly along the line by length, from its start to its end.
     *
     * @param list<array{0: float, 1: float}> $line of two points or more
     * @param list<float> $along the metres from the start to each point of the line
     * @return list<array{0: float, 1: float}>
     */
    public static function spread(array $line, array $along, int $count): array
    {
        $points = [];
        $segment = 1;
        $last = count($line) - 1;
        for ($k = 0; $k < $count; $k++) {
            $at = $along[$last] * $k / ($count - 1);
            while ($segment < $last && $along[$segment] < $at) {
                $segment++;
            }
            $length = $along[$segment] - $along[$segment - 1];
            $t = $length > 0 ? ($at - $along[$segment - 1]) / $length : 0.0;
            [$a, $b] = [$line[$segment - 1], $line[$segment]];
            $points[] = [$a[0] + $t * ($b[0] - $a[0]), $a[1] + $t * ($b[1] - $a[1])];
        }
        return $points;
    }

    /**
     * The share of the points that lie within `$withinM` metres of one of the lines.
     *
     * @param non-empty-list<array{0: float, 1: float}> $points
     * @param list<list<array{0: float, 1: float}>> $lines
     */
    public static function shareNear(array $points, array $lines, float $withinM): float
    {
        $near = 0;
        foreach ($points as $point) {
            foreach ($lines as $line) {
                if (Proximity::toLine($point, $line) <= $withinM) {
                    $near++;
                    break;
                }
            }
        }
        return $near / count($points);
    }
}
