<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

/** A user's trips as the library sees them; their content is TripDocuments' business. */
final class Trips
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return TripSummary[] the user's trips, last changed first */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare(
            'SELECT t.id, t.name, t.starts_on, t.updated_at,
                    (SELECT COUNT(*) FROM days d WHERE d.trip_id = t.id) AS day_count
             FROM trips t WHERE t.user_id = ? ORDER BY t.updated_at DESC, t.id DESC',
        );
        $statement->execute([$userId]);
        return array_map($this->summary(...), $statement->fetchAll());
    }

    public function create(int $userId, string $name, DateTimeImmutable $now): TripSummary
    {
        $statement = $this->db->prepare('INSERT INTO trips (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)');
        $statement->execute([$userId, $name, Timestamp::of($now), Timestamp::of($now)]);
        return new TripSummary((int) $this->db->lastInsertId(), $name, null, 0, Timestamp::of($now));
    }

    /** Deletes the user's trip with everything in it; false when there is none. */
    public function delete(int $userId, int $tripId): bool
    {
        $statement = $this->db->prepare('DELETE FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    private function summary(array $row): TripSummary
    {
        return new TripSummary((int) $row['id'], $row['name'], $row['starts_on'], (int) $row['day_count'], $row['updated_at']);
    }
}
