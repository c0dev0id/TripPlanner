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

    /** @return TripSummary[] the user's trips, last changed first, each starting on its first dated day */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare(
            'SELECT t.id, t.name, t.folder_id, t.state, t.updated_at, MIN(d.date) AS starts_on, COUNT(d.id) AS day_count
             FROM trips t LEFT JOIN days d ON d.trip_id = t.id
             WHERE t.user_id = ? GROUP BY t.id ORDER BY t.updated_at DESC, t.id DESC',
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
        return new TripSummary((int) $this->db->lastInsertId(), $name, $folderId, 'planned', null, 0, Timestamp::of($now));
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

    /** The token the user's trip is shared under; null while it is not shared. */
    public function shareToken(int $userId, int $tripId): ?string
    {
        $statement = $this->db->prepare('SELECT share_token FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        $token = $statement->fetchColumn();
        return $token === false ? null : $token;
    }

    /** Makes the user's trip public under a token, the one it has or a new one; null when there is no such trip. */
    public function share(int $userId, int $tripId): ?string
    {
        $statement = $this->db->prepare('UPDATE trips SET share_token = COALESCE(share_token, ?) WHERE id = ? AND user_id = ? RETURNING share_token');
        $statement->execute([bin2hex(random_bytes(16)), $tripId, $userId]);
        $token = $statement->fetchColumn();
        return $token === false ? null : $token;
    }

    /** Takes the user's trip off the public; false when there is no such trip. */
    public function unshare(int $userId, int $tripId): bool
    {
        $statement = $this->db->prepare('UPDATE trips SET share_token = NULL WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
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
        return new TripSummary((int) $row['id'], $row['name'], $row['folder_id'] === null ? null : (int) $row['folder_id'], $row['state'], $row['starts_on'], (int) $row['day_count'], $row['updated_at']);
    }
}
