<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use PDO;
use Planner\Timestamp;

/** A user's folders, which sort the library one level deep. */
final class Folders
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return Folder[] the user's folders by name */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare('SELECT id, name FROM folders WHERE user_id = ? ORDER BY name COLLATE NOCASE, id');
        $statement->execute([$userId]);
        return array_map(fn (array $row) => new Folder((int) $row['id'], $row['name']), $statement->fetchAll());
    }

    public function create(int $userId, string $name, DateTimeImmutable $now): Folder
    {
        $statement = $this->db->prepare('INSERT INTO folders (user_id, name, created_at) VALUES (?, ?, ?)');
        $statement->execute([$userId, $name, Timestamp::of($now)]);
        return new Folder((int) $this->db->lastInsertId(), $name);
    }

    /** False when the user has no such folder. */
    public function rename(int $userId, int $folderId, string $name): bool
    {
        $statement = $this->db->prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$name, $folderId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Deletes a folder; its trips stay, in no folder. False when the user has no such folder. */
    public function delete(int $userId, int $folderId): bool
    {
        $statement = $this->db->prepare('DELETE FROM folders WHERE id = ? AND user_id = ?');
        $statement->execute([$folderId, $userId]);
        return $statement->rowCount() === 1;
    }
}
