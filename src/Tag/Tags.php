<?php

declare(strict_types=1);

namespace Planner\Tag;

use PDO;

/** The tags a user made, each a name in a colour, and the trips of the user's they are on. */
final class Tags
{
    public const MAX_NAME = 40;

    public function __construct(private readonly PDO $db)
    {
    }

    /** The name as stored, or null where the value is none or too long. */
    public static function nameOf(mixed $value): ?string
    {
        $name = is_string($value) ? trim($value) : '';
        return $name === '' || mb_strlen($name) > self::MAX_NAME ? null : $name;
    }

    /** The colour as stored: six hexadecimal digits after a hash; null for anything else. */
    public static function colorOf(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^#[0-9a-f]{6}$/i', $value) === 1 ? strtolower($value) : null;
    }

    /** @return list<array{id: int, name: string, color: string}> the user's tags by name */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare('SELECT id, name, color FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE, id');
        $statement->execute([$userId]);
        return $statement->fetchAll();
    }

    /** @return ?array{id: int, name: string, color: string} the tag made; null where the user has one of that name */
    public function create(int $userId, string $name, string $color): ?array
    {
        $statement = $this->db->prepare('INSERT OR IGNORE INTO tags (user_id, name, color) VALUES (?, ?, ?)');
        $statement->execute([$userId, $name, $color]);
        return $statement->rowCount() === 1 ? ['id' => (int) $this->db->lastInsertId(), 'name' => $name, 'color' => $color] : null;
    }

    /** Gives the user's tag another name and colour. False where the user has no such tag, or another of that name. */
    public function change(int $userId, int $tagId, string $name, string $color): bool
    {
        $statement = $this->db->prepare('UPDATE OR IGNORE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?');
        $statement->execute([$name, $color, $tagId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Deletes the user's tag, which takes it off its trips; false when there is none. */
    public function delete(int $userId, int $tagId): bool
    {
        $statement = $this->db->prepare('DELETE FROM tags WHERE id = ? AND user_id = ?');
        $statement->execute([$tagId, $userId]);
        return $statement->rowCount() === 1;
    }

    /** Puts the user's tag on the user's trip, or takes it off. False where the user has no such trip or tag. */
    public function put(int $userId, int $tripId, int $tagId, bool $on): bool
    {
        $owned = $this->db->prepare('SELECT 1 FROM trips t, tags g WHERE t.id = ? AND t.user_id = ? AND g.id = ? AND g.user_id = ?');
        $owned->execute([$tripId, $userId, $tagId, $userId]);
        if ($owned->fetchColumn() === false) {
            return false;
        }
        $this->db->prepare($on ? 'INSERT OR IGNORE INTO trip_tags (trip_id, tag_id) VALUES (?, ?)' : 'DELETE FROM trip_tags WHERE trip_id = ? AND tag_id = ?')->execute([$tripId, $tagId]);
        return true;
    }
}
