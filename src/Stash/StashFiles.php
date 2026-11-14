<?php

declare(strict_types=1);

namespace Planner\Stash;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;
use Planner\Trip\Folders;

/**
 * The files of the Stash: GPX files kept as they were imported, each in a folder for
 * collections, with what is read from them beside them (see GpxIndex).
 */
final class StashFiles
{
    private const FILE = 'SELECT id, folder_id, name, created_at, waypoints FROM stash_files';

    public function __construct(private readonly PDO $db, private readonly Folders $folders)
    {
    }

    /**
     * The user's files by name, each with its folder, how many waypoints it holds and
     * its routes and tracks in the file's order.
     *
     * @return list<array{id: int, folderId: int, name: string, createdAt: string, waypoints: int, items: list<array<string, mixed>>}>
     */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare(
            'SELECT i.file_id, i.kind, i.position, i.name, i.line, i.distance_m, i.points, i.started_at FROM stash_items i JOIN stash_files f ON f.id = i.file_id
             WHERE f.user_id = ? ORDER BY i.file_id, i.kind, i.position',
        );
        $statement->execute([$userId]);
        $items = [];
        foreach ($statement as $row) {
            $items[(int) $row['file_id']][] = self::item($row);
        }
        $statement = $this->db->prepare(self::FILE . ' WHERE user_id = ? ORDER BY name COLLATE NOCASE, id');
        $statement->execute([$userId]);
        return array_map(fn (array $row) => self::file($row, $items[(int) $row['id']] ?? []), $statement->fetchAll());
    }

    /**
     * Keeps a GPX file in a folder of the user's Stash, unless the user keeps the file
     * already, wherever in the Stash. Null when the user has no such folder there.
     *
     * @return ?array{file: array<string, mixed>, added: bool} the file as it is listed, the one kept already where it was, and whether it was added
     */
    public function keep(int $userId, int $folderId, string $name, string $gzip, DateTimeImmutable $now): ?array
    {
        if ($this->folders->kindAround($userId, $folderId) !== 'collections') {
            return null;
        }
        $gpx = (string) gzdecode($gzip);
        $digest = hash('sha256', $gpx);
        $kept = $this->db->prepare(self::FILE . ' WHERE user_id = ? AND digest = ?');
        $kept->execute([$userId, $digest]);
        $row = $kept->fetch();
        if ($row !== false) {
            return ['file' => self::file($row, $this->items((int) $row['id'])), 'added' => false];
        }
        $index = GpxIndex::of($gpx);
        $this->db->beginTransaction();
        $this->db->prepare('INSERT INTO stash_files (user_id, folder_id, name, created_at, waypoints, digest, gpx) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$userId, $folderId, $name, Timestamp::of($now), $index->waypoints, $digest, $gzip]);
        $id = (int) $this->db->lastInsertId();
        $this->index($id, $index);
        $this->db->commit();
        $row = ['id' => $id, 'folder_id' => $folderId, 'name' => $name, 'created_at' => Timestamp::of($now), 'waypoints' => $index->waypoints];
        return ['file' => self::file($row, $this->items($id)), 'added' => true];
    }

    /** The file as it is listed; null when the user has no such file. */
    public function find(int $userId, int $id): ?array
    {
        $statement = $this->db->prepare(self::FILE . ' WHERE id = ? AND user_id = ?');
        $statement->execute([$id, $userId]);
        $row = $statement->fetch();
        return $row === false ? null : self::file($row, $this->items($id));
    }

    /** The file as it is kept, compressed with gzip; null when the user has no such file. */
    public function gzip(int $userId, int $id): ?string
    {
        $statement = $this->db->prepare('SELECT gpx FROM stash_files WHERE id = ? AND user_id = ?');
        $statement->execute([$id, $userId]);
        $gzip = $statement->fetchColumn();
        return $gzip === false ? null : $gzip;
    }

    /** False when the user has no such file. */
    public function rename(int $userId, int $id, string $name): bool
    {
        $statement = $this->db->prepare('UPDATE stash_files SET name = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$name, $id, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Moves the file into another folder of the Stash. False when the user has no such file, or no such folder there. */
    public function move(int $userId, int $id, int $folderId): bool
    {
        if ($this->folders->kindAround($userId, $folderId) !== 'collections') {
            return false;
        }
        $statement = $this->db->prepare('UPDATE stash_files SET folder_id = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$folderId, $id, $userId]);
        return $statement->rowCount() === 1;
    }

    /** False when the user has no such file. */
    public function delete(int $userId, int $id): bool
    {
        $statement = $this->db->prepare('DELETE FROM stash_files WHERE id = ? AND user_id = ?');
        $statement->execute([$id, $userId]);
        return $statement->rowCount() === 1;
    }

    /**
     * Renames a route or a track of a file, by its kind and its place among the file's
     * elements of the kind, which rewrites the file. False when the user has no such
     * file, or it has no such route or track.
     */
    public function renameItem(int $userId, int $id, string $kind, int $position, string $name): bool
    {
        return $this->rewrite($userId, $id, fn (string $gpx) => GpxEdit::renamed($gpx, $kind, $position, $name));
    }

    /**
     * Removes routes and tracks from a file, each by its kind and its place among the
     * file's elements of the kind, which rewrites the file. False when the user has no
     * such file, or it lacks one of them.
     *
     * @param list<array{kind: string, position: int}> $items
     */
    public function removeItems(int $userId, int $id, array $items): bool
    {
        return $this->rewrite($userId, $id, fn (string $gpx) => GpxEdit::without($gpx, $items));
    }

    /** Puts the file a change makes of the stored one in its place, with what is read from it; false where there is no such file or the change does not apply. */
    private function rewrite(int $userId, int $id, callable $change): bool
    {
        $gzip = $this->gzip($userId, $id);
        $gpx = $gzip === null ? null : $change((string) gzdecode($gzip));
        if ($gpx === null) {
            return false;
        }
        $index = GpxIndex::of($gpx);
        $this->db->beginTransaction();
        $this->db->prepare('UPDATE stash_files SET waypoints = ?, gpx = ? WHERE id = ?')->execute([$index->waypoints, gzencode($gpx), $id]);
        $this->db->prepare('DELETE FROM stash_items WHERE file_id = ?')->execute([$id]);
        $this->index($id, $index);
        $this->db->commit();
        return true;
    }

    private function index(int $id, GpxIndex $index): void
    {
        $insert = $this->db->prepare('INSERT INTO stash_items (file_id, kind, position, name, line, distance_m, points, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($index->items as $item) {
            $insert->execute([$id, $item['kind'], $item['position'], $item['name'], $item['line'], $item['distanceM'], $item['points'], $item['startedAt']]);
        }
    }

    /** @return list<array<string, mixed>> the routes and tracks of one file, as they are listed */
    private function items(int $id): array
    {
        $statement = $this->db->prepare('SELECT kind, position, name, line, distance_m, points, started_at FROM stash_items WHERE file_id = ? ORDER BY kind, position');
        $statement->execute([$id]);
        return array_map(self::item(...), $statement->fetchAll());
    }

    private static function item(array $row): array
    {
        return [
            'kind' => $row['kind'],
            'position' => (int) $row['position'],
            'name' => $row['name'],
            'line' => $row['line'],
            'distanceM' => (int) $row['distance_m'],
            'points' => (int) $row['points'],
            'startedAt' => $row['started_at'],
        ];
    }

    private static function file(array $row, array $items): array
    {
        return ['id' => (int) $row['id'], 'folderId' => (int) $row['folder_id'], 'name' => $row['name'], 'createdAt' => $row['created_at'], 'waypoints' => (int) $row['waypoints'], 'items' => $items];
    }
}
