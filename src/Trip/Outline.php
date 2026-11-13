<?php

declare(strict_types=1);

namespace Planner\Trip;

use Planner\Export\Polyline;
use Planner\Export\RouteGeometry;
use Planner\Export\Thinning;
use Planner\Http\Json;

/**
 * A day's outline: the lines of its routes thinned to a few points each, to draw the
 * shape of a day or a trip without its document. Kept with the day, each line with the
 * length of its route and a key of what it was made from, so that a save thins and
 * measures only the routes it changes.
 */
final class Outline
{
    /** The most points a route's line keeps. */
    public const MAX_POINTS = 32;

    /** How far a point may lie off the thinned line, as a share of the line's extent. */
    private const TOLERANCE = 0.01;

    /**
     * The outline as it is kept with a day: for each of its routes a thinned line, the
     * route's length and a key of what both were made from. A route whose key is among
     * those of `$kept` keeps what is there; only the others are thinned and measured, so
     * that a save costs what it changed.
     */
    public static function stored(array $day, ?string $kept): string
    {
        $have = $kept === null || $kept === '' ? [] : array_column(json_decode($kept, true)['lines'] ?? [], null, 'of');
        $lines = [];
        foreach ($day['routes'] as $route) {
            $key = self::keyOf($route);
            $line = $have[$key] ?? self::lineOf($route, $key);
            if ($line !== null) {
                $lines[] = $line;
            }
        }
        return Json::encode(['lines' => $lines]);
    }

    /**
     * What a kept outline tells of its day: the length of its routes in metres and their
     * lines; nothing of a day that has none yet.
     *
     * @return array{distanceM: int, lines: list<array{line: string, color: ?string}>}
     */
    public static function read(string $kept): array
    {
        $lines = $kept === '' ? [] : json_decode($kept, true, 512, JSON_THROW_ON_ERROR)['lines'];
        return [
            'distanceM' => (int) array_sum(array_column($lines, 'm')),
            'lines' => array_map(fn (array $line): array => ['line' => $line['line'], 'color' => $line['color']], $lines),
        ];
    }

    /** @return list<array{line: string, color: ?string}> the lines of a kept outline */
    public static function lines(string $kept): array
    {
        return self::read($kept)['lines'];
    }

    /** @return ?array{of: string, line: string, color: ?string, m: int} the route's thinned line as polyline6, with its key, the colour the route has of its own and the route's length in metres; none for a route without a line */
    private static function lineOf(array $route, string $key): ?array
    {
        $whole = RouteGeometry::line($route);
        $line = self::thinned($whole);
        return count($line) > 1 ? ['of' => $key, 'line' => Polyline::encode($line), 'color' => $route['color'] ?? null, 'm' => (int) round(RouteGeometry::length($route, $whole))] : null;
    }

    /** What decides a route's line in the outline, as a digest: its line and its colour. */
    private static function keyOf(array $route): string
    {
        $made = $route['kind'] === 'track' ? $route['line'] : Json::encode([$route['profile'], $route['highways'], $route['points'], (object) (array) $route['legs']]);
        return md5(($route['color'] ?? '') . '|' . $route['kind'] . '|' . $made);
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
            $line = Thinning::within($line, $tolerance, $scale);
            $tolerance = max($tolerance * 1.5, 1e-6);
        } while (count($line) > self::MAX_POINTS);
        return $line;
    }
}
