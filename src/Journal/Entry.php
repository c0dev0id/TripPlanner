<?php

declare(strict_types=1);

namespace Planner\Journal;

/** A journal entry: a note, a file, or both, on the trip or one of its parts; its public properties are its JSON. */
final readonly class Entry
{
    /**
     * @param ?array{name: string, mediaType: string, size: int, image: bool} $file the file, `image` where it has a preview
     * @param ?array{0: float, 1: float} $lngLat
     */
    public function __construct(
        public int $id,
        public int $tripId,
        public ?string $dayId,
        public ?string $stopId,
        public ?string $routeId,
        public string $text,
        public ?array $file,
        /** When a photo was taken, as its camera wrote it: YYYY-MM-DDTHH:MM:SS, no zone. */
        public ?string $takenAt,
        public ?array $lngLat,
        public string $createdAt,
    ) {
    }

    public static function fromRow(array $row): self
    {
        return new self(
            (int) $row['id'],
            (int) $row['trip_id'],
            $row['day_id'],
            $row['stop_id'],
            $row['route_id'],
            $row['text'],
            $row['file_name'] === null ? null : ['name' => $row['file_name'], 'mediaType' => $row['media_type'], 'size' => (int) $row['size'], 'image' => in_array($row['media_type'], FileStore::PREVIEWABLE, true)],
            $row['taken_at'],
            $row['lng'] === null ? null : [(float) $row['lng'], (float) $row['lat']],
            $row['created_at'],
        );
    }
}
