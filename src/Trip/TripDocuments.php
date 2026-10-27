<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use PDO;
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

    /** The trip shared under the token, or null when none is. */
    public function loadShared(string $token): ?array
    {
        return $this->document('share_token = ?', [$token]);
    }

    private function document(string $where, array $params): ?array
    {
        $statement = $this->db->prepare("SELECT id, name, description, state, version FROM trips WHERE $where");
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
        $routes = 'SELECT id, day_id, name, kind, profile, optional, points, legs FROM routes WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?) ORDER BY position';
        foreach ($this->rows($routes, $tripId) as $route) {
            $days[$route['day_id']]['routes'][] = [
                'id' => $route['id'],
                'name' => $route['name'],
                'kind' => $route['kind'],
                'profile' => $route['profile'],
                'optional' => (bool) $route['optional'],
                'points' => json_decode($route['points'], true, flags: JSON_THROW_ON_ERROR),
                'legs' => (object) json_decode($route['legs'], true, flags: JSON_THROW_ON_ERROR),
            ];
        }
        $stops = 'SELECT id, day_id, name, kind, lng, lat, point_id, address, contact, booking_reference, notes, arrive_at, pause_minutes, optional
                  FROM stops WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?) ORDER BY position';
        foreach ($this->rows($stops, $tripId) as $stop) {
            $days[$stop['day_id']]['stops'][] = [
                'id' => $stop['id'],
                'name' => $stop['name'],
                'kind' => $stop['kind'],
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
            'name' => $trip['name'],
            'description' => $trip['description'],
            'state' => $trip['state'],
            'version' => (int) $trip['version'],
            'days' => array_values($days),
        ];
    }

    /**
     * Stores a validated document over the user's trip, which must still be at `version`;
     * rows are upserted by id and the ones the document no longer holds are deleted.
     * Returns the new version, or null when the user has no such trip.
     */
    public function save(int $userId, int $tripId, array $document, int $version, DateTimeImmutable $now): ?int
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
     * under a new id, as one transaction. Returns the copy's id, or null when the user has
     * no such trip.
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
                "INSERT INTO trips (user_id, folder_id, name, description, created_at, updated_at)
                 SELECT user_id, folder_id, substr(name, 1, 195) || ' copy', description, ?, ? FROM trips WHERE id = ?",
            )->execute([Timestamp::of($now), Timestamp::of($now), $tripId]);
            $copyId = (int) $this->db->lastInsertId();
            $this->saveDays($copyId, TripCopy::withNewIds($document)['days']);
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
        return $copyId;
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
        $statement = $this->db->prepare("SELECT COUNT(*) FROM $table WHERE $scope AND id IN (" . implode(',', array_fill(0, count($ids), '?')) . ')');
        $statement->execute([$tripId, ...$ids]);
        return (int) $statement->fetchColumn();
    }

    /** @return array{0: string[], 1: string[]} the ids of all routes and of all stops of the days */
    private static function childIds(array $days): array
    {
        $routeIds = [];
        $stopIds = [];
        foreach ($days as $day) {
            array_push($routeIds, ...array_column($day['routes'], 'id'));
            array_push($stopIds, ...array_column($day['stops'], 'id'));
        }
        return [$routeIds, $stopIds];
    }

    private function saveDays(int $tripId, array $days): void
    {
        $upsertDay = $this->db->prepare(
            'INSERT INTO days (id, trip_id, position, name, date, notes) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET position = excluded.position, name = excluded.name, date = excluded.date, notes = excluded.notes',
        );
        $upsertRoute = $this->db->prepare(
            'INSERT INTO routes (id, day_id, position, name, kind, profile, optional, points, legs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET day_id = excluded.day_id, position = excluded.position, name = excluded.name, kind = excluded.kind,
                 profile = excluded.profile, optional = excluded.optional, points = excluded.points, legs = excluded.legs',
        );
        $upsertStop = $this->db->prepare(
            'INSERT INTO stops (id, day_id, position, name, kind, lng, lat, point_id, address, contact, booking_reference, notes, arrive_at, pause_minutes, optional)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET day_id = excluded.day_id, position = excluded.position, name = excluded.name, kind = excluded.kind, lng = excluded.lng, lat = excluded.lat,
                 point_id = excluded.point_id, address = excluded.address, contact = excluded.contact, booking_reference = excluded.booking_reference,
                 notes = excluded.notes, arrive_at = excluded.arrive_at, pause_minutes = excluded.pause_minutes, optional = excluded.optional',
        );
        // Routes and stops the document no longer holds go first.
        [$routeIds, $stopIds] = self::childIds($days);
        $this->deleteMissing('routes', 'day_id IN (SELECT id FROM days WHERE trip_id = ?)', $tripId, $routeIds);
        $this->deleteMissing('stops', 'day_id IN (SELECT id FROM days WHERE trip_id = ?)', $tripId, $stopIds);
        $this->deleteMissing('days', 'trip_id = ?', $tripId, array_column($days, 'id'));
        foreach ($days as $position => $day) {
            $upsertDay->execute([$day['id'], $tripId, $position, $day['name'], $day['date'], $day['notes']]);
            foreach ($day['routes'] as $index => $route) {
                $upsertRoute->execute([$route['id'], $day['id'], $index, $route['name'], $route['kind'], $route['profile'], (int) $route['optional'], Json::encode($route['points']), Json::encode((object) $route['legs'])]);
            }
            foreach ($day['stops'] as $index => $stop) {
                $upsertStop->execute([
                    $stop['id'], $day['id'], $index, $stop['name'], $stop['kind'], $stop['lngLat'][0], $stop['lngLat'][1], $stop['pointId'],
                    $stop['address'], $stop['contact'], $stop['bookingReference'], $stop['notes'], $stop['arriveAt'], $stop['pauseMinutes'], (int) $stop['optional'],
                ]);
            }
        }
    }

    /** Deletes the rows of the trip's table whose id is not among `keep`. */
    private function deleteMissing(string $table, string $scope, int $tripId, array $keep): void
    {
        $sql = "DELETE FROM $table WHERE $scope";
        if ($keep !== []) {
            $sql .= ' AND id NOT IN (' . implode(',', array_fill(0, count($keep), '?')) . ')';
        }
        $this->db->prepare($sql)->execute([$tripId, ...$keep]);
    }

    private function rows(string $sql, int $tripId): array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute([$tripId]);
        return $statement->fetchAll();
    }
}
