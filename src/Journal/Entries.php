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

    /** The target keys an entry may name, and the tables their ids are in. */
    public const PARTS = ['dayId' => 'days', 'stopId' => 'stops', 'routeId' => 'routes'];

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
     * Adds an entry to the trip, on the part `$target` names (one of PARTS' keys, an id of
     * the trip's) or on the trip itself; a photo with a time and no part goes to the day of
     * that date. Null when the user has no such trip or part.
     *
     * @param array{dayId?: string, stopId?: string, routeId?: string} $target
     * @param ?array{name: string, mediaType: string, size: int, takenAt: ?string, lngLat: ?array{0: float, 1: float}} $file
     */
    public function add(int $userId, int $tripId, array $target, string $text, ?array $file, DateTimeImmutable $now): ?Entry
    {
        if (!$this->owns($userId, $tripId)) {
            return null;
        }
        foreach (self::PARTS as $key => $table) {
            if (isset($target[$key]) && !$this->partOf($tripId, $table, $target[$key])) {
                return null;
            }
        }
        $dayId = $target['dayId'] ?? null;
        if ($target === [] && isset($file['takenAt'])) {
            $dayId = $this->dayOnDate($tripId, substr($file['takenAt'], 0, 10));
        }
        $statement = $this->db->prepare(
            'INSERT INTO entries (trip_id, day_id, stop_id, route_id, text, file_name, media_type, size, taken_at, lng, lat, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        );
        $statement->execute([
            $tripId, $dayId, $target['stopId'] ?? null, $target['routeId'] ?? null, $text,
            $file['name'] ?? null, $file['mediaType'] ?? null, $file['size'] ?? null, $file['takenAt'] ?? null, $file['lngLat'][0] ?? null, $file['lngLat'][1] ?? null,
            Timestamp::of($now),
        ]);
        return $this->one('e.id = ?', [(int) $this->db->lastInsertId()]);
    }

    /** False when the user has no such entry. */
    public function updateText(int $userId, int $tripId, int $entryId, string $text): bool
    {
        if ($this->find($userId, $tripId, $entryId) === null) {
            return false;
        }
        $this->db->prepare('UPDATE entries SET text = ? WHERE id = ?')->execute([$text, $entryId]);
        return true;
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
