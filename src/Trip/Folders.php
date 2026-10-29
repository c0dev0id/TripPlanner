<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use PDO;
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
        if ($parentId !== null) {
            $statement = $this->db->prepare('SELECT 1 FROM folders WHERE id = ? AND user_id = ?');
            $statement->execute([$parentId, $userId]);
            if ($statement->fetchColumn() === false) {
                throw new UnknownFolder();
            }
        }
        $statement = $this->db->prepare('INSERT INTO folders (user_id, parent_id, name, created_at) VALUES (?, ?, ?, ?)');
        $statement->execute([$userId, $parentId, $name, Timestamp::of($now)]);
        return new Folder((int) $this->db->lastInsertId(), $name, $parentId);
    }

    /** False when the user has no such folder. */
    public function rename(int $userId, int $folderId, string $name): bool
    {
        $statement = $this->db->prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$name, $folderId, $userId]);
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
}
