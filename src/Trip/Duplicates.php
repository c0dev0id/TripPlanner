<?php

declare(strict_types=1);

namespace Planner\Trip;

use PDO;
use Planner\Database;
use Planner\Export\LineSamples;
use Planner\Export\Polyline;
use Planner\Export\Proximity;
use Planner\Export\RouteGeometry;

/**
 * The routes of a user's library that are kept more than once: exact copies, with the same
 * points or the same line, and the same ride kept twice (from two apps, or as a planned
 * route and as the track recorded of it), which runs the same way at about the same length
 * along about the same line, on the same date or where a day has none. The same road
 * ridden on different dates is no duplicate. Nor is a day's planned route beside the
 * tracks recorded of it on that day: they belong together. Once anything outside that day
 * is the same ride too, or the day holds a route or a track twice, the group is listed
 * whole.
 */
final class Duplicates
{
    /** How far apart the starts and the ends of the same ride may be. */
    private const ENDS_WITHIN_M = 1000;
    /** How much shorter than the other the same ride may be. */
    private const LENGTH_RATIO = 0.9;
    /** How far from the other line a point of the same ride may be, and the share of its points that must be that near. */
    private const LINE_WITHIN_M = 75;
    private const SHARE_NEAR = 0.9;
    /** Points taken evenly along a line to compare it, and to compare it against. */
    private const SAMPLES = 64;
    private const OUTLINE = 400;

    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * The groups of duplicates, each `copies` or `same ride`, with the routes in it: where
     * each is (trip, day) and what it is (name, length).
     *
     * @return list<array{kind: string, routes: list<array<string, mixed>>}>
     */
    public function of(int $userId): array
    {
        $statement = $this->db->prepare(
            'SELECT r.id, r.name, r.kind, r.profile, r.highways, r.optional, r.color, r.points, r.legs, r.line,
                    d.id AS day_id, d.name AS day_name, d.date, d.position AS day_index, t.id AS trip_id, t.name AS trip_name, t.kind AS trip_kind
             FROM routes r JOIN days d ON d.id = r.day_id JOIN trips t ON t.id = d.trip_id
             WHERE t.user_id = ? ORDER BY t.name, t.id, d.position, r.position',
        );
        $statement->execute([$userId]);
        $routes = [];
        foreach ($statement as $row) {
            $summary = self::summary($row);
            if ($summary !== null) {
                $routes[] = $summary;
            }
        }
        $groups = array_map(fn (array $members) => array_map(fn (int $i) => $routes[$i], $members), self::groups($routes));
        return array_map(fn (array $group) => [
            'kind' => count(array_unique(array_column($group, 'copy'))) === 1 ? 'copies' : 'same ride',
            'routes' => array_column($group, 'entry'),
        ], array_values(array_filter($groups, fn (array $group) => !self::planWithItsRecordings($group))));
    }

    /** Whether the routes are one day's alone, none a copy of another, and at most one of them planned: the plan, if any, and what was recorded of it. */
    private static function planWithItsRecordings(array $routes): bool
    {
        $days = array_unique(array_column(array_column($routes, 'entry'), 'dayId'));
        $planned = array_filter($routes, fn (array $route) => $route['route']['kind'] === 'routed');
        return count($days) === 1 && count($planned) <= 1 && count(array_unique(array_column($routes, 'copy'))) === count($routes);
    }

    /**
     * The lines of the user's routes among `$routeIds`, for the report to draw them: each
     * as polyline6 by the route's id, a track's own and a routed route's along its legs.
     *
     * @param list<string> $routeIds
     * @return array<string, string>
     */
    public function lines(int $userId, array $routeIds): array
    {
        if ($routeIds === []) {
            return [];
        }
        $statement = $this->db->prepare(
            'SELECT r.id, r.name, r.kind, r.profile, r.highways, r.optional, r.color, r.points, r.legs, r.line
             FROM routes r JOIN days d ON d.id = r.day_id JOIN trips t ON t.id = d.trip_id
             WHERE t.user_id = ? AND r.id IN (' . Database::placeholders($routeIds) . ')',
        );
        $statement->execute([$userId, ...$routeIds]);
        $lines = [];
        foreach ($statement as $row) {
            $route = TripDocuments::route($row);
            $lines[$row['id']] = $route['kind'] === 'track' ? $route['line'] : Polyline::encode(RouteGeometry::line($route));
        }
        return $lines;
    }

