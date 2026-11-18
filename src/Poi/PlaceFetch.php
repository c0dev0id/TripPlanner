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
        return $this->fetchOf($area, $this->kinds->kinds, $now);
    }

    /**
     * Fetches, for every area that has places, the kinds that were never fetched for it,
     * and leaves what is kept as it is: an area a kind was added after, or one whose fetch
     * missed a kind. Each area is given as it is done.
     *
     * @return iterable<string, array{places: int, missed: list<string>}> by the area; an area that was not answered at all has every kind asked for as missed
     */
    public function fill(DateTimeImmutable $now): iterable
    {
        $first = true;
        foreach ($this->places->unfetched($this->kinds->ids()) as $area => $ids) {
            if (!$first) {
                sleep(self::PAUSE_S);
            }
            $first = false;
            try {
                yield $area => $this->fetchOf($area, array_values(array_filter($this->kinds->kinds, fn (array $kind) => in_array($kind['id'], $ids, true))), $now);
            } catch (RuntimeException) {
                yield $area => ['places' => 0, 'missed' => $ids];
            }
        }
    }

    /**
     * @param list<array> $kinds
     * @return array{places: int, missed: list<string>}
     * @throws RuntimeException where no kind was answered
     */
    private function fetchOf(string $area, array $kinds, DateTimeImmutable $now): array
    {
        $all = $this->fetchKinds($area, $kinds, $now);
        if ($all !== null) {
            return ['places' => $all, 'missed' => []];
        }
        // One kind alone was asked already.
        if (count($kinds) === 1) {
            throw new RuntimeException("The Overpass API gave no places for $area: it did not answer in full, or knows no area of that code. Nothing was changed.");
        }
        $places = 0;
        $missed = [];
        foreach ($kinds as $kind) {
            sleep(self::PAUSE_S);
            $kept = $this->fetchKinds($area, [$kind], $now);
            $places += $kept ?? 0;
            if ($kept === null) {
                $missed[] = $kind['id'];
            }
        }
        if (count($missed) === count($kinds)) {
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

    /** How often a question is put to a server that turns it away. */
    private const TRIES = 3;

    /** Asks for the kinds in the area and saves the answer to a file, whose name it gives back. A server that turns the question away is asked again after the pause. */
    private function ask(string $area, array $kinds): string
    {
        $file = tempnam(sys_get_temp_dir(), 'places');
        $query = OverpassQuery::of($area, $kinds, $this->kinds);
        for ($try = 1; ; $try++) {
            try {
                Download::post($this->config->overpassUrl, ['data' => $query], $file, 'make places', OverpassQuery::TIMEOUT_S + 60);
                return $file;
            } catch (RuntimeException $failure) {
                if ($try === self::TRIES) {
                    // A server too busy says so with a status; the answer then counts as none.
                    file_put_contents($file, '');
                    fwrite(STDERR, $failure->getMessage() . "\n");
                    return $file;
                }
                sleep(self::PAUSE_S);
            }
        }
    }
}
