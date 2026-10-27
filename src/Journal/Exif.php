<?php

declare(strict_types=1);

namespace Planner\Journal;

/** When and where a photo was taken, from its EXIF data. */
final class Exif
{
    /** @return array{takenAt: ?string, lngLat: ?array{0: float, 1: float}} */
    public static function read(string $path, string $mediaType): array
    {
        if ($mediaType !== 'image/jpeg' || !function_exists('exif_read_data')) {
            return ['takenAt' => null, 'lngLat' => null];
        }
        $data = @exif_read_data($path, 'EXIF,GPS', true);
        return self::fromData($data === false ? [] : $data);
    }

    /**
     * From the sections exif_read_data gives: the time as the camera wrote it (local, no
     * zone), and the position where the GPS section is complete.
     *
     * @return array{takenAt: ?string, lngLat: ?array{0: float, 1: float}}
     */
    public static function fromData(array $data): array
    {
        $time = $data['EXIF']['DateTimeOriginal'] ?? null;
        $takenAt = is_string($time) && preg_match('/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})$/', $time, $m) ? "$m[1]-$m[2]-$m[3]T$m[4]" : null;
        $gps = $data['GPS'] ?? [];
        $lat = self::degrees($gps['GPSLatitude'] ?? null, $gps['GPSLatitudeRef'] ?? null, 'S');
        $lng = self::degrees($gps['GPSLongitude'] ?? null, $gps['GPSLongitudeRef'] ?? null, 'W');
        $lngLat = $lat === null || $lng === null || abs($lat) > 90 || abs($lng) > 180 ? null : [$lng, $lat];
        return ['takenAt' => $takenAt, 'lngLat' => $lngLat];
    }

    /** Degrees from EXIF's three rationals (degrees, minutes, seconds) and the hemisphere. */
    private static function degrees(mixed $parts, mixed $ref, string $negative): ?float
    {
        if (!is_array($parts) || count($parts) !== 3 || !is_string($ref)) {
            return null;
        }
        $values = array_map(self::rational(...), $parts);
        if (in_array(null, $values, true)) {
            return null;
        }
        $degrees = $values[0] + $values[1] / 60 + $values[2] / 3600;
        return strtoupper($ref) === $negative ? -$degrees : $degrees;
    }

    private static function rational(mixed $value): ?float
    {
        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }
        if (!is_string($value) || !preg_match('/^(\d+)\/(\d+)$/', $value, $m) || (int) $m[2] === 0) {
            return null;
        }
        return (int) $m[1] / (int) $m[2];
    }
}
