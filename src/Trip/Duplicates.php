<?php

declare(strict_types=1);

namespace Planner\Trip;

use PDO;
use Planner\Export\Proximity;
use Planner\Export\RouteGeometry;

/**
 * The routes of a user's library that are kept more than once: exact copies, with the same
 * points or the same line, and the same ride kept twice (from two apps, or as a planned
 * route and as the track recorded of it), which runs the same way at about the same length
 * along about the same line, on the same date or where a day has none. The same road
 * ridden on different dates is no duplicate.
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
            'SELECT r.id, r.name, r.kind, r.profile, r.highways, r.optional, r.points, r.legs, r.line,
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
        return array_map(fn (array $members) => [
            'kind' => count(array_unique(array_map(fn (int $i) => $routes[$i]['copy'], $members))) === 1 ? 'copies' : 'same ride',
            'routes' => array_map(fn (int $i) => $routes[$i]['entry'], $members),
        ], self::groups($routes));
    }

    /** What a route is first compared by, with where it is and the route itself; null for a route of less than two points. */
    private static function summary(array $row): ?array
    {
        $route = TripDocuments::route($row);
        $line = RouteGeometry::line($route);
        if (count($line) < 2) {
            return null;
        }
        $lengthM = self::along($line)[count($line) - 1];
        $lngs = array_column($line, 0);
        $lats = array_column($line, 1);
        return [
            'route' => $route,
            'copy' => $route['kind'] === 'track' ? 'track:' . md5($route['line']) : 'routed:' . md5(json_encode(array_column($route['points'], 'lngLat'))),
            'start' => $line[0],
            'end' => $line[count($line) - 1],
            'lengthM' => $lengthM,
            'box' => [min($lngs), min($lats), max($lngs), max($lats)],
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
                if (self::shareNear($a['samples'], $b['outline']) >= self::SHARE_NEAR && self::shareNear($b['samples'], $a['outline']) >= self::SHARE_NEAR) {
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
            && $a['box'][0] <= $b['box'][2] && $b['box'][0] <= $a['box'][2] && $a['box'][1] <= $b['box'][3] && $b['box'][1] <= $a['box'][3]
            && Proximity::between($a['start'], $b['start']) <= self::ENDS_WITHIN_M
            && Proximity::between($a['end'], $b['end']) <= self::ENDS_WITHIN_M;
    }

    /** The share of the points that lie within LINE_WITHIN_M of the line. */
    private static function shareNear(array $points, array $line): float
    {
        $near = 0;
        foreach ($points as $point) {
            if (Proximity::toLine($point, $line) <= self::LINE_WITHIN_M) {
                $near++;
            }
        }
        return $near / count($points);
    }

    /** @return array{samples: list<array{0: float, 1: float}>, outline: list<array{0: float, 1: float}>} points spread evenly along the route's line */
    private static function pointsAlong(array $route): array
    {
        $line = RouteGeometry::line($route);
        $along = self::along($line);
        return ['samples' => self::spread($line, $along, self::SAMPLES), 'outline' => self::spread($line, $along, self::OUTLINE)];
    }

    /** @return list<float> the metres from the start of the line to each of its points */
    private static function along(array $line): array
    {
        $along = [0.0];
        for ($i = 1, $n = count($line); $i < $n; $i++) {
            $along[] = $along[$i - 1] + Proximity::between($line[$i - 1], $line[$i]);
        }
        return $along;
    }

    /**
     * `$count` points spread evenly along the line by length, from its start to its end.
     *
     * @param list<float> $along the metres from the start to each point of the line
     */
    private static function spread(array $line, array $along, int $count): array
    {
        $points = [];
        $segment = 1;
        $last = count($line) - 1;
        for ($k = 0; $k < $count; $k++) {
            $at = $along[$last] * $k / ($count - 1);
            while ($segment < $last && $along[$segment] < $at) {
                $segment++;
            }
            $length = $along[$segment] - $along[$segment - 1];
            $t = $length > 0 ? ($at - $along[$segment - 1]) / $length : 0.0;
            [$a, $b] = [$line[$segment - 1], $line[$segment]];
            $points[] = [$a[0] + $t * ($b[0] - $a[0]), $a[1] + $t * ($b[1] - $a[1])];
        }
        return $points;
    }
}
