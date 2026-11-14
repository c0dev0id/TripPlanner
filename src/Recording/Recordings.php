<?php

declare(strict_types=1);

namespace Planner\Recording;

use DateTimeImmutable;
use PDO;
use Planner\Database;
use Planner\Timestamp;

/**
 * A user's rides as recorded, each a GPX file kept once, as uploaded, compressed with
 * gzip, and the days of the user's trips each is a recording of.
 */
final class Recordings
{
    private const BY_START = 'ORDER BY r.started_at, r.id';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ?Recording[] the rides on the trip's days, once for each day a ride is on, by when they began; null when the user has no such trip */
    public function listFor(int $userId, int $tripId): ?array
    {
        $statement = $this->db->prepare('SELECT 1 FROM trips WHERE id = ? AND user_id = ?');
        $statement->execute([$tripId, $userId]);
        if ($statement->fetchColumn() === false) {
            return null;
        }
        $statement = $this->db->prepare(
            'SELECT r.id, r.name, r.distance_m, r.started_at, l.day_id FROM recordings r JOIN recording_days l ON l.recording_id = r.id JOIN days d ON d.id = l.day_id
             WHERE d.trip_id = ? ' . self::BY_START,
        );
        $statement->execute([$tripId]);
        return array_map(fn (array $row) => new Recording((int) $row['id'], $row['name'], (int) $row['distance_m'], $row['started_at'], $row['day_id']), $statement->fetchAll());
    }

    /**
     * Every ride of the user's, by when it began, with its line and the days it is on,
     * each with the trip or collection it is in.
     *
     * @return list<array{id: int, name: string, startedAt: ?string, distanceM: int, line: string, days: list<array{tripId: int, dayId: string, trip: string}>}>
     */
    public function rides(int $userId): array
    {
        $statement = $this->db->prepare(
            'SELECT l.recording_id, l.day_id, t.id AS trip_id, t.name FROM recording_days l JOIN days d ON d.id = l.day_id JOIN trips t ON t.id = d.trip_id
             WHERE t.user_id = ? ORDER BY t.name COLLATE NOCASE, t.id, d.position',
        );
        $statement->execute([$userId]);
        $days = [];
        foreach ($statement as $row) {
            $days[(int) $row['recording_id']][] = ['tripId' => (int) $row['trip_id'], 'dayId' => $row['day_id'], 'trip' => $row['name']];
        }
        $statement = $this->db->prepare('SELECT r.id, r.name, r.started_at, r.distance_m, r.line FROM recordings r WHERE r.user_id = ? ' . self::BY_START);
        $statement->execute([$userId]);
        return array_map(fn (array $row) => [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'startedAt' => $row['started_at'],
            'distanceM' => (int) $row['distance_m'],
            'line' => $row['line'],
            'days' => $days[(int) $row['id']] ?? [],
        ], $statement->fetchAll());
    }

    /**
     * Keeps a GPX file as a ride of the user's, with what is read from it beside it,
     * unless the user keeps the file already, for itself or as a part of a merged ride,
     * and puts the ride on the day where one is given. Null when the user has no such day.
     *
     * @return ?array{recording: Recording, added: bool} the ride, the one kept already where the file was, and whether the file was added
     */
    public function keep(int $userId, string $name, string $gzip, DateTimeImmutable $now, ?string $dayId = null): ?array
    {
        if ($dayId !== null && !$this->hasDay($userId, $dayId)) {
            return null;
        }
        $gpx = (string) gzdecode($gzip);
        $digest = hash('sha256', $gpx);
        $kept = $this->db->prepare(
            'SELECT id, name, distance_m, started_at FROM recordings WHERE user_id = ? AND (digest = ? OR id IN (SELECT recording_id FROM recording_parts WHERE digest = ?))',
        );
        $kept->execute([$userId, $digest, $digest]);
        $row = $kept->fetch();
        if ($row === false) {
            $summary = TrackSummary::of($gpx);
            $recording = new Recording($this->insert($userId, $name, $summary, $digest, $gzip, $now), $name, $summary->distanceM, $summary->startedAt, $dayId);
        } else {
            $recording = new Recording((int) $row['id'], $row['name'], (int) $row['distance_m'], $row['started_at'], $dayId);
        }
        if ($dayId !== null) {
            $this->db->prepare('INSERT OR IGNORE INTO recording_days (day_id, recording_id) VALUES (?, ?)')->execute([$dayId, $recording->id]);
        }
        return ['recording' => $recording, 'added' => $row === false];
    }

