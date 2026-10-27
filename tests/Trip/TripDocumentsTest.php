<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Tests\TestDatabase;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;
use Planner\Trip\VersionConflict;

final class TripDocumentsTest extends TestCase
{
    private PDO $db;
    private TripDocuments $documents;
    private Trips $trips;
    private int $userId;
    private int $tripId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-27T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->trips = new Trips($this->db);
        $this->tripId = $this->trips->create($this->userId, 'Alps', $this->now)->id;
        $this->documents = new TripDocuments($this->db);
    }

    public function testLoadsANewTripAsAnEmptyDocument(): void
    {
        self::assertSame(
            ['id' => $this->tripId, 'name' => 'Alps', 'description' => '', 'startsOn' => null, 'version' => 1, 'places' => [], 'days' => []],
            $this->documents->load($this->userId, $this->tripId),
        );
        self::assertNull($this->documents->load($this->userId + 1, $this->tripId));
    }

    public function testSavesAndLoadsADocumentUnchanged(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][0]['legs'] = ['car/11.5,48.1;11.4,47.3' => ['geometry' => 'abc', 'distanceM' => 100, 'durationS' => 60]];
        $document['days'][0]['stops'][1]['arriveAt'] = '18:30';
        $document['days'][0]['stops'][1]['pauseMinutes'] = 0;
        $version = $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 1, $this->now);
        self::assertSame(2, $version);
        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertSame(2, $loaded['version']);
        self::assertSame('A weekend.', $loaded['description']);
        self::assertSame('2027-06-12', $loaded['startsOn']);
        self::assertEquals($document['places'], $loaded['places']);
        $day = $loaded['days'][0];
        self::assertSame($document['days'][0]['stops'], $day['stops']);
        self::assertEquals($document['days'][0]['routes'][0]['points'], $day['routes'][0]['points']);
        self::assertEquals((object) $document['days'][0]['routes'][0]['legs'], $day['routes'][0]['legs']);
        self::assertEquals(new \stdClass(), (object) []);
    }

    public function testLoadsEmptyLegsAsAnObject(): void
    {
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 1, $this->now);
        $legs = $this->documents->load($this->userId, $this->tripId)['days'][0]['routes'][0]['legs'];
        self::assertSame('{}', json_encode($legs));
    }

    public function testDeletesWhatTheDocumentNoLongerHolds(): void
    {
        $document = TripFixture::document();
        $document['places'][] = TripFixture::place('cafe', 'Cafe', [11.45, 47.8]);
        $document['days'][0]['stops'] = [TripFixture::stop('s1', 'home'), TripFixture::stop('s3', 'cafe'), TripFixture::stop('s2', 'hotel')];
        $document['days'][0]['routes'] = [TripFixture::route('r1', [11.5, 48.1], [11.45, 47.8]), TripFixture::route('r2', [11.45, 47.8], [11.4, 47.3])];
        $document['days'][] = ['id' => 'day2', 'name' => '', 'date' => null, 'notes' => '', 'stops' => [], 'routes' => []];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 1, $this->now);

        $smaller = TripFixture::document();
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($smaller), 2, $this->now);
        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertSame(['home', 'hotel'], array_column($loaded['places'], 'id'));
        self::assertCount(1, $loaded['days']);
        self::assertSame(['s1', 's2'], array_column($loaded['days'][0]['stops'], 'id'));
        self::assertSame(['r1'], array_column($loaded['days'][0]['routes'], 'id'));
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM routes WHERE id = \'r2\'')->fetchColumn());
    }

    public function testMovesAStopToAnotherDay(): void
    {
        $document = TripFixture::document();
        $document['days'][] = ['id' => 'day2', 'name' => '', 'date' => null, 'notes' => '', 'stops' => [], 'routes' => []];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 1, $this->now);
        $document['days'][1]['stops'] = [$document['days'][0]['stops'][1]];
        $document['days'][0]['stops'] = [$document['days'][0]['stops'][0]];
        $document['days'][0]['routes'] = [];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertSame(['s1'], array_column($loaded['days'][0]['stops'], 'id'));
        self::assertSame(['s2'], array_column($loaded['days'][1]['stops'], 'id'));
    }

    public function testRefusesToSaveOverANewerVersion(): void
    {
        $valid = TripDocumentValidator::validated(TripFixture::document());
        $this->documents->save($this->userId, $this->tripId, $valid, 1, $this->now);
        try {
            $this->documents->save($this->userId, $this->tripId, $valid, 1, $this->now);
            self::fail('A stale version was accepted.');
        } catch (VersionConflict $conflict) {
            self::assertSame(2, $conflict->currentVersion);
        }
        self::assertSame(2, $this->documents->load($this->userId, $this->tripId)['version']);
    }

    public function testSavesOnlyTheOwnersTrip(): void
    {
        $valid = TripDocumentValidator::validated(TripFixture::document());
        self::assertNull($this->documents->save($this->userId + 1, $this->tripId, $valid, 1, $this->now));
        self::assertSame([], $this->documents->load($this->userId, $this->tripId)['days']);
    }

    public function testListsTripsWithTheirDayCountAndDeletesThemWithTheirContent(): void
    {
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 1, $this->now);
        $other = $this->trips->create($this->userId, 'Later', $this->now->modify('+1 hour'));
        $list = $this->trips->listFor($this->userId);
        self::assertSame(['Later', 'Alps'], array_map(fn ($t) => $t->name, $list));
        self::assertSame([0, 1], array_map(fn ($t) => $t->dayCount, $list));
        self::assertTrue($this->trips->rename($this->userId, $other->id, 'Sooner', $this->now));
        self::assertFalse($this->trips->delete($this->userId + 1, $this->tripId));
        self::assertTrue($this->trips->delete($this->userId, $this->tripId));
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM stops')->fetchColumn());
        self::assertSame(['Sooner'], array_map(fn ($t) => $t->name, $this->trips->listFor($this->userId)));
    }
}
