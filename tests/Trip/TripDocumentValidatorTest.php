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
        unset($document['days'][0]['routes'][0]['optional'], $document['days'][0]['stops'][0]['notes']);
        $valid = TripDocumentValidator::validated($document);
        self::assertSame('Alps', $valid['name']);
        self::assertSame('2027-06-12', $valid['days'][0]['date']);
        self::assertFalse($valid['days'][0]['routes'][0]['optional']);
        self::assertSame('', $valid['days'][0]['stops'][0]['notes']);
        self::assertSame('r1-0', $valid['days'][0]['stops'][0]['pointId']);
        self::assertNull($valid['days'][0]['stops'][2]['pointId']);
    }

    public function testRoundsLegDistancesAndKeepsStraightFlags(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][0]['points'][1]['straight'] = true;
        $document['days'][0]['routes'][0]['legs'] = ['motorcycle:allow/11.5,48.1;11.45,47.8' => ['geometry' => 'abc', 'distanceM' => 1234.6, 'durationS' => 99.2]];
        $route = TripDocumentValidator::validated($document)['days'][0]['routes'][0];
        self::assertTrue($route['points'][1]['straight']);
        self::assertSame(['geometry' => 'abc', 'distanceM' => 1235, 'durationS' => 99], $route['legs']['motorcycle:allow/11.5,48.1;11.45,47.8']);
    }

    public function testAcceptsARouteWithoutPointsAndADayWithoutRoutes(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][0]['points'] = [];
        $document['days'][0]['stops'] = [TripFixture::stop('s3', 'Café', [11.46, 47.81], null)];
        self::assertCount(0, TripDocumentValidator::validated($document)['days'][0]['routes'][0]['points']);
        $document['days'][0]['routes'] = [];
        self::assertCount(1, TripDocumentValidator::validated($document)['days'][0]['stops']);
    }

    public function testAcceptsEveryStopKind(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['stops'] = array_map(fn ($kind) => TripFixture::stop("s-$kind", $kind, [11.46, 47.81], null, $kind), TripDocumentValidator::STOP_KINDS);
        $kinds = array_column(TripDocumentValidator::validated($document)['days'][0]['stops'], 'kind');
        self::assertSame(TripDocumentValidator::STOP_KINDS, $kinds);
        self::assertContains('info', $kinds);
    }

    public function testCountsNamesAndTextsInCharacters(): void
    {
        $document = TripFixture::document();
        $document['name'] = str_repeat('ö', 200);
        $document['days'][0]['stops'][0]['notes'] = str_repeat('ü', 20000);
        $checked = TripDocumentValidator::validated($document);
        self::assertSame(200, mb_strlen($checked['name']));
        self::assertSame(20000, mb_strlen($checked['days'][0]['stops'][0]['notes']));
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
        yield 'notes too long' => [fn (array &$d) => $d['days'][0]['stops'][0]['notes'] = str_repeat('ü', 20001), 'stops[0].notes'];
        yield 'bad date' => [fn (array &$d) => $d['days'][0]['date'] = '2027-02-30', 'days[0].date'];
        yield 'unknown stop kind' => [fn (array &$d) => $d['days'][0]['stops'][0]['kind'] = 'castle', 'stops[0].kind'];
        yield 'position outside the world' => [fn (array &$d) => $d['days'][0]['stops'][2]['lngLat'] = [200, 0], 'stops[2].lngLat'];
        yield 'duplicate stop id' => [fn (array &$d) => $d['days'][0]['stops'][1]['id'] = 's1', 'stops holds the same id twice'];
        yield 'duplicate point id across routes' => [function (array &$d): void {
            $d['days'][0]['routes'][] = TripFixture::route('r2', [[1, 1]]);
            $d['days'][0]['routes'][1]['points'][0]['id'] = 'r1-0';
        }, "routes' points hold the same id twice"];
        yield 'stop bound to an unknown point' => [fn (array &$d) => $d['days'][0]['stops'][0]['pointId'] = 'nowhere', 'names no route point'];
        yield 'bound stop away from its point' => [fn (array &$d) => $d['days'][0]['stops'][0]['lngLat'] = [11.5, 48.11], 'must stand at its route point'];
        yield 'bad arrival time' => [fn (array &$d) => $d['days'][0]['stops'][0]['arriveAt'] = '25:00', 'arriveAt'];
        yield 'negative pause' => [fn (array &$d) => $d['days'][0]['stops'][0]['pauseMinutes'] = -5, 'pauseMinutes'];
        yield 'unknown profile' => [fn (array &$d) => $d['days'][0]['routes'][0]['profile'] = 'horse', 'profile must be one of'];
        yield 'unknown motorway dial' => [fn (array &$d) => $d['days'][0]['routes'][0]['highways'] = 'love', 'highways must be one of'];
        yield 'legs as a list' => [fn (array &$d) => $d['days'][0]['routes'][0]['legs'] = ['abc'], 'legs must be an object'];
        yield 'leg without distance' => [fn (array &$d) => $d['days'][0]['routes'][0]['legs'] = ['k' => ['geometry' => 'abc', 'durationS' => null]], 'legs must map'];
        yield 'leg with a duration that is no number' => [fn (array &$d) => $d['days'][0]['routes'][0]['legs'] = ['k' => ['geometry' => 'abc', 'distanceM' => 1, 'durationS' => 'soon']], 'legs must map'];
        yield 'not an object' => [fn (array &$d) => $d['days'][0] = 'monday', 'days[0] must be an object'];
    }
}
