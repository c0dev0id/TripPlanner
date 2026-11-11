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
     * not get through with that, kind by kind, and puts them in place of what was kept for
     * the area.
     *
     * @return int the number of places kept
     * @throws RuntimeException where the server does not answer in full, or knows no such area; what was kept stays
     */
    public function fetch(string $area, DateTimeImmutable $now): int
    {
        $files = [];
        try {
            $files[] = $this->ask($area, $this->kinds->kinds);
            $all = new OverpassAnswer($files[0], $this->kinds);
            $kept = $this->places->replaceArea($area, [$all], $now);
            if ($kept !== null) {
                return $kept;
            }
            if ($all->isComplete()) {
                throw new RuntimeException("The Overpass API knows no place in an area of the code $area; nothing was changed.");
            }
            foreach ($this->kinds->kinds as $kind) {
                sleep(self::PAUSE_S);
                $files[] = $this->ask($area, [$kind]);
            }
            $answers = array_map(fn (string $file) => new OverpassAnswer($file, $this->kinds), array_slice($files, 1));
            return $this->places->replaceArea($area, $answers, $now)
                ?? throw new RuntimeException("The Overpass API did not answer in full for $area; nothing was changed.");
        } finally {
            array_map('unlink', $files);
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
