<?php

declare(strict_types=1);

namespace Planner\Export;

/**
 * A line to be asked of many positions whether it comes near them: cut into runs of
 * segments, each with its bounds, so that only the runs a position can be near are
 * walked, and those only up to the first segment within reach.
 */
final class LineReach
{
    /** How many segments a run holds. */
    private const RUN = 32;

    /** @var array{0: float, 1: float, 2: float, 3: float} the line's west, south, east and north */
    public readonly array $bounds;

    /** @var list<array{0: int, 1: int, 2: float, 3: float, 4: float, 5: float}> the runs: the first and the last point of each, and its west, south, east and north */
    private array $runs = [];

    /** @param list<array{0: float, 1: float}> $line of two points or more */
    public function __construct(public readonly array $line)
    {
        $this->bounds = Proximity::bounds($line);
        for ($from = 0, $last = count($line) - 1; $from < $last; $from += self::RUN) {
            $to = min($from + self::RUN, $last);
            [$west, $south, $east, $north] = Proximity::bounds(array_slice($line, $from, $to - $from + 1));
            $this->runs[] = [$from, $to, $west, $south, $east, $north];
        }
    }

    /** Whether the line comes within `$reachM` metres of the position. */
    public function reaches(array $position, float $reachM): bool
    {
        [$x, $y] = $position;
        $lat = $reachM / Proximity::METRES_PER_DEGREE;
        $scale = max(cos(deg2rad($y)), 0.01);
        $lng = $lat / $scale;
        if ($x < $this->bounds[0] - $lng || $x > $this->bounds[2] + $lng || $y < $this->bounds[1] - $lat || $y > $this->bounds[3] + $lat) {
            return false;
        }
        $reach2 = $lat * $lat;
        foreach ($this->runs as [$from, $to, $west, $south, $east, $north]) {
            if ($x < $west - $lng || $x > $east + $lng || $y < $south - $lat || $y > $north + $lat) {
                continue;
            }
            // The position is the origin; each vertex is projected once and carried to the next segment.
            $ax = ($this->line[$from][0] - $x) * $scale;
            $ay = $this->line[$from][1] - $y;
            for ($i = $from + 1; $i <= $to; $i++) {
                $bx = ($this->line[$i][0] - $x) * $scale;
                $by = $this->line[$i][1] - $y;
                $dx = $bx - $ax;
                $dy = $by - $ay;
                $length2 = $dx * $dx + $dy * $dy;
                $t = $length2 === 0.0 ? 0.0 : max(0.0, min(1.0, -($ax * $dx + $ay * $dy) / $length2));
                $px = $ax + $t * $dx;
                $py = $ay + $t * $dy;
                if ($px * $px + $py * $py <= $reach2) {
                    return true;
                }
                $ax = $bx;
                $ay = $by;
            }
        }
        return false;
    }
}
