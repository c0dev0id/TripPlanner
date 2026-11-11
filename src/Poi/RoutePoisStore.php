<?php

declare(strict_types=1);

namespace Planner\Poi;

use DateTimeImmutable;
use PDO;
use Planner\Http\Json;
use Planner\Timestamp;

/** The places POI searches found along the routes of a user's trips, one answer per route and kind. */
final class RoutePoisStore
{
    private const OF_TRIP = 'FROM route_pois p JOIN routes r ON r.id = p.route_id JOIN days d ON d.id = r.day_id JOIN trips t ON t.id = d.trip_id WHERE t.id = ? AND t.user_id = ?';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ?RoutePois[] what was found along the trip's routes; null when the user has no such trip */
    public function listFor(int $userId, int $tripId): ?array
    {
        $statement = $this->db->prepare('SELECT 1 FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        if ($statement->fetchColumn() === false) {
            return null;
        }
        $statement = $this->db->prepare('SELECT p.route_id, p.category, p.reach_m, p.line_mark, p.places, p.found_at ' . self::OF_TRIP . ' ORDER BY p.route_id, p.category');
        $statement->execute([$tripId, $userId]);
        return array_map(
            fn (array $row) => new RoutePois($row['route_id'], $row['category'], (int) $row['reach_m'], $row['line_mark'], json_decode($row['places'], true, 512, JSON_THROW_ON_ERROR), $row['found_at']),
            $statement->fetchAll(),
        );
    }

    /**
     * Keeps what a search found along the route for a kind, in place of what was kept for it.
     *
     * @param list<array{id: string, lngLat: array{float, float}, tags: array<string, string>}> $places
     * @return bool false when the user's trip has no such route
     */
    public function keep(int $userId, int $tripId, string $routeId, string $category, int $reachM, string $lineMark, array $places, DateTimeImmutable $now): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM routes r JOIN days d ON d.id = r.day_id JOIN trips t ON t.id = d.trip_id WHERE r.id = ? AND t.id = ? AND t.user_id = ?');
        $statement->execute([$routeId, $tripId, $userId]);
        if ($statement->fetchColumn() === false) {
            return false;
        }
        $this->db->prepare(
            'INSERT INTO route_pois (route_id, category, reach_m, line_mark, places, found_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(route_id, category) DO UPDATE SET reach_m = excluded.reach_m, line_mark = excluded.line_mark, places = excluded.places, found_at = excluded.found_at',
        )->execute([$routeId, $category, $reachM, $lineMark, Json::encode($places), Timestamp::of($now)]);
        return true;
    }

    /** False when nothing is kept for the route and kind in the user's trip. */
    public function forget(int $userId, int $tripId, string $routeId, string $category): bool
    {
        $statement = $this->db->prepare('DELETE FROM route_pois WHERE route_id = ? AND category = ? AND route_id IN (SELECT r.id ' . self::OF_TRIP . ')');
        $statement->execute([$routeId, $category, $tripId, $userId]);
        return $statement->rowCount() === 1;
    }
}
