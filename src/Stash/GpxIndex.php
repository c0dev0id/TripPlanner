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
 * many points it has and, of a track, when its first point was recorded. A route's line
 * follows the way Garmin's extension gives between its points, where the file has it.
 * Each also says what it carries that its row would not show otherwise: values on its
 * points, however the file writes them, Garmin's extensions of a route, and what DMD
 * and Rumo wrote into it.
 */
final readonly class GpxIndex
{
    private const KINDS = ['rte' => 'route', 'trk' => 'track'];

    /** What a route or a track may carry, in the order it is listed. */
    public const FEATURES = ['time', 'elevation', 'lean', 'acceleration', 'routeExtension', 'routePointExtension', 'dmd', 'rumo'];

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
     * any element of it under `*`: Garmin's extensions of a route and of its points, and
     * whatever DMD and Rumo write.
     */
    private const EXTENSIONS = [
        'http://www.garmin.com/xmlschemas/GpxExtensions/v3' => ['RouteExtension' => 'routeExtension', 'RoutePointExtension' => 'routePointExtension'],
        'https://dmdnavigation.com/ns/gpx/1' => ['*' => 'dmd'],
        'https://www.rumoadventures.com/xmlschemas/GpxExtensions/v1' => ['*' => 'rumo'],
    ];

    /** How many of a track's points are read whole for what they carry; the others are passed over once the track's start is known. */
    private const SAMPLED_POINTS = 10;

    /** @param list<array{kind: string, position: int, name: string, line: string, distanceM: int, points: int, startedAt: ?string, features: list<string>}> $items */
    private function __construct(public int $waypoints, public array $items)
    {
    }

    public static function of(string $gpx): self
    {
        $waypoints = 0;
        $items = [];
        $counts = ['route' => 0, 'track' => 0];
        // The route or track being read, its line as positions, how deep its track points stand, and how deep the point being read stands.
        $open = null;
        $line = [];
        $pointDepth = null;
        $inPoint = null;
        $close = function () use (&$open, &$line, &$items): void {
            $features = array_values(array_filter(self::FEATURES, fn (string $feature) => isset($open['features'][$feature])));
            $items[] = ['line' => Polyline::encode(Outline::thinned($line)), 'distanceM' => (int) round($open['distanceM']), 'features' => $features] + $open;
            $open = null;
        };
        $errors = libxml_use_internal_errors(true);
        $reader = new XMLReader();
        $reader->XML($gpx, null, LIBXML_NONET);
        // What a track point holds is passed over once the track's start is known and enough points were read whole: nothing else is read from it.
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
            if ($reader->depth === 1) {
                $waypoints += $element === 'wpt' ? 1 : 0;
                if (isset(self::KINDS[$element])) {
                    $kind = self::KINDS[$element];
                    $open = ['kind' => $kind, 'position' => $counts[$kind]++, 'name' => '', 'distanceM' => 0.0, 'points' => 0, 'startedAt' => null, 'features' => []];
                    $line = [];
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
                $passOver = $element === 'trkpt' && $open['startedAt'] !== null && $open['points'] > self::SAMPLED_POINTS;
            } elseif ($element === 'time' && $open['startedAt'] === null && $pointDepth !== null && $reader->depth === $pointDepth + 1) {
                $open['startedAt'] = TrackSummary::time($reader->readString());
            }
        }
        $reader->close();
        libxml_clear_errors();
        libxml_use_internal_errors($errors);
        return new self($waypoints, $items);
    }
}