    /** What a route is first compared by, with where it is and the route itself; null for a route of less than two points. */
    private static function summary(array $row): ?array
    {
        $route = TripDocuments::route($row);
        $line = RouteGeometry::line($route);
        if (count($line) < 2) {
            return null;
        }
        $lengthM = LineSamples::along($line)[count($line) - 1];
        return [
            'route' => $route,
            'copy' => $route['kind'] === 'track' ? 'track:' . md5($route['line']) : 'routed:' . md5(json_encode(array_column($route['points'], 'lngLat'))),
            'start' => $line[0],
            'end' => $line[count($line) - 1],
            'lengthM' => $lengthM,
            'box' => Proximity::bounds($line),
            'date' => $row['date'],
            'entry' => [
                'tripId' => (int) $row['trip_id'],
                'tripName' => $row['trip_name'],
                'tripKind' => $row['trip_kind'],
                'dayId' => $row['day_id'],
                'dayIndex' => (int) $row['day_index'],
                'dayName' => $row['day_name'],
                'date' => $row['date'],
                'routeId' => $row['id'],
                'routeName' => $row['name'],
                'distanceM' => (int) round($lengthM),
            ],
        ];
    }

    /**
     * The routes joined into groups where one is a copy of another or the same ride; a
     * group is all copies or holds the same ride kept more than once. A route's points along
     * its line are worked out only once the cheap tests leave it a candidate, and dropped
     * when it has been compared with every route after it.
     *
     * @return list<list<int>> the routes' indices by group, in their order
     */
    private static function groups(array $routes): array
    {
        $parent = array_keys($routes);
        $root = function (int $i) use (&$parent): int {
            while ($parent[$i] !== $i) {
                $i = $parent[$i] = $parent[$parent[$i]];
            }
            return $i;
        };
        $firstWithKey = [];
        foreach ($routes as $i => $route) {
            $first = $firstWithKey[$route['copy']] ??= $i;
            $parent[$root($i)] = $root($first);
        }
        $points = [];
        for ($i = 0, $n = count($routes); $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                if ($root($i) === $root($j) || !self::alike($routes[$i], $routes[$j])) {
                    continue;
                }
                $a = $points[$i] ??= self::pointsAlong($routes[$i]['route']);
                $b = $points[$j] ??= self::pointsAlong($routes[$j]['route']);
                if (LineSamples::shareNear($a['samples'], $b['outline'], self::LINE_WITHIN_M) >= self::SHARE_NEAR && LineSamples::shareNear($b['samples'], $a['outline'], self::LINE_WITHIN_M) >= self::SHARE_NEAR) {
                    $parent[$root($j)] = $root($i);
                }
            }
            unset($points[$i]);
        }
        $groups = [];
        foreach (array_keys($routes) as $i) {
            $groups[$root($i)][] = $i;
        }
        return array_values(array_filter($groups, fn (array $members) => count($members) > 1));
    }

    /** Whether two routes could be the same ride by their dates, lengths, boxes and ends. */
    private static function alike(array $a, array $b): bool
    {
        return ($a['date'] === null || $b['date'] === null || $a['date'] === $b['date'])
            && min($a['lengthM'], $b['lengthM']) >= self::LENGTH_RATIO * max($a['lengthM'], $b['lengthM'])
            && Proximity::overlap($a['box'], $b['box'])
            && Proximity::between($a['start'], $b['start']) <= self::ENDS_WITHIN_M
            && Proximity::between($a['end'], $b['end']) <= self::ENDS_WITHIN_M;
    }

    /** @return array{samples: list<array{0: float, 1: float}>, outline: list<array{0: float, 1: float}>} points spread evenly along the route's line */
    private static function pointsAlong(array $route): array
    {
        $line = RouteGeometry::line($route);
        $along = LineSamples::along($line);
        return ['samples' => LineSamples::spread($line, $along, self::SAMPLES), 'outline' => LineSamples::spread($line, $along, self::OUTLINE)];
    }
}
