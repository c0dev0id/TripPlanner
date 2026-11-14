<?php

declare(strict_types=1);

namespace Planner\Export;

final class Polyline
{
    /** Whether the text is an encoded polyline: values of printable characters, each closed, in pairs. */
    public static function isWellFormed(string $encoded): bool
    {
        if (preg_match('/^[\x3f-\x7e]*$/', $encoded) !== 1) {
            return false;
        }
        // A character below 0x5f (63 + 32) closes a value; one at or above it continues it.
        $closed = array_sum(array_slice(count_chars($encoded, 0), 0x3f, 0x5f - 0x3f));
        return $closed % 2 === 0 && ($encoded === '' || ord($encoded[-1]) < 0x5f);
    }

    /**
     * Encodes [lng, lat] pairs as a polyline of the precision.
     *
     * @param list<array{0: float, 1: float}> $points
     */
    public static function encode(array $points, int $precision = 6): string
    {
        $factor = 10 ** $precision;
        $encoded = '';
        $last = [0, 0];
        foreach ($points as $point) {
            // Latitude first, each as the difference to the point before.
            foreach ([1, 0] as $axis) {
                $value = (int) round($point[$axis] * $factor);
                $delta = $value - $last[$axis];
                $last[$axis] = $value;
                $bits = $delta < 0 ? ~($delta << 1) : $delta << 1;
                while ($bits >= 0x20) {
                    $encoded .= chr((0x20 | ($bits & 0x1f)) + 63);
                    $bits >>= 5;
                }
                $encoded .= chr($bits + 63);
            }
        }
        return $encoded;
    }

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
        // A point is two numbers, the latitude's change first; a text cut off within a point ends the line at the point before.
        while ($index < $length) {
            $changes = [];
            for ($n = 0; $n < 2; $n++) {
                $result = 0;
                $shift = 0;
                do {
                    if ($index >= $length) {
                        return $points;
                    }
                    $byte = ord($encoded[$index++]) - 63;
                    $result |= ($byte & 0x1f) << $shift;
                    $shift += 5;
                } while ($byte >= 0x20);
                $changes[] = $result & 1 ? ~($result >> 1) : $result >> 1;
            }
            $lat += $changes[0];
            $lng += $changes[1];
            $points[] = [$lng / $factor, $lat / $factor];
        }
        return $points;
    }
}
