<?php

declare(strict_types=1);

namespace Planner\Stash;

use DateTimeImmutable;
use PDO;
use Planner\Journal\FileStore;
use Planner\Timestamp;

/**
 * The media kept with the files of the Stash: photos, documents and whatever else belongs
 * to a file as a whole. They are kept in the database beside the file, so that they go
 * with it wherever it goes and when it is deleted.
 */
final class StashMedia
{
    private const LISTED = 'm.id, m.file_id, m.name, m.media_type, m.size';

    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * The media of the user's files, by file and by name.
     *
     * @return array<int, list<array{id: int, name: string, mediaType: string, size: int, image: bool}>>
     */
    public function listFor(int $userId): array
    {
        $statement = $this->db->prepare('SELECT ' . self::LISTED . ' FROM stash_media m JOIN stash_files f ON f.id = m.file_id WHERE f.user_id = ? ORDER BY m.file_id, m.name COLLATE NOCASE, m.id');
        $statement->execute([$userId]);
        $media = [];
        foreach ($statement as $row) {
            $media[(int) $row['file_id']][] = self::listed($row);
        }
        return $media;
    }

    /** @return list<array{id: int, name: string, mediaType: string, size: int, image: bool}> the media of one file, by name */
    public function of(int $fileId): array
    {
        $statement = $this->db->prepare('SELECT ' . self::LISTED . ' FROM stash_media m WHERE m.file_id = ? ORDER BY m.name COLLATE NOCASE, m.id');
        $statement->execute([$fileId]);
        return array_map(self::listed(...), $statement->fetchAll());
    }

    /**
     * Keeps a media file with a file of the user's Stash, with its preview where it is an
     * image that has one, unless the file has it already. Null when the user has no such
     * file.
     *
     * @param array{name: string, mediaType: string, size: int} $file
     * @return ?array{media: array<string, mixed>, added: bool} the media file as it is listed, the one kept already where it was, and whether it was added
     */
    public function keep(int $userId, int $fileId, array $file, string $content, ?string $preview, DateTimeImmutable $now): ?array
    {
        $owned = $this->db->prepare('SELECT 1 FROM stash_files WHERE id = ? AND user_id = ?');
        $owned->execute([$fileId, $userId]);
        if ($owned->fetchColumn() === false) {
            return null;
        }
        $digest = hash('sha256', $content);
        $kept = $this->db->prepare('SELECT id FROM stash_media WHERE file_id = ? AND digest = ?');
        $kept->execute([$fileId, $digest]);
        $id = $kept->fetchColumn();
        $added = $id === false;
        if ($added) {
            $insert = $this->db->prepare('INSERT INTO stash_media (file_id, name, media_type, size, digest, created_at, preview, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ([$fileId, $file['name'], $file['mediaType'], $file['size'], $digest, Timestamp::of($now)] as $at => $value) {
                $insert->bindValue($at + 1, $value);
            }
            $insert->bindValue(7, $preview, $preview === null ? PDO::PARAM_NULL : PDO::PARAM_LOB);
            $insert->bindValue(8, $content, PDO::PARAM_LOB);
            $insert->execute();
            $id = $this->db->lastInsertId();
        }
        $row = $this->db->prepare('SELECT ' . self::LISTED . ' FROM stash_media m WHERE m.id = ?');
        $row->execute([$id]);
        return ['media' => self::listed($row->fetch()), 'added' => $added];
    }

    /** @return ?array{name: string, mediaType: string, content: string} the media file as it was kept; null when the user has none such */
    public function content(int $userId, int $fileId, int $mediaId): ?array
    {
        $row = $this->column('m.name, m.media_type, m.content', $userId, $fileId, $mediaId);
        return $row === null ? null : ['name' => $row['name'], 'mediaType' => $row['media_type'], 'content' => $row['content']];
    }

    /** The small JPEG of an image among the media; null when the user has none such, or it has no preview. */
    public function preview(int $userId, int $fileId, int $mediaId): ?string
    {
        return $this->column('m.preview', $userId, $fileId, $mediaId)['preview'] ?? null;
    }

    /** Removes one media file of a file, or with no id all of them. False when the user has no such file, or it has none such. */
    public function delete(int $userId, int $fileId, ?int $mediaId): bool
    {
        $statement = $this->db->prepare('DELETE FROM stash_media WHERE file_id = ? AND (? IS NULL OR id = ?) AND file_id IN (SELECT id FROM stash_files WHERE user_id = ?)');
        $statement->execute([$fileId, $mediaId, $mediaId, $userId]);
        return $statement->rowCount() > 0;
    }

    /** Columns of one media file of the user's. */
    private function column(string $columns, int $userId, int $fileId, int $mediaId): ?array
    {
        $statement = $this->db->prepare("SELECT $columns FROM stash_media m JOIN stash_files f ON f.id = m.file_id WHERE m.id = ? AND m.file_id = ? AND f.user_id = ?");
        $statement->execute([$mediaId, $fileId, $userId]);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    private static function listed(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'mediaType' => $row['media_type'],
            'size' => (int) $row['size'],
            'image' => in_array($row['media_type'], FileStore::PREVIEWABLE, true),
        ];
    }
}
