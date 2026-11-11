<?php

declare(strict_types=1);

namespace Planner\Tests\Poi;

use PHPUnit\Framework\TestCase;
use Planner\Poi\Areas;
use Planner\Poi\Kinds;
use Planner\Poi\OverpassQuery;

final class AreasTest extends TestCase
{
    public function testEveryAreaOfTheListCanBeAskedFor(): void
    {
        $kinds = Kinds::load(dirname(__DIR__, 2) . '/frontend/poi/places.json');
        foreach (array_keys(Areas::NAMES) as $code) {
            self::assertStringContainsString("=\"$code\"]", OverpassQuery::of((string) $code, $kinds->kinds, $kinds));
        }
    }

    public function testTheListingSaysWhatIsKeptAndNamesAreasKeptBesideTheList(): void
    {
        $fetch = fn (string $area, string $kind, int $places, string $day) => ['area' => $area, 'kind' => $kind, 'places' => $places, 'fetchedAt' => "{$day}T10:00:00Z"];
        $listing = Areas::listing([$fetch('DE-RP', 'fuel', 1234, '2026-11-11'), $fetch('DE-RP', 'hotel', 40000, '2026-11-11'), $fetch('IT-52', 'fuel', 9, '2026-10-01'), $fetch('IT-52', 'hotel', 0, '2026-10-01')], ['fuel', 'hotel']);
        self::assertStringContainsString("DE-RP   Germany: Rheinland-Pfalz — 41234 places, fetched 2026-11-11\n", $listing);
        self::assertStringContainsString("DE-SL   Germany: Saarland\n", $listing);
        self::assertStringEndsWith("IT-52   9 places, fetched 2026-10-01\n", $listing);
    }

    public function testTheListingNamesTheAreasFetchedInPartAndWhatIsBehind(): void
    {
        $listing = Areas::listing(
            [
                ['area' => 'DE-BY', 'kind' => 'fuel', 'places' => 500, 'fetchedAt' => '2026-11-11T10:00:00Z'],
                ['area' => 'DE-BY', 'kind' => 'hotel', 'places' => 700, 'fetchedAt' => '2026-05-02T10:00:00Z'],
                ['area' => 'NL', 'kind' => 'fuel', 'places' => 80, 'fetchedAt' => '2026-11-11T10:00:00Z'],
                ['area' => 'NL', 'kind' => 'hotel', 'places' => 90, 'fetchedAt' => '2026-11-11T12:00:00Z'],
            ],
            ['fuel', 'hotel', 'cafe'],
        );
        self::assertStringContainsString("DE-BY   Germany: Bayern — 1200 places, fetched 2026-11-11, but hotel 2026-05-02, cafe never\n", $listing);
        self::assertStringContainsString("NL      Netherlands — 170 places, fetched 2026-11-11, but fuel 2026-11-11, cafe never\n", $listing);
        self::assertStringEndsWith("\n\nFetched in part, to fetch again: DE-BY, NL\n", $listing);
    }
}
