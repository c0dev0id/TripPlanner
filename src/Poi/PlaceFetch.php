<?php

declare(strict_types=1);

namespace Planner\Poi;

use DateTimeImmutable;
use Planner\Config;
use Planner\Download;
use RuntimeException;

/**
 * Fetches the places of an area from the Overpass API into the planner's own store, for a
 * cron job to run area by area: the planner itself asks only its store.
 */
final class PlaceFetch
{
    /** Seconds between two questions of a fetch, for the server's sake. */
    private const PAUSE_S = 30;

    public function __construct(
        private readonly Places $places,
        private readonly Kinds $kinds,
        private readonly Config $config,
    ) {
    }

    /**
     * Fetches every kind of place in the area with one question, or, where the server does
     * not get through with that, kind by kind, and puts each kind answered in full in place
     * of what was kept of it for the area; a kind not answered stays as it was.
     *
     * @return array{places: int, missed: list<string>} the places fetched, and the kinds that were not answered
     * @throws RuntimeException where no kind was answered: the server did not get through, or knows no such area
     */
    public function fetch(string $area, DateTimeImmutable $now): array
    {
        $all = $this->fetchKinds($area, $this->kinds->kinds, $now);
        if ($all !== null) {
            return ['places' => $all, 'missed' => []];
        }
        $places = 0;
        $missed = [];
        foreach ($this->kinds->kinds as $kind) {
            sleep(self::PAUSE_S);
            $kept = $this->fetchKinds($area, [$kind], $now);
            $places += $kept ?? 0;
            if ($kept === null) {
                $missed[] = $kind['id'];
            }
        }
        if (count($missed) === count($this->kinds->kinds)) {
            throw new RuntimeException("The Overpass API gave no places for $area: it did not answer in full, or knows no area of that code. Nothing was changed.");
        }
        return ['places' => $places, 'missed' => $missed];
    }

    /** Asks for the kinds in the area and keeps the answer; null where it was not in full. */
    private function fetchKinds(string $area, array $kinds, DateTimeImmutable $now): ?int
    {
        $file = $this->ask($area, $kinds);
        try {
            return $this->places->replaceKinds($area, array_column($kinds, 'id'), new OverpassAnswer($file, $this->kinds), $now);
        } finally {
            unlink($file);
        }
    }

    /** Asks for the kinds in the area and saves the answer to a file, whose name it gives back. */
    private function ask(string $area, array $kinds): string
    {
        $file = tempnam(sys_get_temp_dir(), 'places');
        try {
            Download::post($this->config->overpassUrl, ['data' => OverpassQuery::of($area, $kinds, $this->kinds)], $file, 'make places', OverpassQuery::TIMEOUT_S + 60);
        } catch (RuntimeException $failure) {
            // A server too busy says so with a status; the answer then counts as none.
            file_put_contents($file, '');
            fwrite(STDERR, $failure->getMessage() . "\n");
        }
        return $file;
    }
}
