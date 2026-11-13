<?php

declare(strict_types=1);

namespace Planner\Recording;

use DateTimeImmutable;
use Planner\Export\Polyline;
use Planner\Export\Proximity;
use Planner\Export\Thinning;
use Planner\Timestamp;
use XMLReader;

/**
 * What is read from a recording's file to list and find it without the file: its line
 * thinned, as polyline6, its length in metres and the time of its first point, where the
 * file has one. A file that cannot be read has no line.
 */
final readonly class TrackSummary
{
    /** How far from the thinned line a point left out may lie. */
    private const THIN_M = 10;

    private function __construct(
        public string $line,
        public int $distanceM,
        public ?string $startedAt,
    ) {
    }

    /** Reads the track points of a GPX file, in the file's order, whatever tracks and segments they are in. */
    public static function of(string $gpx): self
    {
        $points = [];
        $startedAt = null;
        $pointDepth = null;
        $distanceM = 0.0;
        $errors = libxml_use_internal_errors(true);
        $reader = new XMLReader();
        $reader->XML($gpx, null, LIBXML_NONET);
        while ($reader->read()) {
            if ($reader->nodeType !== XMLReader::ELEMENT) {
                continue;
            }
            if ($reader->localName === 'trkpt') {
                $pointDepth = $reader->depth;
                [$lat, $lng] = [$reader->getAttribute('lat'), $reader->getAttribute('lon')];
                if (is_numeric($lat) && is_numeric($lng)) {
                    $point = [(float) $lng, (float) $lat];
                    $distanceM += $points === [] ? 0.0 : Proximity::between($points[count($points) - 1], $point);
                    $points[] = $point;
                }
            } elseif ($startedAt === null && $reader->localName === 'time' && $pointDepth !== null && $reader->depth === $pointDepth + 1) {
                $startedAt = self::time($reader->readString());
            }
        }
        $reader->close();
        libxml_clear_errors();
        libxml_use_internal_errors($errors);
        return new self(Polyline::encode(Thinning::toMetres($points, self::THIN_M)), (int) round($distanceM), $startedAt);
    }

    /** The time a point gives, in the database's form; null where it gives none that can be read. */
    private static function time(string $text): ?string
    {
        try {
            return Timestamp::of(new DateTimeImmutable(trim($text)));
        } catch (\Exception) {
            return null;
        }
    }
}
