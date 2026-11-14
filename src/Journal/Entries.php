<?php

declare(strict_types=1);

namespace Planner\Journal;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

/**
 * The journal entries of the trips: a user's own, or those of a trip shared under a token.
 * And the additional media of their days, entries of a kind of their own, which only
 * their user sees.
 */
final class Entries
{
    public const MAX_TEXT = 20000;

    public const JOURNAL = 'journal';
    public const MEDIA = 'media';

    /** The target keys an entry may name, and the tables their ids are in. */
    public const PARTS = ['dayId' => 'days', 'stopId' => 'stops', 'routeId' => 'routes'];

    private const SELECT = 'SELECT e.* FROM entries e JOIN trips t ON t.id = e.trip_id WHERE ';

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ?Entry[] the trip's entries of the kind, oldest first; null when the user has no such trip */
    public function listFor(int $userId, int $tripId, string $kind = self::JOURNAL): ?array
    {
        return $this->owns($userId, $tripId) ? $this->list('e.trip_id = ? AND e.kind = ?', [$tripId, $kind]) : null;
    }

    /** @return ?Entry[] the entries of the trip shared under the token; null when none is */
    public function listShared(string $token): ?array
    {
        $statement = $this->db->prepare('SELECT 1 FROM trips WHERE share_token = ?');
        $statement->execute([$token]);
        return $statement->fetchColumn() === false ? null : $this->list('t.share_token = ? AND e.kind = ?', [$token, self::JOURNAL]);
    }

    public function find(int $userId, int $tripId, int $entryId, string $kind = self::JOURNAL): ?Entry
    {
        return $this->one('e.id = ? AND e.trip_id = ? AND t.user_id = ? AND e.kind = ?', [$entryId, $tripId, $userId, $kind]);
    }

    /** An entry of the journal of the trip shared under the token; media are not shared. */
    public function findShared(string $token, int $entryId): ?Entry
    {
        return $this->one('e.id = ? AND t.share_token = ? AND e.kind = ?', [$entryId, $token, self::JOURNAL]);
    }

