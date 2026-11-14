<?php

declare(strict_types=1);

namespace Planner\Recording;

use DateTimeImmutable;
use Planner\Export\LineReach;
use Planner\Export\LineSamples;
use Planner\Export\Polyline;
use Planner\Export\Proximity;
use Planner\Export\RouteGeometry;

/**
 * The days of riding that may be a day's: the rides begun on one date by the user's
 * clock, taken together, where that date is the day's, where they ran along the day's
 * routes, or where the day's routes ran along them. A ride without times is a day of
 * riding of its own. Unlike the same ride kept twice (see Duplicates), a day of riding
 * need not be the whole day: it may have been recorded from the door to the door.
 */
final class Lookup
{
    /** How far from a line a point that ran along it may be, and the share of the points that must be that near. */
    private const LINE_WITHIN_M = 75;
    private const SHARE_NEAR = 0.8;
    /** Points taken evenly along a line to compare it. */
    private const SAMPLES = 64;
    /** The share of the day's routes a recording along them must be as long as: less is a piece of road they share. */
    private const LENGTH_SHARE = 0.25;

    /** @var list<array{date: ?string, listed: list<array<string, mixed>>, lines: list<LineReach>, lengthM: ?float, samples: list<array{0: float, 1: float}>}> the days of riding: the rides that may be listed, the lines of all its rides, and once they were needed its length and the points taken along its lines */
    private array $ridingDays = [];

    /**
     * Sorts the rides into days of riding, each line read once, for any number of days to
     * be looked up among them. With `$listed`, only the rides it holds for are listed,
     * and a day of riding without one is left out: its lines are then not read at all.
     *
     * @param list<array{id: int, line: string, startedAt: ?string, days: list<array{dayId: string}>}> $rides as Recordings::rides gives them
     * @param int $utcOffsetMinutes how far the user's clock is ahead of UTC, for the date a ride began on
     * @param ?callable(array<string, mixed>): bool $listed
     */
    public function __construct(array $rides, int $utcOffsetMinutes, ?callable $listed = null)
    {
        $byDate = [];
        foreach ($rides as $ride) {
            $date = $ride['startedAt'] === null ? null : (new DateTimeImmutable($ride['startedAt']))->modify("$utcOffsetMinutes minutes")->format('Y-m-d');
            $key = $date ?? "ride {$ride['id']}";
            $byDate[$key] ??= ['date' => $date, 'rides' => []];
            $byDate[$key]['rides'][] = $ride;
        }
        foreach ($byDate as ['date' => $date, 'rides' => $ridden]) {
            $mayBeListed = $listed === null ? $ridden : array_values(array_filter($ridden, $listed));
            if ($mayBeListed === []) {
                continue;
            }
            $lines = array_filter(array_map(fn (array $ride) => Polyline::decode($ride['line']), $ridden), fn (array $line) => count($line) > 1);
            $this->ridingDays[] = ['date' => $date, 'listed' => $mayBeListed, 'lines' => array_map(fn (array $line) => new LineReach($line), array_values($lines)), 'lengthM' => null, 'samples' => []];
        }
    }

