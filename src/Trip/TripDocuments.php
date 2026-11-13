<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use PDO;
use Planner\Database;
use Planner\Http\Json;
use Planner\Timestamp;

/**
 * A trip's content as one document: its days with their routes and stops, in the shape
 * the client works with (see TripDocumentValidator).
 */
final class TripDocuments
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** The user's trip with everything in it, or null when there is no such trip. */
    public function load(int $userId, int $tripId): ?array
    {
        return $this->document('id = ? AND user_id = ?', [$tripId, $userId]);
    }

    /**
     * The outlines of the user's trips, by trip: its days in order, each by its id, name
     * and date with how many routes and stops it holds, its length and the thinned lines
     * of its routes (see Outline). Enough to list a trip's days as the open trip lists
     * its own and to draw its shape, without its document.
     *
     * @return array<int, list<array{id: string, name: string, date: ?string, routes: int, stops: int, distanceM: int, lines: list<array{line: string, color: ?string}>}>>
     */
    public function outlines(int $userId): array
    {
        $outlines = [];
        $days = 'SELECT d.trip_id, d.id, d.name, d.date, d.outline,
                        (SELECT COUNT(*) FROM routes WHERE day_id = d.id) AS routes, (SELECT COUNT(*) FROM stops WHERE day_id = d.id) AS stops
                 FROM days d JOIN trips t ON t.id = d.trip_id WHERE t.user_id = ? ORDER BY d.trip_id, d.position';
        foreach ($this->rows($days, $userId) as $day) {
            $outlines[(int) $day['trip_id']][] = [
                'id' => $day['id'],
                'name' => $day['name'],
                'date' => $day['date'],
                'routes' => (int) $day['routes'],
                'stops' => (int) $day['stops'],
            ] + Outline::read($day['outline']);
        }
        return $outlines;
    }

    /** The trip shared under the token, or null when none is. */
    public function loadShared(string $token): ?array
    {
        return $this->document('share_token = ?', [$token]);
    }

    private function document(string $where, array $params): ?array
    {
        $statement = $this->db->prepare("SELECT id, kind, name, description, state, version FROM trips WHERE $where");
        $statement->execute($params);
        $trip = $statement->fetch();
        if ($trip === false) {
            return null;
        }
        $tripId = (int) $trip['id'];
        $days = [];
        foreach ($this->rows('SELECT id, name, date, notes FROM days WHERE trip_id = ? ORDER BY position', $tripId) as $day) {
            $days[$day['id']] = ['id' => $day['id'], 'name' => $day['name'], 'date' => $day['date'], 'notes' => $day['notes'], 'routes' => [], 'stops' => []];
        }
        $routes = 'SELECT id, day_id, name, kind, profile, highways, optional, color, points, legs, line FROM routes WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?) ORDER BY position';
        foreach ($this->rows($routes, $tripId) as $row) {
            $days[$row['day_id']]['routes'][] = self::route($row);
        }
        $stops = 'SELECT id, day_id, name, symbol, lng, lat, point_id, address, contact, booking_reference, notes, arrive_at, pause_minutes, optional
                  FROM stops WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?) ORDER BY position';
        foreach ($this->rows($stops, $tripId) as $stop) {
            $days[$stop['day_id']]['stops'][] = [
                'id' => $stop['id'],
                'name' => $stop['name'],
                'symbol' => $stop['symbol'],
                'lngLat' => [(float) $stop['lng'], (float) $stop['lat']],
                'pointId' => $stop['point_id'],
                'address' => $stop['address'],
                'contact' => $stop['contact'],
                'bookingReference' => $stop['booking_reference'],
                'notes' => $stop['notes'],
                'arriveAt' => $stop['arrive_at'],
                'pauseMinutes' => $stop['pause_minutes'] === null ? null : (int) $stop['pause_minutes'],
                'optional' => (bool) $stop['optional'],
            ];
        }
        return [
            'id' => (int) $trip['id'],
            'kind' => $trip['kind'],
            'name' => $trip['name'],
            'description' => $trip['description'],
            'state' => $trip['state'],
            'version' => (int) $trip['version'],
            'days' => array_values($days),
        ];
    }

    /** A row of the routes table as the document's route: a routed route's points and legs, or a track's line. */
    public static function route(array $row): array
    {
        $common = ['id' => $row['id'], 'name' => $row['name'], 'kind' => $row['kind'], 'profile' => $row['profile'], 'optional' => (bool) $row['optional'], 'color' => $row['color']];
        return $row['kind'] === 'track' ? $common + ['line' => $row['line']] : $common + [
            'highways' => $row['highways'],
            'points' => json_decode($row['points'], true, flags: JSON_THROW_ON_ERROR),
            'legs' => (object) json_decode($row['legs'], true, flags: JSON_THROW_ON_ERROR),
        ];
    }

    /**
     * Stores a document over the user's trip, which must still be at `version`: rows are
     * upserted by id and the ones the document no longer holds are deleted. A day or a
     * route sent as `{id, unchanged: true}` stands for the stored one, whose rows stay as
     * they are but for their place. Returns the new version, or null when the user has no
     * such trip.
     *
     * @throws InvalidDocument when the document is malformed, names parts of another trip or leaves out what the trip does not hold
     * @throws VersionConflict
     */
    public function save(int $userId, int $tripId, mixed $body, int $version, DateTimeImmutable $now): ?int
    {
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare('SELECT version FROM trips WHERE id = ? AND user_id = ?');
            $statement->execute([$tripId, $userId]);
            $current = $statement->fetchColumn();
            if ($current === false) {
                $this->db->rollBack();
                return null;
            }
            if ((int) $current !== $version) {
                throw new VersionConflict((int) $current);
            }
            $document = TripDocumentValidator::validated($this->completed($tripId, $body));
            $this->assertIdsNotElsewhere($tripId, $document['days']);
            $this->saveDays($tripId, $document['days']);
            $this->db->prepare('UPDATE trips SET name = ?, description = ?, state = ?, version = ?, updated_at = ? WHERE id = ?')
                ->execute([$document['name'], $document['description'], $document['state'], $version + 1, Timestamp::of($now), $tripId]);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
        return $version + 1;
    }

    /**
     * A copy of the user's trip, named after it, in its folder, planned again, every part
     * under a new id and each day with its recordings, as one transaction. Returns the
     * copy's id, or null when the user has no such trip.
     */
    public function copy(int $userId, int $tripId, DateTimeImmutable $now): ?int
    {
        $document = $this->load($userId, $tripId);
        if ($document === null) {
            return null;
        }
        $this->db->beginTransaction();
        try {
            $this->db->prepare(
                "INSERT INTO trips (user_id, folder_id, kind, name, description, created_at, updated_at)
                 SELECT user_id, folder_id, kind, substr(name, 1, 195) || ' copy', description, ?, ? FROM trips WHERE id = ?",
            )->execute([Timestamp::of($now), Timestamp::of($now), $tripId]);
            $copyId = (int) $this->db->lastInsertId();
            $days = TripCopy::withNewIds($document)['days'];
            $this->saveDays($copyId, $days);
            $copyRecordings = $this->db->prepare('INSERT INTO recordings (day_id, name, gpx, created_at, line, distance_m, started_at, digest) SELECT ?, name, gpx, created_at, line, distance_m, started_at, digest FROM recordings WHERE day_id = ? ORDER BY id');
            foreach ($document['days'] as $i => $day) {
                $copyRecordings->execute([$days[$i]['id'], $day['id']]);
            }
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
        return $copyId;
    }

    /**
     * Merges the user's trips `fromIds` into the trip `intoId`, their days placed as
     * TripMerge says, every part, journal entry and recording kept under its id, and deletes them; one
     * transaction. Returns the trip's new version, or null when the user lacks one of them.
     *
     * @param int[] $fromIds
     * @throws InvalidDocument for trips of another kind
     */
    public function merge(int $userId, int $intoId, array $fromIds, DateTimeImmutable $now): ?int
    {
        $this->db->beginTransaction();
        try {
            $into = $this->load($userId, $intoId);
            $from = array_map(fn (int $id) => $this->load($userId, $id), $fromIds);
            if ($into === null || in_array(null, $from, true)) {
                $this->db->rollBack();
                return null;
            }
            if (array_diff(array_column($from, 'kind'), [$into['kind']]) !== []) {
                throw new InvalidDocument('Only trips of one kind can be merged.');
            }
            $fromDays = array_merge(...array_column($from, 'days'));
            ['days' => $days, 'joined' => $joined] = TripMerge::days($into['kind'], $into['days'], $fromDays);
            $in = Database::placeholders($fromIds);
            // The days that stay days change trips; saving moves the routes and stops of those that joined another.
            $moved = array_values(array_diff(array_column($fromDays, 'id'), array_keys($joined)));
            if ($moved !== []) {
                $this->db->prepare('UPDATE days SET trip_id = ? WHERE id IN (' . Database::placeholders($moved) . ')')->execute([$intoId, ...$moved]);
            }
            $this->saveDays($intoId, $days);
            $this->db->prepare("UPDATE entries SET trip_id = ? WHERE trip_id IN ($in)")->execute([$intoId, ...$fromIds]);
            $joinEntries = $this->db->prepare('UPDATE entries SET day_id = ? WHERE day_id = ?');
            $joinRecordings = $this->db->prepare('UPDATE recordings SET day_id = ? WHERE day_id = ?');
            foreach ($joined as $dayId => $intoDayId) {
                $joinEntries->execute([$intoDayId, $dayId]);
                $joinRecordings->execute([$intoDayId, $dayId]);
            }
            $this->db->prepare("DELETE FROM trips WHERE id IN ($in)")->execute($fromIds);
            $this->db->prepare('UPDATE trips SET version = ?, updated_at = ? WHERE id = ?')->execute([$into['version'] + 1, Timestamp::of($now), $intoId]);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
        return $into['version'] + 1;
    }

    /**
     * The document as sent, with each route it sends as unchanged filled in from the trip's
     * stored one, so that the day it stands in is checked whole; the route keeps its mark,
     * by which its row is left alone. Days sent as unchanged stay as they are.
     */
    private function completed(int $tripId, mixed $body): mixed
    {
        if (!is_array($body) || !is_array($body['days'] ?? null)) {
            return $body;
        }
        // Where the routes sent as unchanged stand in the document, by their ids.
        $places = [];
        foreach ($body['days'] as $d => $day) {
            foreach (is_array($day) && is_array($day['routes'] ?? null) ? $day['routes'] : [] as $r => $route) {
                if (TripDocumentValidator::isUnchanged($route) && is_string($route['id'] ?? null)) {
                    $places[$route['id']] = [$d, $r];
                }
            }
        }
        if ($places === []) {
            return $body;
        }
        $ids = array_map('strval', array_keys($places));
        $statement = $this->db->prepare(
            'SELECT id, name, kind, profile, highways, optional, color, points, legs, line FROM routes
             WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?) AND id IN (' . Database::placeholders($ids) . ')',
        );
        $statement->execute([$tripId, ...$ids]);
        $stored = array_column($statement->fetchAll(), null, 'id');
        foreach ($places as $id => [$d, $r]) {
            $filled = self::route($stored[$id] ?? throw new InvalidDocument('The document leaves out a route the trip does not hold.'));
            // As a parsed body has them: a map, not the object an answer needs for empty legs.
            if (isset($filled['legs'])) {
                $filled['legs'] = (array) $filled['legs'];
            }
            $body['days'][$d]['routes'][$r] = ['unchanged' => true] + $filled;
        }
        return $body;
    }

    /** Ids are the client's choice, but a row belongs to its trip: a document may not name another trip's parts. */
    private function assertIdsNotElsewhere(int $tripId, array $days): void
    {
        [$routeIds, $stopIds] = self::childIds($days);
        $elsewhere = $this->countElsewhere('days', 'trip_id != ?', $tripId, array_column($days, 'id'))
            + $this->countElsewhere('routes', 'day_id NOT IN (SELECT id FROM days WHERE trip_id = ?)', $tripId, $routeIds)
            + $this->countElsewhere('stops', 'day_id NOT IN (SELECT id FROM days WHERE trip_id = ?)', $tripId, $stopIds);
        if ($elsewhere > 0) {
            throw new InvalidDocument('The document names parts of another trip.');
        }
    }

    private function countElsewhere(string $table, string $scope, int $tripId, array $ids): int
    {
        if ($ids === []) {
            return 0;
        }
        $statement = $this->db->prepare("SELECT COUNT(*) FROM $table WHERE $scope AND id IN (" . Database::placeholders($ids) . ')');
        $statement->execute([$tripId, ...$ids]);
        return (int) $statement->fetchColumn();
    }

    /** @return array{0: string[], 1: string[]} the ids of all routes and of all stops of the days sent whole */
    private static function childIds(array $days): array
    {
        $routeIds = [];
        $stopIds = [];
        foreach ($days as $day) {
            array_push($routeIds, ...array_column($day['routes'] ?? [], 'id'));
            array_push($stopIds, ...array_column($day['stops'] ?? [], 'id'));
        }
        return [$routeIds, $stopIds];
    }

    private function saveDays(int $tripId, array $days): void
    {
        $upsertDay = $this->db->prepare(
            'INSERT INTO days (id, trip_id, position, name, date, notes, outline) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET position = excluded.position, name = excluded.name, date = excluded.date, notes = excluded.notes, outline = excluded.outline',
        );
        $outlines = array_column($this->rows('SELECT id, outline FROM days WHERE trip_id = ?', $tripId), 'outline', 'id');
        $upsertRoute = $this->db->prepare(
            'INSERT INTO routes (id, day_id, position, name, kind, profile, highways, optional, color, points, legs, line) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET day_id = excluded.day_id, position = excluded.position, name = excluded.name, kind = excluded.kind,
                 profile = excluded.profile, highways = excluded.highways, optional = excluded.optional, color = excluded.color, points = excluded.points, legs = excluded.legs,
                 line = excluded.line',
        );
        $upsertStop = $this->db->prepare(
            'INSERT INTO stops (id, day_id, position, name, symbol, lng, lat, point_id, address, contact, booking_reference, notes, arrive_at, pause_minutes, optional)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET day_id = excluded.day_id, position = excluded.position, name = excluded.name, symbol = excluded.symbol, lng = excluded.lng, lat = excluded.lat,
                 point_id = excluded.point_id, address = excluded.address, contact = excluded.contact, booking_reference = excluded.booking_reference,
                 notes = excluded.notes, arrive_at = excluded.arrive_at, pause_minutes = excluded.pause_minutes, optional = excluded.optional',
        );
        $placeDay = $this->db->prepare('UPDATE days SET position = ? WHERE id = ? AND trip_id = ?');
        $placeRoute = $this->db->prepare('UPDATE routes SET day_id = ?, position = ? WHERE id = ?');
        // Routes and stops the document no longer holds go first; those of a day sent as unchanged stay.
        [$routeIds, $stopIds] = self::childIds($days);
        $unchangedDays = array_column(array_filter($days, TripDocumentValidator::isUnchanged(...)), 'id');
        $sentWhole = 'day_id IN (SELECT id FROM days WHERE trip_id = ?' . ($unchangedDays === [] ? '' : ' AND id NOT IN (' . Database::placeholders($unchangedDays) . ')') . ')';
        $this->deleteMissing('routes', $sentWhole, [$tripId, ...$unchangedDays], $routeIds);
        $this->deleteMissing('stops', $sentWhole, [$tripId, ...$unchangedDays], $stopIds);
        $this->deleteMissing('days', 'trip_id = ?', [$tripId], array_column($days, 'id'));
        foreach ($days as $position => $day) {
            if (TripDocumentValidator::isUnchanged($day)) {
                $placeDay->execute([$position, $day['id'], $tripId]);
                if ($placeDay->rowCount() !== 1) {
                    throw new InvalidDocument('The document leaves out a day the trip does not hold.');
                }
                continue;
            }
            $upsertDay->execute([$day['id'], $tripId, $position, $day['name'], $day['date'], $day['notes'], Outline::stored($day, $outlines[$day['id']] ?? null)]);
            foreach ($day['routes'] as $index => $route) {
                if (TripDocumentValidator::isUnchanged($route)) {
                    $placeRoute->execute([$day['id'], $index, $route['id']]);
                    continue;
                }
                $track = $route['kind'] === 'track';
                $upsertRoute->execute([
                    $route['id'], $day['id'], $index, $route['name'], $route['kind'], $route['profile'], $track ? null : $route['highways'], (int) $route['optional'], $route['color'],
                    $track ? null : Json::encode($route['points']), $track ? null : Json::encode((object) $route['legs']), $track ? $route['line'] : null,
                ]);
            }
            foreach ($day['stops'] as $index => $stop) {
                $upsertStop->execute([
                    $stop['id'], $day['id'], $index, $stop['name'], $stop['symbol'], $stop['lngLat'][0], $stop['lngLat'][1], $stop['pointId'],
                    $stop['address'], $stop['contact'], $stop['bookingReference'], $stop['notes'], $stop['arriveAt'], $stop['pauseMinutes'], (int) $stop['optional'],
                ]);
            }
        }
    }

    /** Deletes the rows of the table within `scope` whose id is not among `keep`. */
    private function deleteMissing(string $table, string $scope, array $scopeParams, array $keep): void
    {
        $sql = "DELETE FROM $table WHERE $scope";
        if ($keep !== []) {
            $sql .= ' AND id NOT IN (' . Database::placeholders($keep) . ')';
        }
        $this->db->prepare($sql)->execute([...$scopeParams, ...$keep]);
    }

    private function rows(string $sql, int $id): array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute([$id]);
        return $statement->fetchAll();
    }
}
