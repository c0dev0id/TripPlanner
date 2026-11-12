<?php

declare(strict_types=1);

namespace Planner\Trip;

use Planner\Export\Polyline;
use Planner\Export\RouteGeometry;
use Planner\Http\Json;

/**
 * A day's outline: the lines of its routes thinned to a few points each, to draw the
 * shape of a day or a trip without its document. Kept with the day, together with a key
 * of what it was made from, so that a save works it out again only for a day whose
 * routes changed.
 */
final class Outline
{
    /** The most points a route's line keeps. */
    public const MAX_POINTS = 32;

    /** How far a point may lie off the thinned line, as a share of the line's extent. */
    private const TOLERANCE = 0.01;

    /**
     * The outline as it is kept with a day: taken over from `$kept` where that was made
     * from the same routes, else worked out.
     */
    public static function stored(array $day, ?string $kept): string
    {
        $key = self::keyOf($day['routes']);
        if ($kept !== null && $kept !== '' && (json_decode($kept, true)['of'] ?? null) === $key) {
            return $kept;
        }
        return Json::encode(['of' => $key, 'lines' => self::linesOf($day['routes'])]);
    }

    /** @return list<array{line: string, color: ?string}> the lines of a kept outline; none for a day that has none yet */
    public static function lines(string $kept): array
    {
        return $kept === '' ? [] : json_decode($kept, true, 512, JSON_THROW_ON_ERROR)['lines'];
    }

    /** @return list<array{line: string, color: ?string}> each route's thinned line as polyline6, with the colour the route has of its own; routes without a line are left out */
    public static function linesOf(array $routes): array
    {
        $lines = [];
        foreach ($routes as $route) {
            $line = self::thinned(RouteGeometry::line($route));
            if (count($line) > 1) {
                $lines[] = ['line' => Polyline::encode($line), 'color' => $route['color'] ?? null];
            }
        }
        return $lines;
    }

    /** What decides the routes' outline, as a digest: their lines and colours. */
    private static function keyOf(array $routes): string
    {
        $digest = hash_init('md5');
        foreach ($routes as $route) {
            hash_update($digest, ($route['color'] ?? '') . '|' . $route['kind'] . '|');
            hash_update($digest, $route['kind'] === 'track' ? $route['line'] : Json::encode([$route['profile'], $route['highways'], $route['points'], (object) (array) $route['legs']]));
        }
        return hash_final($digest);
    }

    /**
     * The line with the points left out that lie within the tolerance of what remains
     * (Douglas–Peucker), the tolerance widened until at most MAX_POINTS are left.
     *
     * @param list<array{0: float, 1: float}> $line
     * @return list<array{0: float, 1: float}>
     */
    public static function thinned(array $line): array
    {
        if (count($line) < 3) {
            return $line;
        }
        $lngs = array_column($line, 0);
        $lats = array_column($line, 1);
        $scale = cos(deg2rad((min($lats) + max($lats)) / 2));
        $tolerance = self::TOLERANCE * hypot((max($lngs) - min($lngs)) * $scale, max($lats) - min($lats));
        do {
            $line = self::within($line, $tolerance, $scale);
            $tolerance = max($tolerance * 1.5, 1e-6);
        } while (count($line) > self::MAX_POINTS);
        return $line;
    }

    /** One pass of Douglas–Peucker, without recursion: a track has tens of thousands of points. */
    private static function within(array $line, float $tolerance, float $scale): array
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
