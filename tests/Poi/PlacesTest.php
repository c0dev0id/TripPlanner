<?php

declare(strict_types=1);

namespace Planner\Tests\Poi;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Poi\Kinds;
use Planner\Poi\OverpassAnswer;
use Planner\Poi\Places;
use Planner\Poi\Tile;
use Planner\Tests\TestDatabase;

final class PlacesTest extends TestCase
{
    private PDO $db;
    private Places $places;
    private Kinds $kinds;
    private DateTimeImmutable $now;
    /** @var list<string> */
    private array $files = [];

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->places = new Places($this->db);
        $this->kinds = Kinds::load(dirname(__DIR__, 2) . '/frontend/poi/places.json');
        $this->now = new DateTimeImmutable('2026-11-11T10:00:00Z');
    }

    protected function tearDown(): void
    {
        array_map('unlink', $this->files);
    }

    /** An answer of places given as [type, id, lat, lon, amenity or tourism value, name], complete unless said otherwise. */
    private function answer(array $places, bool $complete = true): OverpassAnswer
    {
        $rows = '';
        foreach ($places as [$type, $id, $lat, $lon, $value, $name]) {
            $tourism = in_array($value, ['hotel', 'viewpoint'], true);
            $rows .= implode("\t", [$type, $id, $lat, $lon, $tourism ? '' : $value, $tourism ? $value : '', '', $name, ...array_fill(0, 13, '')]) . "\n";
        }
        $this->files[] = $file = tempnam(sys_get_temp_dir(), 'answer');
        file_put_contents($file, $rows . ($complete ? "complete\t1\n" : ''));
        return new OverpassAnswer($file, $this->kinds);
    }

    public function testKeepsAnAreasPlacesAndGivesThemByTileAndKind(): void
    {
        $kept = $this->places->replaceArea('CH-LU', [$this->answer([['node', 1, 47.02, 8.29, 'fuel', 'Agip'], ['way', 2, 47.03, 8.30, 'hotel', 'Adler'], ['node', 3, 46.0, 7.0, 'fuel', 'Far']])], $this->now);
        self::assertSame(3, $kept);
        [$x, $y] = Tile::of(8.29, 47.02);
        self::assertSame([$x, $y], Tile::of(8.30, 47.03));
        $fuel = $this->places->inTile($x, $y, ['fuel']);
        self::assertSame(['node/1'], array_column($fuel, 'id'));
        self::assertSame(['fuel', [8.29, 47.02]], [$fuel[0]['kind'], $fuel[0]['lngLat']]);
        self::assertSame('Agip', $fuel[0]['tags']->name);
        self::assertSame(['node/1', 'way/2'], array_column($this->places->inTile($x, $y, ['fuel', 'hotel', 'cafe']), 'id'));
        self::assertSame([], $this->places->inTile($x, $y, []));
        self::assertSame([['area' => 'CH-LU', 'places' => 3, 'fetchedAt' => '2026-11-11T10:00:00Z']], $this->places->areas());
    }

    public function testAFetchAgainReplacesItsAreaAndNoOther(): void
    {
        $this->places->replaceArea('CH-LU', [$this->answer([['node', 1, 47.02, 8.29, 'fuel', 'Agip'], ['node', 2, 47.02, 8.29, 'cafe', 'Gone']])], $this->now);
        $this->places->replaceArea('CH-ZG', [$this->answer([['node', 9, 47.02, 8.29, 'fuel', 'Zug']])], $this->now);
        $this->places->replaceArea('CH-LU', [$this->answer([['node', 1, 47.02, 8.29, 'fuel', 'Eni']])], $this->now->modify('+1 day'));
        [$x, $y] = Tile::of(8.29, 47.02);
        $all = $this->places->inTile($x, $y, $this->kinds->ids());
        self::assertSame(['node/1', 'node/9'], array_column($all, 'id'));
        self::assertSame('Eni', $all[0]['tags']->name);
    }

    public function testAnIncompleteOrEmptyAnswerChangesNothing(): void
    {
        $this->places->replaceArea('CH-LU', [$this->answer([['node', 1, 47.02, 8.29, 'fuel', 'Agip']])], $this->now);
        self::assertNull($this->places->replaceArea('CH-LU', [$this->answer([['node', 2, 47.02, 8.29, 'fuel', 'Half']], false)], $this->now));
        self::assertNull($this->places->replaceArea('CH-LU', [$this->answer([['node', 3, 47.02, 8.29, 'fuel', 'One']]), $this->answer([], false)], $this->now));
        self::assertNull($this->places->replaceArea('CH-LU', [$this->answer([])], $this->now));
        [$x, $y] = Tile::of(8.29, 47.02);
        self::assertSame(['node/1'], array_column($this->places->inTile($x, $y, ['fuel']), 'id'));
    }

    public function testTilesAreThoseOfTheWebsMapsAtZoomTen(): void
    {
        self::assertSame([512, 512], Tile::of(0.0, -0.0001));
        self::assertSame([535, 360], Tile::of(8.2963023, 47.0242031));
        self::assertSame([0, 0], Tile::of(-180.0, 89.0));
        self::assertSame([1023, 1023], Tile::of(180.0, -89.0));
    }
}
