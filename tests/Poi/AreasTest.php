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
        $listing = Areas::listing([
            ['area' => 'DE-RP', 'places' => 41234, 'fetchedAt' => '2026-11-11T10:00:00Z'],
            ['area' => 'IT-52', 'places' => 9, 'fetchedAt' => '2026-10-01T10:00:00Z'],
        ]);
        self::assertStringContainsString("DE-RP   Germany: Rheinland-Pfalz — 41234 places, fetched 2026-11-11\n", $listing);
        self::assertStringContainsString("DE-SL   Germany: Saarland\n", $listing);
        self::assertStringEndsWith("IT-52   9 places, fetched 2026-10-01\n", $listing);
    }
}
