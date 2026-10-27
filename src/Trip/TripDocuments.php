<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

/**
 * A trip's content as one document: its places and its days with their stops and
 * routes, in the shape the client works with (see TripDocumentValidator).
 */
final class TripDocuments
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** The user's trip with everything in it, or null when there is no such trip. */
    public function load(int $userId, int $tripId): ?array
    {
        $statement = $this->db->prepare('SELECT id, name, description, starts_on, version FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        $trip = $statement->fetch();
        if ($trip === false) {
            return null;
        }
        $days = [];
        foreach ($this->rows('SELECT id, name, date, notes FROM days WHERE trip_id = ? ORDER BY position', $tripId) as $day) {
            $days[$day['id']] = ['id' => $day['id'], 'name' => $day['name'], 'date' => $day['date'], 'notes' => $day['notes'], 'stops' => [], 'routes' => []];
        }
        $stops = 'SELECT id, day_id, place_id, role, arrive_at, pause_minutes, optional, notes FROM stops WHERE day_id IN (SELECT id FROM days WHERE trip_id = ?) ORDER BY position';
        foreach ($this->rows($stops, $tripId) as $stop) {
            $days[$stop['day_id']]['stops'][] = [
                'id' => $stop['id'],
                'placeId' => $stop['place_id'],
                'role' => $stop['role'],
                'arriveAt' => $stop['arrive_at'],
                'pauseMinutes' => $stop['pause_minutes'] === null ? null : (int) $stop['pause_minutes'],
                'optional' => (bool) $stop['optional'],
                'notes' => $stop['notes'],
            ];
        }
        $routes = 'SELECT r.id, r.day_id, r.name, r.kind, r.profile, r.optional, r.points, r.legs FROM routes r
                   JOIN stops s ON s.id = r.from_stop_id WHERE r.day_id IN (SELECT id FROM days WHERE trip_id = ?) ORDER BY s.position';
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
        $places = [];
        foreach ($this->rows('SELECT id, name, kind, lng, lat, address, contact, booking_reference, notes FROM places WHERE trip_id = ? ORDER BY name, id', $tripId) as $place) {
            $places[] = [
                'id' => $place['id'],
                'name' => $place['name'],
                'kind' => $place['kind'],
                'lngLat' => [(float) $place['lng'], (float) $place['lat']],
                'address' => $place['address'],
                'contact' => $place['contact'],
                'bookingReference' => $place['booking_reference'],
                'notes' => $place['notes'],
            ];
        }
        return [
            'id' => (int) $trip['id'],
            'name' => $trip['name'],
            'description' => $trip['description'],
            'startsOn' => $trip['starts_on'],
            'version' => (int) $trip['version'],
            'places' => $places,
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
            $this->savePlaces($tripId, $document['places']);
            $this->saveDays($tripId, $document['days']);
            // After the stops, which reference them.
            $this->deleteMissing('places', 'trip_id = ?', $tripId, array_column($document['places'], 'id'));
            $this->db->prepare('UPDATE trips SET name = ?, description = ?, starts_on = ?, version = ?, updated_at = ? WHERE id = ?')
                ->execute([$document['name'], $document['description'], $document['startsOn'], $version + 1, Timestamp::of($now), $tripId]);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
        return $version + 1;
    }

    private function savePlaces(int $tripId, array $places): void
    {
        $upsert = $this->db->prepare(
            'INSERT INTO places (id, trip_id, name, kind, lng, lat, address, contact, booking_reference, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind, lng = excluded.lng, lat = excluded.lat,
                 address = excluded.address, contact = excluded.contact, booking_reference = excluded.booking_reference, notes = excluded.notes
             WHERE trip_id = excluded.trip_id',
        );
        foreach ($places as $place) {
            $upsert->execute([$place['id'], $tripId, $place['name'], $place['kind'], $place['lngLat'][0], $place['lngLat'][1], $place['address'], $place['contact'], $place['bookingReference'], $place['notes']]);
        }
    }

    private function saveDays(int $tripId, array $days): void
    {
        $upsertDay = $this->db->prepare(
            'INSERT INTO days (id, trip_id, position, name, date, notes) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET position = excluded.position, name = excluded.name, date = excluded.date, notes = excluded.notes
             WHERE trip_id = excluded.trip_id',
        );
        $upsertStop = $this->db->prepare(
            'INSERT INTO stops (id, day_id, position, place_id, role, arrive_at, pause_minutes, optional, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET day_id = excluded.day_id, position = excluded.position, place_id = excluded.place_id, role = excluded.role,
                 arrive_at = excluded.arrive_at, pause_minutes = excluded.pause_minutes, optional = excluded.optional, notes = excluded.notes',
        );
        $upsertRoute = $this->db->prepare(
            'INSERT INTO routes (id, day_id, from_stop_id, name, kind, profile, optional, points, legs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET day_id = excluded.day_id, from_stop_id = excluded.from_stop_id, name = excluded.name, kind = excluded.kind,
                 profile = excluded.profile, optional = excluded.optional, points = excluded.points, legs = excluded.legs',
        );
        // Stops and routes the document no longer holds go first, routes before the stops
        // they reference.
        $stopIds = [];
        $routeIds = [];
        foreach ($days as $day) {
            array_push($stopIds, ...array_column($day['stops'], 'id'));
            array_push($routeIds, ...array_column($day['routes'], 'id'));
        }
        $this->deleteMissing('routes', 'day_id IN (SELECT id FROM days WHERE trip_id = ?)', $tripId, $routeIds);
        $this->deleteMissing('stops', 'day_id IN (SELECT id FROM days WHERE trip_id = ?)', $tripId, $stopIds);
        $this->deleteMissing('days', 'trip_id = ?', $tripId, array_column($days, 'id'));
        foreach ($days as $position => $day) {
            $upsertDay->execute([$day['id'], $tripId, $position, $day['name'], $day['date'], $day['notes']]);
            foreach ($day['stops'] as $index => $stop) {
                $upsertStop->execute([$stop['id'], $day['id'], $index, $stop['placeId'], $stop['role'], $stop['arriveAt'], $stop['pauseMinutes'], (int) $stop['optional'], $stop['notes']]);
            }
            foreach ($day['routes'] as $index => $route) {
                $json = fn ($value) => json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                $upsertRoute->execute([$route['id'], $day['id'], $day['stops'][$index]['id'], $route['name'], $route['kind'], $route['profile'], (int) $route['optional'], $json($route['points']), $json((object) $route['legs'])]);
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
