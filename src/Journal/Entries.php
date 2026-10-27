<?php

declare(strict_types=1);

namespace Planner\Journal;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

/** The journal entries of the trips: a user's own, or those of a trip shared under a token. */
final class Entries
{
    public const MAX_TEXT = 20000;

    private const SELECT = 'SELECT e.* FROM entries e JOIN trips t ON t.id = e.trip_id WHERE ';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ?Entry[] the trip's entries, oldest first; null when the user has no such trip */
    public function listFor(int $userId, int $tripId): ?array
    {
        return $this->owns($userId, $tripId) ? $this->list('e.trip_id = ?', [$tripId]) : null;
    }

    /** @return ?Entry[] the entries of the trip shared under the token; null when none is */
    public function listShared(string $token): ?array
    {
        $statement = $this->db->prepare('SELECT 1 FROM trips WHERE share_token = ?');
        $statement->execute([$token]);
        return $statement->fetchColumn() === false ? null : $this->list('t.share_token = ?', [$token]);
    }

    public function find(int $userId, int $tripId, int $entryId): ?Entry
    {
        return $this->one('e.id = ? AND e.trip_id = ? AND t.user_id = ?', [$entryId, $tripId, $userId]);
    }

    public function findShared(string $token, int $entryId): ?Entry
    {
        return $this->one('e.id = ? AND t.share_token = ?', [$entryId, $token]);
    }

    /**
     * Adds an entry to the trip, on the part named in `$target` (`dayId`, `stopId` or
     * `routeId`, each of the trip) or on the trip itself. Null when the user has no such
     * trip or part.
     *
     * @param array{dayId?: ?string, stopId?: ?string, routeId?: ?string} $target
     * @param ?array{name: string, mediaType: string, size: int} $file
     */
    public function add(int $userId, int $tripId, array $target, string $text, ?array $file, DateTimeImmutable $now): ?Entry
    {
        if (!$this->owns($userId, $tripId)) {
            return null;
        }
        $dayId = $target['dayId'] ?? null;
        $stopId = $target['stopId'] ?? null;
        $routeId = $target['routeId'] ?? null;
        if (($dayId !== null && !$this->partOf($tripId, 'days', $dayId)) || ($stopId !== null && !$this->partOf($tripId, 'stops', $stopId)) || ($routeId !== null && !$this->partOf($tripId, 'routes', $routeId))) {
            return null;
        }
        $statement = $this->db->prepare(
            'INSERT INTO entries (trip_id, day_id, stop_id, route_id, text, file_name, media_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        );
        $statement->execute([$tripId, $dayId, $stopId, $routeId, $text, $file['name'] ?? null, $file['mediaType'] ?? null, $file['size'] ?? null, Timestamp::of($now)]);
        return $this->find($userId, $tripId, (int) $this->db->lastInsertId());
    }

    /**
     * Notes when and where a photo was taken, and puts an entry without a part on the day
     * of that date. Null when the user has no such entry.
     *
     * @param ?array{0: float, 1: float} $lngLat
     */
    public function place(int $userId, int $tripId, int $entryId, ?string $takenAt, ?array $lngLat): ?Entry
    {
        $entry = $this->find($userId, $tripId, $entryId);
        if ($entry === null) {
            return null;
        }
        $dayId = $entry->dayId;
        if ($dayId === null && $entry->stopId === null && $entry->routeId === null && $takenAt !== null) {
            $dayId = $this->dayOnDate($tripId, substr($takenAt, 0, 10));
        }
        $this->db->prepare('UPDATE entries SET taken_at = ?, lng = ?, lat = ?, day_id = ? WHERE id = ?')->execute([$takenAt, $lngLat[0] ?? null, $lngLat[1] ?? null, $dayId, $entryId]);
        return $this->find($userId, $tripId, $entryId);
    }

    /** False when the user has no such entry. */
    public function updateText(int $userId, int $tripId, int $entryId, string $text): bool
    {
        $statement = $this->db->prepare('UPDATE entries SET text = ? WHERE id = ? AND trip_id = ? AND trip_id IN (SELECT id FROM trips WHERE user_id = ?)');
        $statement->execute([$text, $entryId, $tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Deletes the entry and returns it, for its file to go too; null when the user has no such entry. */
    public function delete(int $userId, int $tripId, int $entryId): ?Entry
    {
        $entry = $this->find($userId, $tripId, $entryId);
        if ($entry !== null) {
            $this->db->prepare('DELETE FROM entries WHERE id = ?')->execute([$entryId]);
        }
        return $entry;
    }

    /** @return Entry[] */
    private function list(string $where, array $params): array
    {
        $statement = $this->db->prepare(self::SELECT . "$where ORDER BY e.id");
        $statement->execute($params);
        return array_map(Entry::fromRow(...), $statement->fetchAll());
    }

    private function one(string $where, array $params): ?Entry
    {
        $statement = $this->db->prepare(self::SELECT . $where);
        $statement->execute($params);
        $row = $statement->fetch();
        return $row === false ? null : Entry::fromRow($row);
    }

    private function owns(int $userId, int $tripId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        return $statement->fetchColumn() !== false;
    }

    private function partOf(int $tripId, string $table, string $id): bool
    {
        $scope = $table === 'days' ? 'trip_id = ?' : 'day_id IN (SELECT id FROM days WHERE trip_id = ?)';
        $statement = $this->db->prepare("SELECT 1 FROM $table WHERE id = ? AND $scope");
        $statement->execute([$id, $tripId]);
        return $statement->fetchColumn() !== false;
    }

    private function dayOnDate(int $tripId, string $date): ?string
    {
        $statement = $this->db->prepare('SELECT id FROM days WHERE trip_id = ? AND date = ? ORDER BY position LIMIT 1');
        $statement->execute([$tripId, $date]);
        $id = $statement->fetchColumn();
        return $id === false ? null : $id;
    }
}