    /**
     * The days of riding that may be the day's, each with its date, whether that is the
     * day's (`sameDate`), the share of it that ran along the day's routes, or of them
     * along it, whichever is more (`share`), and those of its rides that may be listed
     * and are not on the day yet; none where all are. Those of the date first, then the
     * nearest.
     *
     * @param array{id: string, date: ?string, routes: list<array<string, mixed>>} $day a day of a trip's document
     * @return list<array{date: ?string, sameDate: bool, share: float, rides: list<array<string, mixed>>}>
     */
    public function of(array $day): array
    {
        $routes = [];
        $routesM = 0.0;
        foreach ($day['routes'] as $route) {
            $line = RouteGeometry::line($route);
            if (count($line) > 1) {
                $along = LineSamples::along($line);
                $routesM += $along[count($line) - 1];
                $routes[] = ['reach' => new LineReach($line), 'samples' => LineSamples::spread($line, $along, self::SAMPLES)];
            }
        }
        $found = [];
        foreach ($this->ridingDays as $index => ['date' => $date, 'listed' => $listed]) {
            $waiting = array_values(array_filter($listed, fn (array $ride) => !in_array($day['id'], array_column($ride['days'], 'dayId'), true)));
            if ($waiting === []) {
                continue;
            }
            $sameDate = $date !== null && $date === $day['date'];
            // One of the date is listed whatever its share, which is then worked out in full.
            $share = $this->share($index, $routes, $routesM, $sameDate ? 0.0 : self::SHARE_NEAR);
            if ($sameDate || $share >= self::SHARE_NEAR) {
                $found[] = ['date' => $date, 'sameDate' => $sameDate, 'share' => round($share, 2), 'rides' => $waiting];
            }
        }
        usort($found, fn (array $a, array $b) => [$b['sameDate'], $b['share']] <=> [$a['sameDate'], $a['share']]);
        return $found;
    }

    /**
     * The share of a day of riding's lines that ran along the routes, or of the routes
     * that ran along them, whichever is more; none where they are apart, or where
     * neither share comes to `$atLeast`.
     */
    private function share(int $index, array $routes, float $routesM, float $atLeast): float
    {
        $lines = $this->ridingDays[$index]['lines'];
        $routes = array_values(array_filter($routes, fn (array $route) => array_filter($lines, fn (LineReach $line) => Proximity::overlap($route['reach']->bounds, $line->bounds)) !== []));
        if ($routes === []) {
            return 0.0;
        }
        // Most rides are apart from a day's routes, so their lines are measured only once they are not, and then once.
        if ($this->ridingDays[$index]['lengthM'] === null) {
            $this->measure($index);
        }
        ['lengthM' => $ridesM, 'samples' => $samples] = $this->ridingDays[$index];
        if ($ridesM <= 0.0) {
            return 0.0;
        }
        $alongRoutes = $ridesM >= self::LENGTH_SHARE * $routesM ? self::shareNear($samples, array_column($routes, 'reach'), $atLeast) : 0.0;
        return max($alongRoutes, self::shareNear(array_merge(...array_column($routes, 'samples')), $lines, $atLeast));
    }

    /** Works out how long a day of riding's lines are together, and takes points along them, each line as many as its length is of the whole's. */
    private function measure(int $index): void
    {
        $alongs = array_map(fn (LineReach $line) => LineSamples::along($line->line), $this->ridingDays[$index]['lines']);
        $lengthM = array_sum(array_map(fn (array $along) => $along[count($along) - 1], $alongs));
        $samples = [];
        foreach ($lengthM > 0.0 ? $this->ridingDays[$index]['lines'] : [] as $at => $line) {
            $along = $alongs[$at];
            array_push($samples, ...LineSamples::spread($line->line, $along, max(2, (int) round(self::SAMPLES * $along[count($along) - 1] / $lengthM))));
        }
        $this->ridingDays[$index]['lengthM'] = $lengthM;
        $this->ridingDays[$index]['samples'] = $samples;
    }

    /**
     * The share of the points that lie within LINE_WITHIN_M of one of the lines; none as
     * soon as fewer than `$atLeast` of them can.
     *
     * @param list<array{0: float, 1: float}> $points
     * @param list<LineReach> $lines
     */
    private static function shareNear(array $points, array $lines, float $atLeast): float
    {
        $mayMiss = (1 - $atLeast) * count($points);
        $missed = 0;
        foreach ($points as $point) {
            foreach ($lines as $line) {
                if ($line->reaches($point, self::LINE_WITHIN_M)) {
                    continue 2;
                }
            }
            if (++$missed > $mayMiss) {
                return 0.0;
            }
        }
        return 1 - $missed / count($points);
    }
}
