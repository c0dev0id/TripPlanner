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
        $statement = $this->db->prepare('SELECT r.id, r.day_id, r.name, r.distance_m, r.started_at ' . self::OF_TRIP . ' ORDER BY r.id');
        $statement->execute([$tripId, $userId]);
        return array_map(fn (array $row) => new Recording((int) $row['id'], $row['day_id'], $row['name'], (int) $row['distance_m'], $row['started_at']), $statement->fetchAll());
    }

    /**
     * A new recording on the day of the user's trip, with what is read from its file
     * beside it; null when the user has no such day. With `$unlessKept`, a file the user
     * keeps already, on whatever day, is not kept again.
     *
     * @throws AlreadyKept
     */
    public function add(int $userId, int $tripId, string $dayId, string $name, string $gzip, DateTimeImmutable $now, bool $unlessKept = false): ?Recording
    {
        $statement = $this->db->prepare('SELECT 1 FROM days d JOIN trips t ON t.id = d.trip_id WHERE d.id = ? AND t.id = ? AND t.user_id = ?');
        $statement->execute([$dayId, $tripId, $userId]);
        if ($statement->fetchColumn() === false) {
            return null;
        }
        $gpx = (string) gzdecode($gzip);
        $digest = hash('sha256', $gpx);
        if ($unlessKept) {
            $kept = $this->db->prepare('SELECT 1 FROM recordings r JOIN days d ON d.id = r.day_id JOIN trips t ON t.id = d.trip_id WHERE r.digest = ? AND t.user_id = ?');
            $kept->execute([$digest, $userId]);
            if ($kept->fetchColumn() !== false) {
                throw new AlreadyKept();
            }
        }
        $summary = TrackSummary::of($gpx);
        $statement = $this->db->prepare('INSERT INTO recordings (day_id, name, gpx, created_at, line, distance_m, started_at, digest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->bindValue(1, $dayId);
        $statement->bindValue(2, $name);
        $statement->bindValue(3, $gzip, PDO::PARAM_LOB);
        $statement->bindValue(4, Timestamp::of($now));
        $statement->bindValue(5, $summary->line);
        $statement->bindValue(6, $summary->distanceM, PDO::PARAM_INT);
        $statement->bindValue(7, $summary->startedAt);
        $statement->bindValue(8, $digest);
        $statement->execute();
        return new Recording((int) $this->db->lastInsertId(), $dayId, $name, $summary->distanceM, $summary->startedAt);
    }

    /**
     * The recordings that wait for their day: those kept in the user's folder for
     * recordings and the folders in it, each with its line and the id of the collection
     * it is in.
     *
     * @return list<array{id: int, tripId: int, name: string, line: string, distanceM: int, startedAt: ?string}>
     */
    public function unassigned(int $userId): array
    {
        $statement = $this->db->prepare(
            "WITH RECURSIVE inside(id) AS (SELECT id FROM folders WHERE user_id = ? AND kind = 'recordings' UNION ALL SELECT f.id FROM folders f JOIN inside ON f.parent_id = inside.id)
             SELECT r.id, t.id AS trip_id, r.name, r.line, r.distance_m, r.started_at
             FROM recordings r JOIN days d ON d.id = r.day_id JOIN trips t ON t.id = d.trip_id
             WHERE t.folder_id IN (SELECT id FROM inside) ORDER BY r.started_at, r.id",
        );
        $statement->execute([$userId]);
        return array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'tripId' => (int) $row['trip_id'],
            'name' => $row['name'],
            'line' => $row['line'],
            'distanceM' => (int) $row['distance_m'],
            'startedAt' => $row['started_at'],
        ], $statement->fetchAll());
    }

    /** False when the user has no such recording. */
    public function rename(int $userId, int $tripId, int $recordingId, string $name): bool
    {
        $statement = $this->db->prepare('UPDATE recordings SET name = ? WHERE id = ? AND id IN (SELECT r.id ' . self::OF_TRIP . ')');
        $statement->execute([$name, $recordingId, $tripId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Puts the recording on another day, of its trip or of another of the user's; false when the user has no such recording or no such day. */
    public function move(int $userId, int $tripId, int $recordingId, string $dayId): bool
    {
        $statement = $this->db->prepare(
            'UPDATE recordings SET day_id = ? WHERE id = ? AND id IN (SELECT r.id ' . self::OF_TRIP . ') AND ? IN (SELECT d.id FROM days d JOIN trips t ON t.id = d.trip_id WHERE t.user_id = ?)',
        );
        $statement->execute([$dayId, $recordingId, $tripId, $userId, $dayId, $userId]);
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
