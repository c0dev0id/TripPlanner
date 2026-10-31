<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use PDO;
use Planner\Database;
use Planner\Timestamp;

/** A user's folders: at the top of the library or inside another folder. */
final class Folders
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return Folder[] the user's folders by name */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare('SELECT id, name, parent_id FROM folders WHERE user_id = ? ORDER BY name COLLATE NOCASE, id');
        $statement->execute([$userId]);
        return array_map(fn (array $row) => new Folder((int) $row['id'], $row['name'], $row['parent_id'] === null ? null : (int) $row['parent_id']), $statement->fetchAll());
    }

    /**
     * A new folder at the top, or inside the user's folder `parentId`.
     *
     * @throws UnknownFolder for a parent the user does not have
     */
    public function create(int $userId, string $name, ?int $parentId, DateTimeImmutable $now): Folder
    {
        $this->assertOwned($userId, $parentId);
        $statement = $this->db->prepare('INSERT INTO folders (user_id, parent_id, name, created_at) VALUES (?, ?, ?, ?)');
        $statement->execute([$userId, $parentId, $name, Timestamp::of($now)]);
        return new Folder((int) $this->db->lastInsertId(), $name, $parentId);
    }

    /**
     * Checks that a folder is the user's; no folder, null, is everyone's.
     *
     * @throws UnknownFolder for a folder the user does not have
     */
    public function assertOwned(int $userId, ?int $folderId): void
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

    /** False when the user has no such folder. */
    public function rename(int $userId, int $folderId, string $name): bool
    {
        $statement = $this->db->prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$name, $folderId, $userId]);
        return $statement->rowCount() === 1;
    }

    /**
     * Moves a folder to the top or into another of the user's folders. False when the user
     * has no such folder.
     *
     * @throws UnknownFolder for a parent the user does not have
     * @throws FolderInsideItself for a parent that is the folder or inside it
     */
    public function move(int $userId, int $folderId, ?int $parentId): bool
    {
        $this->assertOwned($userId, $parentId);
        if ($parentId !== null && in_array($parentId, $this->withInside($userId, $folderId), true)) {
            throw new FolderInsideItself();
        }
        $statement = $this->db->prepare('UPDATE folders SET parent_id = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$parentId, $folderId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Deletes a folder; its trips and folders move up into the folder it was in, or to the top. False when the user has no such folder. */
    public function delete(int $userId, int $folderId): bool
    {
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare('SELECT parent_id FROM folders WHERE id = ? AND user_id = ?');
            $statement->execute([$folderId, $userId]);
            $row = $statement->fetch();
            if ($row === false) {
                $this->db->rollBack();
                return false;
            }
            $this->db->prepare('UPDATE folders SET parent_id = ? WHERE parent_id = ?')->execute([$row['parent_id'], $folderId]);
            $this->db->prepare('UPDATE trips SET folder_id = ? WHERE folder_id = ?')->execute([$row['parent_id'], $folderId]);
            $this->db->prepare('DELETE FROM folders WHERE id = ?')->execute([$folderId]);
            $this->db->commit();
            return true;
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    /**
     * Deletes a folder with the folders inside it, at any depth, and every trip in them.
     *
     * @return int[]|null the ids of the deleted trips, for their journal files to go too; null when the user has no such folder
     */
    public function deleteWithContents(int $userId, int $folderId): ?array
    {
        $this->db->beginTransaction();
        try {
            $folderIds = $this->withInside($userId, $folderId);
            if ($folderIds === []) {
                $this->db->rollBack();
                return null;
            }
            $in = Database::placeholders($folderIds);
            $statement = $this->db->prepare("DELETE FROM trips WHERE folder_id IN ($in) RETURNING id");
            $statement->execute($folderIds);
            $tripIds = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
            $this->db->prepare("DELETE FROM folders WHERE id IN ($in)")->execute($folderIds);
            $this->db->commit();
            return $tripIds;
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }

    /** @return int[] the user's folder and the folders inside it at any depth; none when the user has no such folder */
    private function withInside(int $userId, int $folderId): array
    {
        $statement = $this->db->prepare(
            'WITH RECURSIVE inside(id) AS (SELECT id FROM folders WHERE id = ? AND user_id = ? UNION ALL SELECT f.id FROM folders f JOIN inside ON f.parent_id = inside.id) SELECT id FROM inside',
        );
        $statement->execute([$folderId, $userId]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }
}