    /**
     * Adds an entry to the trip, on the part `$target` names (one of PARTS' keys, an id of
     * the trip's) or on the trip itself; a photo with a time and no part goes to the day of
     * that date. The entry stands where its photo was taken, else at `$spot` where given.
     * Null when the user has no such trip or part.
     *
     * @param array{dayId?: string, stopId?: string, routeId?: string} $target
     * @param ?array{name: string, mediaType: string, size: int, takenAt: ?string, lngLat: ?array{0: float, 1: float}} $file
     * @param ?array{0: float, 1: float} $spot
     */
    public function add(int $userId, int $tripId, array $target, string $text, ?array $file, DateTimeImmutable $now, ?array $spot = null): ?Entry
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
        $lngLat = $file['lngLat'] ?? $spot;
        $statement = $this->db->prepare(
            'INSERT INTO entries (trip_id, day_id, stop_id, route_id, text, file_name, media_type, size, taken_at, lng, lat, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        );
        $statement->execute([
            $tripId, $dayId, $target['stopId'] ?? null, $target['routeId'] ?? null, $text,
            $file['name'] ?? null, $file['mediaType'] ?? null, $file['size'] ?? null, $file['takenAt'] ?? null, $lngLat[0] ?? null, $lngLat[1] ?? null,
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

    /**
     * Keeps a file or a link with a day of the trip, under a name; one of `$file` and
     * `$url` is given. Null when the user has no such trip or day.
     *
     * @param ?array{name: string, mediaType: string, size: int} $file
     */
    public function addMedia(int $userId, int $tripId, string $dayId, string $name, ?array $file, ?string $url, DateTimeImmutable $now): ?Entry
    {
        if (!$this->owns($userId, $tripId) || !$this->partOf($tripId, 'days', $dayId)) {
            return null;
        }
        $this->db->prepare('INSERT INTO entries (trip_id, day_id, kind, text, file_name, media_type, size, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$tripId, $dayId, self::MEDIA, $name, $file['name'] ?? null, $file['mediaType'] ?? null, $file['size'] ?? null, $url, Timestamp::of($now)]);
        return $this->one('e.id = ?', [(int) $this->db->lastInsertId()]);
    }

    /** Names a day's file or link anew, and gives a link its address; false when the user has none such. */
    public function changeMedia(int $userId, int $tripId, int $entryId, string $name, ?string $url): bool
    {
        $entry = $this->find($userId, $tripId, $entryId, self::MEDIA);
        if ($entry === null) {
            return false;
        }
        $this->db->prepare('UPDATE entries SET text = ?, url = ? WHERE id = ?')->execute([$name, $entry->url === null ? null : ($url ?? $entry->url), $entryId]);
        return true;
    }

    /**
     * Moves a day's file or link to another day of the user's, in whichever trip, and
     * returns it as it is then, for its file to follow; null when the user lacks either.
     */
    public function moveMedia(int $userId, int $tripId, int $entryId, string $dayId): ?Entry
    {
        $toTripId = $this->tripOfDay($userId, $dayId);
        if ($toTripId === null || $this->find($userId, $tripId, $entryId, self::MEDIA) === null) {
            return null;
        }
        $this->db->prepare('UPDATE entries SET trip_id = ?, day_id = ? WHERE id = ?')->execute([$toTripId, $dayId, $entryId]);
        return $this->one('e.id = ?', [$entryId]);
    }

    /**
     * A copy of a day's file or link on another day of the user's, in whichever trip, for
     * its file to be copied too; null when the user lacks either.
     */
    public function copyMedia(int $userId, int $tripId, int $entryId, string $dayId, DateTimeImmutable $now): ?Entry
    {
        $toTripId = $this->tripOfDay($userId, $dayId);
        $entry = $this->find($userId, $tripId, $entryId, self::MEDIA);
        if ($toTripId === null || $entry === null) {
            return null;
        }
        return $this->copyOf($entry, $toTripId, $dayId, $now);
    }

    /**
     * Copies the media of a trip's days to the days of its copy, which stand in the same
     * order, and gives each with its copy, for the files to be copied too.
     *
     * @return list<array{0: Entry, 1: Entry}>
     */
    public function copyMediaOfTrip(int $fromTripId, int $toTripId, DateTimeImmutable $now): array
    {
        $days = fn (int $tripId) => $this->column('SELECT id FROM days WHERE trip_id = ? ORDER BY position', [$tripId]);
        $copied = array_combine($days($fromTripId), $days($toTripId));
        return array_map(
            fn (Entry $entry) => [$entry, $this->copyOf($entry, $toTripId, $copied[$entry->dayId], $now)],
            $this->list('e.trip_id = ? AND e.kind = ? AND e.day_id IS NOT NULL', [$fromTripId, self::MEDIA]),
        );
    }

    /**
     * Removes the media of the trip that have lost their day and returns them, for their
     * files to go too: a day takes what is kept with it along.
     *
     * @return Entry[]
     */
    public function takeMediaWithoutDay(int $tripId): array
    {
        $lost = $this->list('e.trip_id = ? AND e.kind = ? AND e.day_id IS NULL', [$tripId, self::MEDIA]);
        if ($lost !== []) {
            $this->db->prepare('DELETE FROM entries WHERE trip_id = ? AND kind = ? AND day_id IS NULL')->execute([$tripId, self::MEDIA]);
        }
        return $lost;
    }

    /** Deletes the entry and returns it, for its file to go too; null when the user has no such entry. */
    public function delete(int $userId, int $tripId, int $entryId, string $kind = self::JOURNAL): ?Entry
    {
        $entry = $this->find($userId, $tripId, $entryId, $kind);
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

    private function copyOf(Entry $entry, int $tripId, string $dayId, DateTimeImmutable $now): Entry
    {
        $this->db->prepare('INSERT INTO entries (trip_id, day_id, kind, text, file_name, media_type, size, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$tripId, $dayId, $entry->kind, $entry->text, $entry->file['name'] ?? null, $entry->file['mediaType'] ?? null, $entry->file['size'] ?? null, $entry->url, Timestamp::of($now)]);
        return $this->one('e.id = ?', [(int) $this->db->lastInsertId()]);
    }

    /** @return list<string> */
    private function column(string $sql, array $params): array
    {
        $statement = $this->db->prepare($sql);
        $statement->execute($params);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    /** The trip a day of the user's is in; null when the user has no such day. */
    private function tripOfDay(int $userId, string $dayId): ?int
    {
        $tripId = $this->column('SELECT d.trip_id FROM days d JOIN trips t ON t.id = d.trip_id WHERE d.id = ? AND t.user_id = ?', [$dayId, $userId])[0] ?? null;
        return $tripId === null ? null : (int) $tripId;
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
