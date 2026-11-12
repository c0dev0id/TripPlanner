<?php

declare(strict_types=1);

namespace Planner\Export;

/** The line of a route and its length: a track's own, or a routed route's from its points and the legs the client routed between them. */
final class RouteGeometry
{
    /**
     * The key a leg's geometry is kept under, as the client builds it: the profile, the
     * motorway dial and both ends, each coordinate written as JavaScript writes a number
     * rounded to six decimals.
     */
    public static function legKey(string $profile, string $highways, array $from, array $to): string
    {
        $c = self::coordinate(...);
        return "$profile:$highways/{$c($from[0])},{$c($from[1])};{$c($to[0])},{$c($to[1])}";
    }

    /**
     * The route's line: a track's own; of a routed route each leg's routed geometry where
     * the client has it, the straight line between the leg's ends otherwise, without a point
     * repeating the one before.
     *
     * @return list<array{0: float, 1: float}>
     */
    public static function line(array $route): array
    {
        if ($route['kind'] === 'track') {
            return Polyline::decode($route['line']);
        }
        $points = $route['points'];
        $legs = (array) $route['legs'];
        $line = [];
        for ($i = 1, $n = count($points); $i < $n; $i++) {
            $from = $points[$i - 1]['lngLat'];
            $to = $points[$i]['lngLat'];
            $leg = ($points[$i]['straight'] ?? false) ? null : $legs[self::legKey($route['profile'], $route['highways'], $from, $to)] ?? null;
            $coordinates = $leg === null ? [$from, $to] : Polyline::decode($leg['geometry']);
            foreach ($coordinates as $point) {
                $last = $line[count($line) - 1] ?? null;
                if ($last === null || $last[0] != $point[0] || $last[1] != $point[1]) {
                    $line[] = [(float) $point[0], (float) $point[1]];
                }
            }
        }
        return $line;
    }

    /**
     * The route's length in metres as the planner counts it: along a track's line, a leg
     * as it was routed, and as the crow flies for a straight leg or one not routed.
     */
    public static function length(array $route): float
    {
        if ($route['kind'] === 'track') {
            $line = Polyline::decode($route['line']);
            $length = 0.0;
            for ($i = 1, $n = count($line); $i < $n; $i++) {
                $length += self::between($line[$i - 1], $line[$i]);
            }
            return $length;
        }
        $points = $route['points'];
        $legs = (array) $route['legs'];
        $length = 0.0;
        for ($i = 1, $n = count($points); $i < $n; $i++) {
            $from = $points[$i - 1]['lngLat'];
            $to = $points[$i]['lngLat'];
            $leg = ($points[$i]['straight'] ?? false) ? null : $legs[self::legKey($route['profile'], $route['highways'], $from, $to)] ?? null;
            $length += $leg === null ? self::between($from, $to) : $leg['distanceM'];
        }
        return $length;
    }

    /** The great-circle distance between two positions in metres, by the formula and the radius the planner uses, so that both tell the same length. */
    private static function between(array $a, array $b): float
    {
        $h = sin(deg2rad($b[1] - $a[1]) / 2) ** 2 + cos(deg2rad($a[1])) * cos(deg2rad($b[1])) * sin(deg2rad($b[0] - $a[0]) / 2) ** 2;
        return 2 * 6_371_008.8 * asin(min(1.0, sqrt($h)));
    }

    /** A coordinate as JavaScript's `${n}` writes it for a number rounded to six decimals. */
    private static function coordinate(float $value): string
    {
        $text = number_format($value == 0 ? 0.0 : $value, 6, '.', '');
        return rtrim(rtrim($text, '0'), '.');
    }
}
