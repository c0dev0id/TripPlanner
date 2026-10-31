<?php

declare(strict_types=1);

namespace Planner\Recording;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

/** The recordings on the days of a user's trips, each a GPX file kept as uploaded, compressed with gzip. */
final class Recordings
{
    private const OF_TRIP = 'FROM recordings r JOIN days d ON d.id = r.day_id JOIN trips t ON t.id = d.trip_id WHERE t.id = ? AND t.user_id = ?';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ?Recording[] the trip's recordings, in the order they were added; null when the user has no such trip */
    public function listFor(int $userId, int $tripId): ?array
    {
        $statement = $this->db->prepare('SELECT 1 FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        if ($statement->fetchColumn() === false) {
            return null;
        }
        $statement = $this->db->prepare('SELECT r.id, r.day_id, r.name ' . self::OF_TRIP . ' ORDER BY r.id');
        $statement->execute([$tripId, $userId]);
        return array_map(fn (array $row) => new Recording((int) $row['id'], $row['day_id'], $row['name']), $statement->fetchAll());
    }

    /** A new recording on the day of the user's trip; null when the user has no such day. */
    public function add(int $userId, int $tripId, string $dayId, string $name, string $gzip, DateTimeImmutable $now): ?Recording
    {
        $statement = $this->db->prepare('SELECT 1 FROM days d JOIN trips t ON t.id = d.trip_id WHERE d.id = ? AND t.id = ? AND t.user_id = ?');
        $statement->execute([$dayId, $tripId, $userId]);
        if ($statement->fetchColumn() === false) {
            return null;
        }
        $statement = $this->db->prepare('INSERT INTO recordings (day_id, name, gpx, created_at) VALUES (?, ?, ?, ?)');
        $statement->bindValue(1, $dayId);
        $statement->bindValue(2, $name);
        $statement->bindValue(3, $gzip, PDO::PARAM_LOB);
        $statement->bindValue(4, Timestamp::of($now));
        $statement->execute();
        return new Recording((int) $this->db->lastInsertId(), $dayId, $name);
    }

    /** False when the user has no such recording. */
    public function rename(int $userId, int $tripId, int $recordingId, string $name): bool
    {
        $statement = $this->db->prepare('UPDATE recordings SET name = ? WHERE id = ? AND id IN (SELECT r.id ' . self::OF_TRIP . ')');
        $statement->execute([$name, $recordingId, $tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** False when the user has no such recording. */
    public function delete(int $userId, int $tripId, int $recordingId): bool
    {
        $statement = $this->db->prepare('DELETE FROM recordings WHERE id = ? AND id IN (SELECT r.id ' . self::OF_TRIP . ')');
        $statement->execute([$recordingId, $tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** The recording's GPX file as kept, compressed with gzip; null when the user has no such recording. */
    public function gzip(int $userId, int $tripId, int $recordingId): ?string
    {
        $statement = $this->db->prepare('SELECT r.gpx ' . self::OF_TRIP . ' AND r.id = ?');
        $statement->execute([$tripId, $userId, $recordingId]);
        $gzip = $statement->fetchColumn();
        return $gzip === false ? null : (string) $gzip;
    }
}
