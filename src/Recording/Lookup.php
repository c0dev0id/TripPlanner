<?php

declare(strict_types=1);

namespace Planner\Recording;

use DateTimeImmutable;
use Planner\Export\LineSamples;
use Planner\Export\Polyline;
use Planner\Export\Proximity;
use Planner\Export\RouteGeometry;
use Planner\Export\Thinning;

/**
 * The recordings that may be a day's, among those that wait for their day: one begun on
 * the day's date, one that ran along the day's routes, and one the day's routes ran
 * along. Unlike the same ride kept twice (see Duplicates), a ride need not be the whole
 * day: it may have been recorded in pieces, or from the door to the door.
 */
final class Lookup
{
    /** How far from a line a point that ran along it may be, and the share of the points that must be that near. */
    private const LINE_WITHIN_M = 75;
    private const SHARE_NEAR = 0.8;
    /** Points taken evenly along a line to compare it. */
    private const SAMPLES = 64;
    /** How far the lines compared against may be thinned. */
    private const THIN_M = 10;
    /** The share of the day's routes a recording along them must be as long as: less is a piece of road they share. */
    private const LENGTH_SHARE = 0.25;

    /**
     * The recordings that may be the day's, each with whether it began on the day's date
     * (`sameDate`) and the share of it that ran along the day's routes, or of them along
     * it, whichever is more (`share`): those of the date first, then the nearest.
     *
     * @param array $day a day of a trip's document
     * @param list<array{id: int, line: string, distanceM: int, startedAt: ?string}> $recordings as Recordings::unassigned gives them
     * @param int $utcOffsetMinutes how far the user's clock is ahead of UTC, for the date a recording began on
     * @return list<array<string, mixed>>
     */
    public static function of(array $day, array $recordings, int $utcOffsetMinutes): array
    {
        $routes = [];
        $routesM = 0.0;
        foreach ($day['routes'] as $route) {
            $line = Thinning::toMetres(RouteGeometry::line($route), self::THIN_M);
            if (count($line) > 1) {
                $along = LineSamples::along($line);
                $routesM += $along[count($line) - 1];
                $routes[] = ['line' => $line, 'samples' => LineSamples::spread($line, $along, self::SAMPLES), 'bounds' => Proximity::bounds($line)];
            }
        }
        $found = [];
        foreach ($recordings as $recording) {
            $sameDate = $day['date'] !== null && $recording['startedAt'] !== null
                && (new DateTimeImmutable($recording['startedAt']))->modify("$utcOffsetMinutes minutes")->format('Y-m-d') === $day['date'];
            // One of the date is listed whatever its share, which is then worked out in full.
            $share = self::share($recording, $routes, $routesM, $sameDate ? 0.0 : self::SHARE_NEAR);
            if ($sameDate || $share >= self::SHARE_NEAR) {
                $found[] = $recording + ['sameDate' => $sameDate, 'share' => round($share, 2)];
            }
        }
        usort($found, fn (array $a, array $b) => [$b['sameDate'], $b['share']] <=> [$a['sameDate'], $a['share']]);
        return $found;
    }

    /**
     * The share of the recording's line that ran along the routes, or of the routes that
     * ran along it, whichever is more; none where they are apart, or where neither share
     * comes to `$atLeast`.
     */
    private static function share(array $recording, array $routes, float $routesM, float $atLeast): float
    {
        $line = Polyline::decode($recording['line']);
        $bounds = Proximity::bounds($line);
        $routes = array_values(array_filter($routes, fn (array $route) => Proximity::overlap($route['bounds'], $bounds)));
        if (count($line) < 2 || $routes === []) {
            return 0.0;
        }
        $along = LineSamples::along($line);
        $alongRoutes = $along[count($line) - 1] < self::LENGTH_SHARE * $routesM ? 0.0 : self::shareNear(LineSamples::spread($line, $along, self::SAMPLES), $routes, $atLeast);
        return max($alongRoutes, self::shareNear(array_merge(...array_column($routes, 'samples')), [['line' => $line, 'bounds' => $bounds]], $atLeast));
    }

    /**
     * The share of the points that lie within LINE_WITHIN_M of one of the lines, each given
     * with its bounds; none as soon as fewer than `$atLeast` of them can.
     */
    private static function shareNear(array $points, array $lines, float $atLeast): float
    {
        $mayMiss = (1 - $atLeast) * count($points);
        $missed = 0;
        foreach ($points as $point) {
            foreach ($lines as $line) {
                if (Proximity::reaches($point, $line['line'], $line['bounds'], self::LINE_WITHIN_M)) {
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
