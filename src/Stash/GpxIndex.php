<?php

declare(strict_types=1);

namespace Planner\Stash;

use Planner\Export\Polyline;
use Planner\Export\Proximity;
use Planner\Recording\TrackSummary;
use Planner\Trip\Outline;
use XMLReader;

/**
 * What is read from a GPX file of the Stash to list, find and draw what it holds without
 * the file: how many waypoints, and each route and track by its place among the file's
 * routes or tracks, with its name, its line thinned as an outline's is, its length, how
 * many points it has and when it starts: a track when its first point was recorded, a
 * route when its first point is planned to be left, where Garmin's trip planning says. A route's line
 * follows the way Garmin's extension gives between its points, where the file has it.
 * Each also says what it carries that its row would not show otherwise: values on its
 * points, however the file writes them, Garmin's extensions of a route, and what DMD
 * and Rumo wrote into it. Of the file itself it says what wrote it and when, as its
 * head has them: files written together belong together.
 */
final readonly class GpxIndex
{
    private const KINDS = ['rte' => 'route', 'trk' => 'track'];

    /** What a route or a track may carry, in the order it is listed. */
    public const FEATURES = ['time', 'elevation', 'lean', 'acceleration', 'routeExtension', 'routePointExtension', 'tripExtension', 'dmd', 'rumo'];

    /**
     * The values a point may carry, by the names files give them: a point's own elements
     * and those of its extensions alike, in whatever namespace (Ridelink writes
     * lean_angle and acc_x, acc_y, acc_z).
     */
    private const POINT_VALUES = [
        'time' => 'time',
        'ele' => 'elevation',
        'lean_angle' => 'lean',
        'acc_x' => 'acceleration',
        'acc_y' => 'acceleration',
        'acc_z' => 'acceleration',
    ];

    /**
     * What an extension says a route or a track carries, by its namespace and its element,
     * any element of it under `*`: Garmin's extensions of a route and of its points, its
     * trip planning, and whatever DMD and Rumo write.
     */
    private const EXTENSIONS = [
        'http://www.garmin.com/xmlschemas/GpxExtensions/v3' => ['RouteExtension' => 'routeExtension', 'RoutePointExtension' => 'routePointExtension'],
        self::TRIP_EXTENSIONS => ['*' => 'tripExtension'],
        self::DMD => ['*' => 'dmd'],
        'https://www.rumoadventures.com/xmlschemas/GpxExtensions/v1' => ['*' => 'rumo'],
    ];

    /** The namespace of what DMD's planner writes into a route: among it the way it calculated for the route as a whole. */
    private const DMD = 'https://dmdnavigation.com/ns/gpx/1';

    /** The namespace of Garmin's trip planning, which says which of a route's points are stops and when they are left. */
    private const TRIP_EXTENSIONS = 'http://www.garmin.com/xmlschemas/TripExtensions/v1';

    /** How many of a track's points are read whole for what they carry; the others are passed over once the track's start is known. */
    private const SAMPLED_POINTS = 10;

    /** @param list<array{kind: string, position: int, name: string, line: string, distanceM: int, points: int, startedAt: ?string, features: list<string>}> $items */
    private function __construct(public int $waypoints, public array $items, public ?string $creator, public ?string $exportedAt)
    {
    }

    public static function of(string $gpx): self
    {
        $waypoints = 0;
        $items = [];
        $creator = null;
        $exportedAt = null;
        $inMetadata = false;
        $counts = ['route' => 0, 'track' => 0];
        // The route or track being read, its line as positions, how deep its track points stand, and how deep the point being read stands.
        $open = null;
        $line = [];
        $pointDepth = null;
        $inPoint = null;
        // The way DMD calculated for the route being read, and whether Garmin's way was read between its points, which then is the route's line.
        $calculated = [];
        $between = false;
        $close = function () use (&$open, &$line, &$items, &$calculated, &$between): void {
            $features = array_values(array_filter(self::FEATURES, fn (string $feature) => isset($open['features'][$feature])));
            if (!$between && count($calculated) > 1) {
                $line = $calculated;
                $open['distanceM'] = 0.0;
                for ($i = 1; $i < count($line); $i++) {
                    $open['distanceM'] += Proximity::between($line[$i - 1], $line[$i]);
                }
            }
            $items[] = ['line' => Polyline::encode(Outline::thinned($line)), 'distanceM' => (int) round($open['distanceM']), 'features' => $features] + $open;
            $open = null;
        };
        $errors = libxml_use_internal_errors(true);
        $reader = new XMLReader();
        $reader->XML($gpx, null, LIBXML_NONET);
        // Passed over, since nothing else is read from it: what a point of the calculated way holds, and what a track point holds once the track's start is known and enough points were read whole.
        $passOver = false;
        while ($passOver ? $reader->next() : $reader->read()) {
            $passOver = false;
            if ($reader->nodeType === XMLReader::END_ELEMENT && $reader->depth === 1 && $open !== null) {
                $close();
            }
            if ($reader->nodeType !== XMLReader::ELEMENT) {
                continue;
            }
            $element = $reader->localName;
            if ($reader->depth === 0) {
                $creator = trim((string) $reader->getAttribute('creator')) ?: null;
                continue;
            }
            // The file's time stands in its metadata, in GPX 1.0 at its top.
            if ($element === 'time' && ($reader->depth === 1 || ($inMetadata && $reader->depth === 2))) {
                $exportedAt = TrackSummary::time($reader->readString());
            }
            if ($reader->depth === 1) {
                $inMetadata = $element === 'metadata';
                $waypoints += $element === 'wpt' ? 1 : 0;
                if (isset(self::KINDS[$element])) {
                    $kind = self::KINDS[$element];
                    $open = ['kind' => $kind, 'position' => $counts[$kind]++, 'name' => '', 'distanceM' => 0.0, 'points' => 0, 'startedAt' => null, 'features' => []];
                    $line = [];
                    $calculated = [];
                    $between = false;
                    $pointDepth = null;
                    $inPoint = null;
                    if ($reader->isEmptyElement) {
                        $close();
                    }
                }
                continue;
            }
            if ($open === null) {
                continue;
            }
            // An element no deeper than the point read last stands beside it or above it.
            $inPoint = $inPoint !== null && $reader->depth > $inPoint ? $inPoint : null;
            $feature = $inPoint !== null ? (self::POINT_VALUES[$element] ?? null) : null;
            $extension = self::EXTENSIONS[$reader->namespaceURI] ?? [];
            $feature ??= $extension[$element] ?? $extension['*'] ?? null;
            if ($feature !== null) {
                $open['features'][$feature] = true;
            }
            // A route starts when Garmin's trip planning has its first point leave.
            if ($element === 'DepartureTime' && $open['kind'] === 'route' && $open['startedAt'] === null && $reader->namespaceURI === self::TRIP_EXTENSIONS) {
                $open['startedAt'] = TrackSummary::time($reader->readString());
            }
            if ($element === 'CalculatedRoute' && $open['kind'] === 'route' && $reader->namespaceURI === self::DMD) {
                $calculated = self::positions($reader->readString());
            }
            $between = $between || $element === 'rpt';
            if ($element === 'name' && $reader->depth === 2) {
                $open['name'] = trim($reader->readString());
            } elseif ($element === 'rtept' || $element === 'trkpt' || $element === 'rpt') {
                [$lat, $lng] = [$reader->getAttribute('lat'), $reader->getAttribute('lon')];
                if (is_numeric($lat) && is_numeric($lng)) {
                    $point = [(float) $lng, (float) $lat];
                    $open['distanceM'] += $line === [] ? 0.0 : Proximity::between($line[count($line) - 1], $point);
                    $line[] = $point;
                    $open['points'] += $element === 'rpt' ? 0 : 1;
                }
                $pointDepth = $element === 'trkpt' ? $reader->depth : $pointDepth;
                $inPoint = $element === 'rpt' ? $inPoint : $reader->depth;
                $passOver = $element === 'rpt' || ($element === 'trkpt' && $open['startedAt'] !== null && $open['points'] > self::SAMPLED_POINTS);
            } elseif ($element === 'time' && $open['startedAt'] === null && $pointDepth !== null && $reader->depth === $pointDepth + 1) {
                $open['startedAt'] = TrackSummary::time($reader->readString());
            }
        }
        $reader->close();
        libxml_clear_errors();
        libxml_use_internal_errors($errors);
        return new self($waypoints, $items, $creator, $exportedAt);
    }

    /**
     * The positions of a way as DMD writes it: `lat,lon,ele` for each point, with a semicolon between.
     *
     * @return list<array{0: float, 1: float}>
     */
    private static function positions(string $way): array
    {
        $positions = [];
        foreach (explode(';', $way) as $point) {
            $parts = explode(',', trim($point));
            if (count($parts) >= 2 && is_numeric($parts[0]) && is_numeric($parts[1])) {
                $positions[] = [(float) $parts[1], (float) $parts[0]];
            }
        }
        return $positions;
    }
}
