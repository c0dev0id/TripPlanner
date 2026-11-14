<?php

declare(strict_types=1);

namespace Planner\Stash;

use DateTimeImmutable;
use Planner\Recording\Recordings;

/** The way from the Stash to the rides: a track of a file kept as a ride, with all the file tells of it. */
final class StashRides
{
    public function __construct(private readonly StashFiles $files, private readonly Recordings $recordings)
    {
    }

    /**
     * Keeps tracks of a file of the user's as rides, each named after itself or else its
     * file: all of them, or those at the places given among the file's tracks. A track
     * that is all its file holds of routes and tracks is kept as the file is, so that it
     * is known as the ride the same file was kept as; any other is kept alone, without
     * the file's other tracks, its routes and its waypoints. Null when the user has no
     * such file.
     *
     * @param ?list<int> $positions
     * @return ?array{kept: int, known: int} how many rides were kept, and how many the user kept already
     */
    public function keep(int $userId, int $fileId, ?array $positions, DateTimeImmutable $now): ?array
    {
        $file = $this->files->find($userId, $fileId);
        if ($file === null) {
            return null;
        }
        $gzip = (string) $this->files->gzip($userId, $fileId);
        $tracks = array_filter($file['items'], fn (array $item) => $item['kind'] === 'track' && ($positions === null || in_array($item['position'], $positions, true)));
        $alone = count($file['items']) === 1 ? [] : GpxEdit::tracksAlone((string) gzdecode($gzip), array_column($tracks, 'position'));
        $count = ['kept' => 0, 'known' => 0];
        foreach ($tracks as $track) {
            $piece = isset($alone[$track['position']]) ? (string) gzencode($alone[$track['position']]) : $gzip;
            $kept = $this->recordings->keep($userId, $track['name'] !== '' ? mb_substr($track['name'], 0, 200) : $file['name'], $piece, $now);
            $count[$kept['added'] ? 'kept' : 'known']++;
        }
        return $count;
    }
}
