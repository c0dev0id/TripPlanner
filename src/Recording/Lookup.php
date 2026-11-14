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
    /** How far the lines compared against may be thinned. */
    private const THIN_M = 10;
    /** The share of the day's routes a recording along them must be as long as: less is a piece of road they share. */
    private const LENGTH_SHARE = 0.25;

    /**
     * The days of riding that may be the day's, each with its date, whether that is the
     * day's (`sameDate`), the share of it that ran along the day's routes, or of them
     * along it, whichever is more (`share`), and those of its rides that are not on the
     * day yet; none where all are. Those of the date first, then the nearest.
     *
     * @param array $day a day of a trip's document
     * @param list<array{id: int, line: string, startedAt: ?string, days: list<array{dayId: string}>}> $rides as Recordings::rides gives them
     * @param int $utcOffsetMinutes how far the user's clock is ahead of UTC, for the date a ride began on
     * @return list<array{date: ?string, sameDate: bool, share: float, rides: list<array<string, mixed>>}>
     */
    public static function of(array $day, array $rides, int $utcOffsetMinutes): array
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
        $ridingDays = [];
        foreach ($rides as $ride) {
            $date = $ride['startedAt'] === null ? null : (new DateTimeImmutable($ride['startedAt']))->modify("$utcOffsetMinutes minutes")->format('Y-m-d');
            $ridingDays[$date ?? "ride {$ride['id']}"] ??= ['date' => $date, 'rides' => []];
            $ridingDays[$date ?? "ride {$ride['id']}"]['rides'][] = $ride;
        }
        $found = [];
        foreach ($ridingDays as ['date' => $date, 'rides' => $ridden]) {
            $waiting = array_values(array_filter($ridden, fn (array $ride) => !in_array($day['id'], array_column($ride['days'], 'dayId'), true)));
            if ($waiting === []) {
                continue;
            }
            $sameDate = $date !== null && $date === $day['date'];
            // One of the date is listed whatever its share, which is then worked out in full.
            $share = self::share($ridden, $routes, $routesM, $sameDate ? 0.0 : self::SHARE_NEAR);
            if ($sameDate || $share >= self::SHARE_NEAR) {
                $found[] = ['date' => $date, 'sameDate' => $sameDate, 'share' => round($share, 2), 'rides' => $waiting];
            }
        }
        usort($found, fn (array $a, array $b) => [$b['sameDate'], $b['share']] <=> [$a['sameDate'], $a['share']]);
        return $found;
    }

    /**
     * The share of the rides' lines that ran along the routes, or of the routes that ran
     * along them, whichever is more; none where they are apart, or where neither share
     * comes to `$atLeast`.
     */
    private static function share(array $rides, array $routes, float $routesM, float $atLeast): float
    {
        $lines = [];
        $ridesM = 0.0;
        foreach ($rides as $ride) {
            $line = Polyline::decode($ride['line']);
            if (count($line) > 1) {
                $along = LineSamples::along($line);
                $ridesM += $along[count($line) - 1];
                $lines[] = ['line' => $line, 'along' => $along, 'bounds' => Proximity::bounds($line)];
            }
        }
        $routes = array_values(array_filter($routes, fn (array $route) => array_filter($lines, fn (array $line) => Proximity::overlap($route['bounds'], $line['bounds'])) !== []));
        if ($routes === [] || $ridesM <= 0.0) {
            return 0.0;
        }
        $alongRoutes = 0.0;
        if ($ridesM >= self::LENGTH_SHARE * $routesM) {
            // Each line gives the points its length is of the whole's.
            $samples = array_map(fn (array $line) => LineSamples::spread($line['line'], $line['along'], max(2, (int) round(self::SAMPLES * $line['along'][count($line['line']) - 1] / $ridesM))), $lines);
            $alongRoutes = self::shareNear(array_merge(...$samples), $routes, $atLeast);
        }
        return max($alongRoutes, self::shareNear(array_merge(...array_column($routes, 'samples')), $lines, $atLeast));
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
