<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;
use Planner\Http\Json;
use Planner\Journal\Entries;
use Planner\Journal\FileStore;
use Planner\Recording\Recordings;
use Planner\Trip\TripDocuments;
use ZipArchive;

/**
 * Trips as a zip to keep or to import again: a folder per trip with `trip.json` (the
 * trip's document, its journal and its recordings, which name their files), the journal's
 * files, the recordings as GPX, and for other programs one GPX file per day.
 */
final class TripArchive
{
    public function __construct(
        private readonly TripDocuments $documents,
        private readonly Entries $entries,
        private readonly FileStore $files,
        private readonly Recordings $recordings,
    ) {
    }

    /**
     * Writes those of the trips that are the user's into a zip at `$file`.
     *
     * @param list<int> $tripIds
     * @return list<string> the names of the trips written
     */
    public function write(string $file, int $userId, array $tripIds, DateTimeImmutable $now): array
    {
        $zip = new ZipArchive();
        $zip->open($file, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        // Text goes in by way of a file: what is added as a string, the zip keeps in memory until it is closed.
        $written = [];
        $addText = function (string $name, string $text) use ($zip, &$written): void {
            $written[] = $part = tempnam(sys_get_temp_dir(), 'trip');
            file_put_contents($part, $text);
            $zip->addFile($part, $name);
        };
        $folders = [];
        $names = [];
        foreach ($tripIds as $tripId) {
            $document = $this->documents->load($userId, $tripId);
            if ($document === null) {
                continue;
            }
            $folder = $slug = TripGpx::fileName($document['name']);
            for ($n = 2; in_array($folder, $folders, true); $n++) {
                $folder = "$slug-$n";
            }
            $folders[] = $folder;
            $names[] = $document['name'];
            $addText("$folder/trip.json", Json::encode([
                'format' => 'trip-planner',
                'trip' => array_intersect_key($document, array_flip(['kind', 'name', 'description', 'state', 'days'])),
                'journal' => $this->addJournal($zip, $folder, $userId, $tripId),
                'recordings' => $this->addRecordings($addText, $folder, $userId, $tripId),
            ]));
            foreach (array_keys($document['days']) as $index) {
                $addText("$folder/" . TripGpx::dayFileName($document, $index) . '.gpx', TripGpx::day($document, $index, $now));
            }
        }
        $zip->close();
        array_map(unlink(...), $written);
        return $names;
    }

    /** Adds the files of the trip's journal and gives its entries, each naming its file in the folder. */
    private function addJournal(ZipArchive $zip, string $folder, int $userId, int $tripId): array
    {
        $journal = [];
        foreach ($this->entries->listFor($userId, $tripId) as $entry) {
            $path = null;
            $stored = $this->files->path($tripId, $entry->id);
            if ($entry->file !== null && is_file($stored)) {
                $path = "journal/$entry->id-" . TripGpx::fileName($entry->file['name']);
                $zip->addFile($stored, "$folder/$path");
                // Photos are compressed as they are.
                $zip->setCompressionName("$folder/$path", ZipArchive::CM_STORE);
            }
            $journal[] = [
                'dayId' => $entry->dayId,
                'stopId' => $entry->stopId,
                'routeId' => $entry->routeId,
                'text' => $entry->text,
                'file' => $path,
                'fileName' => $path === null ? null : $entry->file['name'],
                'lngLat' => $entry->lngLat,
                'createdAt' => $entry->createdAt,
            ];
        }
        return $journal;
    }

    /**
     * Adds the trip's recordings as GPX files and gives them, each naming its file in the folder.
     *
     * @param callable(string, string): void $addText
     */
    private function addRecordings(callable $addText, string $folder, int $userId, int $tripId): array
    {
        $recordings = [];
        foreach ($this->recordings->listFor($userId, $tripId) as $recording) {
            $path = "recordings/$recording->id-" . TripGpx::fileName($recording->name) . '.gpx';
            $addText("$folder/$path", gzdecode($this->recordings->gzip($userId, $tripId, $recording->id)));
            $recordings[] = ['dayId' => $recording->dayId, 'name' => $recording->name, 'file' => $path];
        }
        return $recordings;
    }
}
