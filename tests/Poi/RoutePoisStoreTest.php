<?php

declare(strict_types=1);

namespace Planner\Tests\Poi;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Poi\RoutePoisStore;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\Folders;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;

final class RoutePoisStoreTest extends TestCase
{
    private const FUEL = [['id' => 'node/1', 'lngLat' => [11.45, 47.8], 'tags' => ['amenity' => 'fuel', 'brand' => 'Aral']]];

    private PDO $db;
    private RoutePoisStore $store;
    private TripDocuments $documents;
    private int $userId;
    private int $tripId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-11-11T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->documents = new TripDocuments($this->db);
        $this->store = new RoutePoisStore($this->db);
        $this->tripId = (new Trips($this->db, new Folders($this->db)))->create($this->userId, 'Alps', $this->now)->id;
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 1, $this->now);
    }

    public function testKeepsWhatWasFoundForARouteAndKindAndListsItWithTheTrip(): void
    {
        self::assertTrue($this->store->keep($this->userId, $this->tripId, 'r1', 'fuel', 200, '3:98000', self::FUEL, $this->now));
        self::assertTrue($this->store->keep($this->userId, $this->tripId, 'r1', 'hotel', 5000, '3:98000', [], $this->now));
        $found = $this->store->listFor($this->userId, $this->tripId);
        self::assertSame(['fuel', 'hotel'], array_map(fn ($pois) => $pois->category, $found));
        self::assertSame('r1', $found[0]->routeId);
        self::assertSame(200, $found[0]->reachM);
        self::assertSame('3:98000', $found[0]->lineMark);
        self::assertSame(self::FUEL, $found[0]->places);
        self::assertSame([], $found[1]->places);
    }

    public function testASearchAgainReplacesWhatWasKept(): void
    {
        $this->store->keep($this->userId, $this->tripId, 'r1', 'fuel', 200, 'old', self::FUEL, $this->now);
        $this->store->keep($this->userId, $this->tripId, 'r1', 'fuel', 500, 'new', [], $this->now->modify('+1 day'));
        $found = $this->store->listFor($this->userId, $this->tripId);
        self::assertCount(1, $found);
        self::assertSame([500, 'new', []], [$found[0]->reachM, $found[0]->lineMark, $found[0]->places]);
        self::assertStringStartsWith('2026-11-12', $found[0]->foundAt);
    }

    public function testASavedTripKeepsItsPlacesAndARemovedRouteTakesThemWithIt(): void
    {
        $this->store->keep($this->userId, $this->tripId, 'r1', 'fuel', 200, 'mark', self::FUEL, $this->now);
        $document = TripFixture::document();
        $document['name'] = 'Alps again';
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        self::assertCount(1, $this->store->listFor($this->userId, $this->tripId));
        $document['days'][0]['routes'] = [];
        $document['days'][0]['stops'] = [];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 3, $this->now);
        self::assertSame([], $this->store->listFor($this->userId, $this->tripId));
    }

    public function testForgetsWhatIsKeptAndOnlyThat(): void
    {
        $this->store->keep($this->userId, $this->tripId, 'r1', 'fuel', 200, 'mark', self::FUEL, $this->now);
        self::assertFalse($this->store->forget($this->userId, $this->tripId, 'r1', 'hotel'));
        self::assertTrue($this->store->forget($this->userId, $this->tripId, 'r1', 'fuel'));
        self::assertSame([], $this->store->listFor($this->userId, $this->tripId));
    }

    public function testAnotherUserNeitherSeesNorChangesIt(): void
    {
        $other = (new Users($this->db))->create('other@example.com', 'correct horse battery', $this->now)->id;
        $this->store->keep($this->userId, $this->tripId, 'r1', 'fuel', 200, 'mark', self::FUEL, $this->now);
        self::assertNull($this->store->listFor($other, $this->tripId));
        self::assertFalse($this->store->keep($other, $this->tripId, 'r1', 'fuel', 200, 'mark', [], $this->now));
        self::assertFalse($this->store->forget($other, $this->tripId, 'r1', 'fuel'));
        self::assertFalse($this->store->keep($this->userId, $this->tripId, 'no-such-route', 'fuel', 200, 'mark', [], $this->now));
        self::assertCount(1, $this->store->listFor($this->userId, $this->tripId));
    }
}