    /**
     * Merges rides of the user's that follow one another into one, named as the first:
     * their files joined in the order they began, on every day one of them was on. The
     * rides merged are deleted, and their files stay known as kept, as parts of the new
     * ride. Returns its id, or null when the user lacks one of them.
     *
     * @param list<int> $ids two or more
     * @throws Unmergeable
     */
    public function merge(int $userId, array $ids, DateTimeImmutable $now): ?int
    {
        $in = Database::placeholders($ids);
        $statement = $this->db->prepare("SELECT r.name, r.started_at, r.gpx FROM recordings r WHERE r.user_id = ? AND r.id IN ($in) " . self::BY_START);
        $statement->execute([$userId, ...$ids]);
        $pieces = $statement->fetchAll();
        if (count($pieces) !== count($ids)) {
            return null;
        }
        $began = array_column($pieces, 'started_at');
        if (in_array(null, $began, true)) {
            throw new Unmergeable('A recording without times cannot be merged.');
        }
        $between = $this->db->prepare("SELECT 1 FROM recordings WHERE user_id = ? AND id NOT IN ($in) AND started_at > ? AND started_at < ?");
        $between->execute([$userId, ...$ids, $began[0], $began[count($began) - 1]]);
        if ($between->fetchColumn() !== false) {
            throw new Unmergeable('Only recordings that follow one another can be merged.');
        }
        $gpx = GpxJoin::of(array_map(fn (array $piece) => (string) gzdecode($piece['gpx']), $pieces));
        $summary = TrackSummary::of($gpx);
        if ($summary->line === '') {
            throw new Unmergeable('These recordings cannot be read as one.');
        }
        $this->db->beginTransaction();
        try {
            $id = $this->insert($userId, $pieces[0]['name'], $summary, hash('sha256', $gpx), gzencode($gpx), $now);
            $this->db->prepare("INSERT OR IGNORE INTO recording_days (day_id, recording_id) SELECT day_id, ? FROM recording_days WHERE recording_id IN ($in)")->execute([$id, ...$ids]);
            $this->db->prepare("UPDATE OR IGNORE recording_parts SET recording_id = ? WHERE recording_id IN ($in)")->execute([$id, ...$ids]);
            $this->db->prepare("INSERT OR IGNORE INTO recording_parts (digest, recording_id) SELECT digest, ? FROM recordings WHERE id IN ($in)")->execute([$id, ...$ids]);
            $this->db->prepare("DELETE FROM recordings WHERE id IN ($in)")->execute($ids);
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
        return $id;
    }

    /** Puts the ride on a day of the user's, where it is not on it yet; false when the user has no such ride or no such day. */
    public function link(int $userId, int $recordingId, string $dayId): bool
    {
        if (!$this->has($userId, $recordingId) || !$this->hasDay($userId, $dayId)) {
            return false;
        }
        $this->db->prepare('INSERT OR IGNORE INTO recording_days (day_id, recording_id) VALUES (?, ?)')->execute([$dayId, $recordingId]);
        return true;
    }

    /** Takes the ride off the day, which keeps it as a ride; false when the user has no such ride on such a day. */
    public function unlink(int $userId, int $recordingId, string $dayId): bool
    {
        $statement = $this->db->prepare('DELETE FROM recording_days WHERE day_id = ? AND recording_id IN (SELECT id FROM recordings WHERE id = ? AND user_id = ?)');
        $statement->execute([$dayId, $recordingId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** False when the user has no such ride. */
    public function rename(int $userId, int $recordingId, string $name): bool
    {
        $statement = $this->db->prepare('UPDATE recordings SET name = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$name, $recordingId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Deletes the ride with its file, from every day it is on; false when the user has no such ride. */
    public function delete(int $userId, int $recordingId): bool
    {
        $statement = $this->db->prepare('DELETE FROM recordings WHERE id = ? AND user_id = ?');
        $statement->execute([$recordingId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** The ride's GPX file as kept, compressed with gzip; null when the user has no such ride. */
    public function gzip(int $userId, int $recordingId): ?string
    {
        $statement = $this->db->prepare('SELECT gpx FROM recordings WHERE id = ? AND user_id = ?');
        $statement->execute([$recordingId, $userId]);
        $gzip = $statement->fetchColumn();
        return $gzip === false ? null : (string) $gzip;
    }

    /** Keeps a file as a new ride of the user's and gives its id. */
    private function insert(int $userId, string $name, TrackSummary $summary, string $digest, string $gzip, DateTimeImmutable $now): int
    {
        $statement = $this->db->prepare('INSERT INTO recordings (user_id, name, created_at, line, distance_m, started_at, digest, gpx) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->bindValue(1, $userId, PDO::PARAM_INT);
        $statement->bindValue(2, $name);
        $statement->bindValue(3, Timestamp::of($now));
        $statement->bindValue(4, $summary->line);
        $statement->bindValue(5, $summary->distanceM, PDO::PARAM_INT);
        $statement->bindValue(6, $summary->startedAt);
        $statement->bindValue(7, $digest);
        $statement->bindValue(8, $gzip, PDO::PARAM_LOB);
        $statement->execute();
        return (int) $this->db->lastInsertId();
    }

    private function has(int $userId, int $recordingId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM recordings WHERE id = ? AND user_id = ?');
        $statement->execute([$recordingId, $userId]);
        return $statement->fetchColumn() !== false;
    }

    private function hasDay(int $userId, string $dayId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM days d JOIN trips t ON t.id = d.trip_id WHERE d.id = ? AND t.user_id = ?');
        $statement->execute([$dayId, $userId]);
        return $statement->fetchColumn() !== false;
    }
}
