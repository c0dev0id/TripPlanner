<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Planner\Trip\InvalidDocument;
use Planner\Trip\TripDocumentValidator;

final class TripDocumentValidatorTest extends TestCase
{
    public function testAcceptsTheFixtureAndFillsInDefaults(): void
    {
        $document = TripFixture::document();
        $document['name'] = '  Alps ';
        unset($document['days'][0]['routes'][0]['optional'], $document['places'][0]['notes']);
        $valid = TripDocumentValidator::validated($document);
        self::assertSame('Alps', $valid['name']);
        self::assertSame('2027-06-12', $valid['startsOn']);
        self::assertFalse($valid['days'][0]['routes'][0]['optional']);
        self::assertSame('', $valid['places'][0]['notes']);
        self::assertSame([11.5, 48.1], $valid['places'][0]['lngLat']);
    }

    public function testRoundsLegDistancesAndKeepsStraightFlags(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][0]['points'][1]['straight'] = true;
        $document['days'][0]['routes'][0]['legs'] = ['car/11.5,48.1;11.4,47.3' => ['geometry' => 'abc', 'distanceM' => 1234.6, 'durationS' => 99.2]];
        $route = TripDocumentValidator::validated($document)['days'][0]['routes'][0];
        self::assertTrue($route['points'][1]['straight']);
        self::assertSame(['geometry' => 'abc', 'distanceM' => 1235, 'durationS' => 99], $route['legs']['car/11.5,48.1;11.4,47.3']);
    }

    #[DataProvider('invalidDocuments')]
    public function testRejectsADocumentThatBreaksTheShape(callable $break, string $messagePart): void
    {
        $document = TripFixture::document();
        $break($document);
        $this->expectException(InvalidDocument::class);
        $this->expectExceptionMessage($messagePart);
        TripDocumentValidator::validated($document);
    }

    public static function invalidDocuments(): iterable
    {
        yield 'no name' => [fn (array &$d) => $d['name'] = '  ', 'document.name'];
        yield 'name too long' => [fn (array &$d) => $d['name'] = str_repeat('x', 201), 'document.name'];
        yield 'bad date' => [fn (array &$d) => $d['startsOn'] = '2027-02-30', 'document.startsOn'];
        yield 'unknown place kind' => [fn (array &$d) => $d['places'][0]['kind'] = 'castle', 'places[0].kind'];
        yield 'position outside the world' => [fn (array &$d) => $d['places'][0]['lngLat'] = [200, 0], 'places[0].lngLat'];
        yield 'duplicate place id' => [fn (array &$d) => $d['places'][1]['id'] = 'home', 'places holds the same id twice'];
        yield 'stop at unknown place' => [fn (array &$d) => $d['days'][0]['stops'][0]['placeId'] = 'nowhere', 'placeId names no place'];
        yield 'bad arrival time' => [fn (array &$d) => $d['days'][0]['stops'][0]['arriveAt'] = '25:00', 'arriveAt'];
        yield 'negative pause' => [fn (array &$d) => $d['days'][0]['stops'][0]['pauseMinutes'] = -5, 'pauseMinutes'];
        yield 'one route too many' => [fn (array &$d) => $d['days'][0]['routes'][] = TripFixture::route('r2', [1, 1], [2, 2]), 'one route per pair'];
        yield 'route not ending at its stop' => [fn (array &$d) => $d['days'][0]['routes'][0]['points'][1]['lngLat'] = [11.4, 47.31], 'start and end at the positions'];
        yield 'route with one point' => [fn (array &$d) => $d['days'][0]['routes'][0]['points'] = [['id' => 'p', 'lngLat' => [11.5, 48.1]]], 'at least the two stops'];
        yield 'unknown profile' => [fn (array &$d) => $d['days'][0]['routes'][0]['profile'] = 'horse', 'profile must be one of'];
        yield 'legs as a list' => [fn (array &$d) => $d['days'][0]['routes'][0]['legs'] = ['abc'], 'legs must be an object'];
        yield 'leg without distance' => [fn (array &$d) => $d['days'][0]['routes'][0]['legs'] = ['k' => ['geometry' => 'abc']], 'legs must map'];
        yield 'not an object' => [fn (array &$d) => $d['days'][0] = 'monday', 'days[0] must be an object'];
    }
}
