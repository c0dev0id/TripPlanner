<?php

declare(strict_types=1);

namespace Planner\Export;

/** The line of a route from its points and the legs the client routed between them. */
final class RouteGeometry
{
    /**
     * The key a leg's geometry is kept under, as the client builds it: the profile and both
     * ends, each coordinate written as JavaScript writes a number rounded to six decimals.
     */
    public static function legKey(string $profile, array $from, array $to): string
    {
        $c = self::coordinate(...);
        return "$profile/{$c($from[0])},{$c($from[1])};{$c($to[0])},{$c($to[1])}";
    }

    /**
     * The route's line: each leg's routed geometry where the client has it, the straight
     * line between the leg's ends otherwise, without a point repeating the one before.
     *
     * @return list<array{0: float, 1: float}>
     */
    public static function line(array $route): array
    {
        $points = $route['points'];
        $legs = (array) $route['legs'];
        $line = [];
        for ($i = 1, $n = count($points); $i < $n; $i++) {
            $from = $points[$i - 1]['lngLat'];
            $to = $points[$i]['lngLat'];
            $leg = ($points[$i]['straight'] ?? false) ? null : $legs[self::legKey($route['profile'], $from, $to)] ?? null;
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

    /** A coordinate as JavaScript's `${n}` writes it for a number rounded to six decimals. */
    private static function coordinate(float $value): string
    {
        $text = number_format($value == 0 ? 0.0 : $value, 6, '.', '');
        return rtrim(rtrim($text, '0'), '.');
    }
}
