<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;
use PDO;
use Planner\Http\Json;
use Planner\Timestamp;

/** A user's export presets, by name. */
final class ExportPresets
{
    public function __construct(private readonly PDO $db)
    {
    }

    /** @return ExportPreset[] the user's presets by name */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare('SELECT id, name, options FROM export_presets WHERE user_id = ? ORDER BY name COLLATE NOCASE, id');
        $statement->execute([$userId]);
        return array_map(
            fn (array $row) => new ExportPreset((int) $row['id'], $row['name'], ExportOptions::from(json_decode($row['options'], true, flags: JSON_THROW_ON_ERROR)) ?? new ExportOptions()),
            $statement->fetchAll(),
        );
    }

    /** Keeps a preset under its name, replacing one of that name. */
    public function save(int $userId, string $name, ExportOptions $options, DateTimeImmutable $now): ExportPreset
    {
        $statement = $this->db->prepare(
            'INSERT INTO export_presets (user_id, name, options, created_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(user_id, name) DO UPDATE SET options = excluded.options RETURNING id',
        );
        $statement->execute([$userId, $name, Json::encode($options), Timestamp::of($now)]);
        return new ExportPreset((int) $statement->fetchColumn(), $name, $options);
    }

    /** False when the user has no such preset. */
    public function delete(int $userId, int $presetId): bool
    {
        $statement = $this->db->prepare('DELETE FROM export_presets WHERE id = ? AND user_id = ?');
        $statement->execute([$presetId, $userId]);
        return $statement->rowCount() === 1;
    }
}
