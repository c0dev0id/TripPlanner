<?php

declare(strict_types=1);

namespace Planner\Tests\Poi;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Planner\Poi\Kinds;
use Planner\Poi\OverpassAnswer;
use Planner\Poi\OverpassQuery;

final class OverpassAnswerTest extends TestCase
{
    private Kinds $kinds;
    private string $file;

    protected function setUp(): void
    {
        $this->kinds = Kinds::load(dirname(__DIR__, 2) . '/frontend/poi/places.json');
        $this->file = tempnam(sys_get_temp_dir(), 'answer');
    }

    protected function tearDown(): void
    {
        unlink($this->file);
    }

    /** A row of an answer: the values by column, the other columns empty. */
    private function row(array $values): string
    {
        return implode("\t", array_map(fn (string $column) => $values[$column] ?? '', OverpassQuery::columns($this->kinds))) . "\n";
    }

    private function answer(string ...$rows): OverpassAnswer
    {
        file_put_contents($this->file, implode('', $rows));
        return new OverpassAnswer($this->file, $this->kinds);
    }

    public function testReadsEachPlaceWithItsKindPositionAndTheTagsOfItsDetails(): void
    {
        $answer = $this->answer(
            $this->row(['::type' => 'node', '::id' => '1', '::lat' => '47.02', '::lon' => '8.29', 'amenity' => 'fuel', 'brand' => 'Agip', 'addr:city' => 'Kriens']),
            $this->row(['::type' => 'way', '::id' => '2', '::lat' => '47.1', '::lon' => '8.3', 'tourism' => 'guest_house', 'name' => 'Zur Post']),
            "complete\t1\n",
        );
        self::assertSame([
            ['id' => 'node/1', 'kind' => 'fuel', 'lng' => 8.29, 'lat' => 47.02, 'tags' => ['brand' => 'Agip', 'addr:city' => 'Kriens']],
            ['id' => 'way/2', 'kind' => 'hotel', 'lng' => 8.3, 'lat' => 47.1, 'tags' => ['name' => 'Zur Post']],
        ], iterator_to_array($answer->places(), false));
        self::assertTrue($answer->isComplete());
    }

    public function testLeavesOutWhatIsNotOpenToThePublicOfNoKindOrBroken(): void
    {
        $answer = $this->answer(
            $this->row(['::type' => 'way', '::id' => '1', '::lat' => '47', '::lon' => '8', 'amenity' => 'parking', 'access' => 'private']),
            $this->row(['::type' => 'way', '::id' => '2', '::lat' => '47', '::lon' => '8', 'amenity' => 'parking', 'access' => 'customers']),
            $this->row(['::type' => 'node', '::id' => '3', '::lat' => '47', '::lon' => '8', 'amenity' => 'bench']),
            $this->row(['::type' => 'node', '::id' => '4', 'amenity' => 'fuel']),
            "node\t5\t47\t8\tfuel\twith a\ttab too many\n",
            "complete\t1\n",
        );
        self::assertSame(['way/2'], array_column(iterator_to_array($answer->places(), false), 'id'));
    }

    public function testAnAnswerWithoutTheMarkAtItsEndIsNotComplete(): void
    {
        $cutShort = $this->answer($this->row(['::type' => 'node', '::id' => '1', '::lat' => '47', '::lon' => '8', 'amenity' => 'fuel']));
        self::assertCount(1, iterator_to_array($cutShort->places(), false));
        self::assertFalse($cutShort->isComplete());
        $nothing = $this->answer();
        self::assertSame([], iterator_to_array($nothing->places(), false));
        self::assertFalse($nothing->isComplete());
    }

    public function testTheQueryAsksForARegionOrACountryAndEndsWithTheMark(): void
    {
        $region = OverpassQuery::of('DE-RP', $this->kinds->kinds, $this->kinds);
        self::assertStringContainsString('area["ISO3166-2"="DE-RP"]->.a;', $region);
        self::assertStringContainsString('nwr["amenity"~"^(fuel|restaurant|cafe|parking|motorcycle_parking)$"](area.a);nwr["tourism"~"^(hotel|guest_house|motel|viewpoint)$"](area.a);', $region);
        self::assertStringStartsWith('[out:csv(::type,::id,::lat,::lon,"amenity","tourism","access","name",', $region);
        self::assertStringEndsWith('out center;make complete;out;', $region);
        self::assertStringContainsString('area["ISO3166-1"="CH"][admin_level=2]->.a;', OverpassQuery::of('CH', [$this->kinds->kinds[0]], $this->kinds));
        self::assertStringContainsString('(nwr["amenity"~"^(fuel)$"](area.a););', OverpassQuery::of('CH', [$this->kinds->kinds[0]], $this->kinds));
        $this->expectException(InvalidArgumentException::class);
        OverpassQuery::of('Rheinland"];(', $this->kinds->kinds, $this->kinds);
    }
}
