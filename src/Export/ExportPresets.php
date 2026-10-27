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
        return array_map(fn (array $row) => new ExportPreset((int) $row['id'], $row['name'], json_decode($row['options'], true, flags: JSON_THROW_ON_ERROR)), $statement->fetchAll());
    }

    /**
     * Keeps a preset under its name, replacing one of that name.
     *
     * @param array{per: string, form: string, optional: bool, reachM: int} $options as `options()` gives them
     */
    public function save(int $userId, string $name, array $options, DateTimeImmutable $now): ExportPreset
    {
        $statement = $this->db->prepare(
            'INSERT INTO export_presets (user_id, name, options, created_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(user_id, name) DO UPDATE SET options = excluded.options',
        );
        $statement->execute([$userId, $name, Json::encode($options), Timestamp::of($now)]);
        $id = $this->db->prepare('SELECT id FROM export_presets WHERE user_id = ? AND name = ?');
        $id->execute([$userId, $name]);
        return new ExportPreset((int) $id->fetchColumn(), $name, $options);
    }

    /** False when the user has no such preset. */
    public function delete(int $userId, int $presetId): bool
    {
        $statement = $this->db->prepare('DELETE FROM export_presets WHERE id = ? AND user_id = ?');
        $statement->execute([$presetId, $userId]);
        return $statement->rowCount() === 1;
    }

    /**
     * A preset's options as sent by the client, checked and in their stored shape: `per` is
     * `trip` for one file or `day` for one file per day, the rest as ExportOptions takes
     * them. Null where they are malformed.
     *
     * @return ?array{per: string, form: string, optional: bool, reachM: int}
     */
    public static function options(mixed $options): ?array
    {
        $export = ExportOptions::fromArray($options);
        $per = is_array($options) ? $options['per'] ?? null : null;
        if ($export === null || !in_array($per, ['trip', 'day'], true)) {
            return null;
        }
        return ['per' => $per, 'form' => $export->form, 'optional' => $export->optional, 'reachM' => $export->reachM];
    }
}
