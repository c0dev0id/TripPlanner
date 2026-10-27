<?php

declare(strict_types=1);

namespace Planner\Export;

final class Polyline
{
    /**
     * Decodes an encoded polyline (Google's format, as OSRM returns it) to [lng, lat]
     * pairs; OSRM's polyline6 has precision 6.
     *
     * @return list<array{0: float, 1: float}>
     */
    public static function decode(string $encoded, int $precision = 6): array
    {
        $factor = 10 ** $precision;
        $points = [];
        $index = 0;
        $length = strlen($encoded);
        $lat = 0;
        $lng = 0;
        $next = function () use ($encoded, &$index): int {
            $result = 0;
            $shift = 0;
            do {
                $byte = ord($encoded[$index++]) - 63;
                $result |= ($byte & 0x1f) << $shift;
                $shift += 5;
            } while ($byte >= 0x20);
            return $result & 1 ? ~($result >> 1) : $result >> 1;
        };
        while ($index < $length) {
            $lat += $next();
            $lng += $next();
            $points[] = [$lng / $factor, $lat / $factor];
        }
        return $points;
    }
}
