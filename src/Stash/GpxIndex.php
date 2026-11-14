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
 */
final readonly class GpxIndex
{
    private const KINDS = ['rte' => 'route', 'trk' => 'track'];

    /** @param list<array{kind: string, position: int, name: string, line: string, distanceM: int, points: int, startedAt: ?string}> $items */
    private function __construct(public int $waypoints, public array $items)
    {
    }

    public static function of(string $gpx): self
    {
        $waypoints = 0;
        $items = [];
        $counts = ['route' => 0, 'track' => 0];
        // The route or track being read, its line as positions, and how deep its track points stand.
        $open = null;
        $line = [];
        $pointDepth = null;
        $close = function () use (&$open, &$line, &$items): void {
            $items[] = ['line' => Polyline::encode(Outline::thinned($line)), 'distanceM' => (int) round($open['distanceM'])] + $open;
            $open = null;
        };
        $errors = libxml_use_internal_errors(true);
        $reader = new XMLReader();
        $reader->XML($gpx, null, LIBXML_NONET);
        while ($reader->read()) {
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
                    $open = ['kind' => $kind, 'position' => $counts[$kind]++, 'name' => '', 'distanceM' => 0.0, 'points' => 0, 'startedAt' => null];
                    $line = [];
                    $pointDepth = null;
                    if ($reader->isEmptyElement) {
                        $close();
                    }
                }
            } elseif ($open === null) {
                continue;
            } elseif ($element === 'name' && $reader->depth === 2) {
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
