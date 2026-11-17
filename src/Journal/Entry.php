<?php

declare(strict_types=1);

namespace Planner\Journal;

/**
 * A journal entry: a note, a file, or both, on the trip or one of its parts, with its
 * place among the entries of its chapter. Or, of the kind `media`, something kept with a
 * day: a file or a link (`url`), named by `text`. Its public properties are its JSON.
 */
final readonly class Entry
{
    /**
     * @param ?array{name: string, mediaType: string, size: int, image: bool, width: ?int, height: ?int} $file the file, `image` where it has a preview, with an image's size in pixels
     * @param ?array{0: float, 1: float} $lngLat where the entry stands on the map
     * @param ?array{0: float, 1: float} $takenLngLat where its photo was taken
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
        public ?array $takenLngLat,
        public string $createdAt,
        public string $kind,
        public ?string $url,
        public int $position,
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
            $row['file_name'] === null ? null : [
                'name' => $row['file_name'], 'mediaType' => $row['media_type'], 'size' => (int) $row['size'], 'image' => in_array($row['media_type'], FileStore::PREVIEWABLE, true),
                'width' => $row['width'], 'height' => $row['height'],
            ],
            $row['taken_at'],
            $row['lng'] === null ? null : [(float) $row['lng'], (float) $row['lat']],
            $row['taken_lng'] === null ? null : [(float) $row['taken_lng'], (float) $row['taken_lat']],
            $row['created_at'],
            $row['kind'],
            $row['url'],
            (int) $row['position'],
        );
    }
}
