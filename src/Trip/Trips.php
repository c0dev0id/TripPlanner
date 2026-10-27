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
            'SELECT t.id, t.name, t.folder_id, t.starts_on, t.updated_at,
                    (SELECT COUNT(*) FROM days d WHERE d.trip_id = t.id) AS day_count
             FROM trips t WHERE t.user_id = ? ORDER BY t.updated_at DESC, t.id DESC',
        );
        $statement->execute([$userId]);
        return array_map($this->summary(...), $statement->fetchAll());
    }

    /**
     * Creates a trip in a folder of the user's, or in none.
     *
     * @throws UnknownFolder for a folder the user does not have
     */
    public function create(int $userId, string $name, DateTimeImmutable $now, ?int $folderId = null): TripSummary
    {
        $this->assertFolder($userId, $folderId);
        $statement = $this->db->prepare('INSERT INTO trips (user_id, folder_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
        $statement->execute([$userId, $folderId, $name, Timestamp::of($now), Timestamp::of($now)]);
        return new TripSummary((int) $this->db->lastInsertId(), $name, $folderId, null, 0, Timestamp::of($now));
    }

    /**
     * Puts the user's trip into a folder, or into none; false when there is no such trip.
     *
     * @throws UnknownFolder for a folder the user does not have
     */
    public function move(int $userId, int $tripId, ?int $folderId): bool
    {
        $this->assertFolder($userId, $folderId);
        $statement = $this->db->prepare('UPDATE trips SET folder_id = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$folderId, $tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Deletes the user's trip with everything in it; false when there is none. */
    public function delete(int $userId, int $tripId): bool
    {
        $statement = $this->db->prepare('DELETE FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    private function assertFolder(int $userId, ?int $folderId): void
    {
        if ($folderId === null) {
            return;
        }
        $statement = $this->db->prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?');
        $statement->execute([$folderId, $userId]);
        if ($statement->fetchColumn() === false) {
            throw new UnknownFolder();
        }
    }

    private function summary(array $row): TripSummary
    {
        return new TripSummary((int) $row['id'], $row['name'], $row['folder_id'] === null ? null : (int) $row['folder_id'], $row['starts_on'], (int) $row['day_count'], $row['updated_at']);
    }
}
