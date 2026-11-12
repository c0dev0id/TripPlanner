<?php

declare(strict_types=1);

namespace Planner\Tests\Trip;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Journal\Entries;
use Planner\Tests\TestDatabase;
use Planner\Trip\InvalidDocument;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Folders;
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
        $this->trips = new Trips($this->db, new Folders($this->db));
        $this->tripId = $this->trips->create($this->userId, 'Alps', $this->now)->id;
        $this->documents = new TripDocuments($this->db);
    }

    private function save(array $document, int $version, ?int $tripId = null): ?int
    {
        return $this->documents->save($this->userId, $tripId ?? $this->tripId, $document, $version, $this->now);
    }

    public function testLoadsANewTripAsAnEmptyDocument(): void
    {
        self::assertSame(
            ['id' => $this->tripId, 'kind' => 'trip', 'name' => 'Alps', 'description' => '', 'state' => 'planned', 'version' => 1, 'days' => []],
            $this->documents->load($this->userId, $this->tripId),
        );
        self::assertNull($this->documents->load($this->userId + 1, $this->tripId));
    }

    public function testSavesAndLoadsADocumentUnchanged(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][0]['legs'] = ['motorcycle:allow/11.5,48.1;11.45,47.8' => ['geometry' => 'abc', 'distanceM' => 100, 'durationS' => 60]];
        $document['days'][0]['stops'][1]['arriveAt'] = '18:30';
        $document['days'][0]['stops'][1]['pauseMinutes'] = 0;
        $document['days'][0]['routes'][0]['color'] = '#1c7ed6';
        $document['days'][0]['routes'][] = TripFixture::track('t1');
        self::assertSame(2, $this->save($document, 1));
        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertSame(2, $loaded['version']);
        self::assertSame('A weekend.', $loaded['description']);
        $day = $loaded['days'][0];
        self::assertSame('2027-06-12', $day['date']);
        self::assertSame($document['days'][0]['stops'], $day['stops']);
        self::assertEquals($document['days'][0]['routes'][0]['points'], $day['routes'][0]['points']);
        self::assertEquals((object) $document['days'][0]['routes'][0]['legs'], $day['routes'][0]['legs']);
        self::assertSame('#1c7ed6', $day['routes'][0]['color']);
        self::assertSame(TripFixture::track('t1'), $day['routes'][1]);
    }

    public function testKeepsAnOutlineOfEachDayForTheUsersTrips(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][] = TripFixture::track('t1');
        $document['days'][] = TripFixture::day('empty');
        $this->save($document, 1);
        $outlines = $this->documents->outlines($this->userId);
        self::assertSame([$this->tripId], array_keys($outlines));
        $first = $outlines[$this->tripId][0];
        self::assertSame([$document['days'][0]['id'], $document['days'][0]['name'], '2027-06-12'], [$first['id'], $first['name'], $first['date']]);
        self::assertCount(count($document['days'][0]['routes']), $first['lines']);
        self::assertSame([2, 3], [$first['routes'], $first['stops']]);
        // The route's two legs as the crow flies, 89.3 km, and the track south of it, 23.5 km.
        self::assertSame(112_777, $first['distanceM']);
        self::assertSame(['id' => 'empty', 'name' => '', 'date' => null, 'routes' => 0, 'stops' => 0, 'distanceM' => 0, 'lines' => []], $outlines[$this->tripId][count($document['days']) - 1]);
        self::assertSame([], $this->documents->outlines($this->userId + 1));
    }

    public function testLoadsEmptyLegsAsAnObjectAndRoutesInOrder(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][] = TripFixture::route('r2', [[11.4, 47.3], [11.3, 47.2]]);
        $this->save($document, 1);
        $routes = $this->documents->load($this->userId, $this->tripId)['days'][0]['routes'];
        self::assertSame(['r1', 'r2'], array_column($routes, 'id'));
        self::assertSame('{}', json_encode($routes[0]['legs']));
    }

    public function testDeletesWhatTheDocumentNoLongerHolds(): void
    {
        $document = TripFixture::document();
        $document['days'][] = TripFixture::day('day2', [TripFixture::route('r2', [[1, 1], [2, 2]])], [TripFixture::stop('s4', 'There', [2, 2], 'r2-1')]);
        $this->save($document, 1);

        $smaller = TripFixture::document();
        unset($smaller['days'][0]['stops'][2]);
        $smaller['days'][0]['stops'] = array_values($smaller['days'][0]['stops']);
        $this->save($smaller, 2);
        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertCount(1, $loaded['days']);
        self::assertSame(['s1', 's2'], array_column($loaded['days'][0]['stops'], 'id'));
        self::assertSame(0, (int) $this->db->query("SELECT COUNT(*) FROM routes WHERE id = 'r2'")->fetchColumn());
        self::assertSame(0, (int) $this->db->query("SELECT COUNT(*) FROM stops WHERE id IN ('s3', 's4')")->fetchColumn());
    }

    public function testKeepsWhatIsSentAsUnchanged(): void
    {
        $legs = ['motorcycle:allow/1,1;2,2' => ['geometry' => '_ibE_ibE_ibE_ibE', 'distanceM' => 100, 'durationS' => 60]];
        $document = TripFixture::document();
        $document['days'][0]['routes'][] = TripFixture::track('t1');
        $document['days'][] = TripFixture::day('day2', [TripFixture::route('r2', [[1, 1], [2, 2]], $legs)], [TripFixture::stop('s4', 'There', [2, 2], 'r2-1')]);
        $this->save($document, 1);
        $before = $this->documents->load($this->userId, $this->tripId);

        // The second day and the first day's routes as they are, the first day renamed and without its free stop.
        $delta = $document;
        $delta['days'][0]['name'] = 'Southwards';
        $delta['days'][0]['routes'] = [['id' => 'r1', 'unchanged' => true], ['id' => 't1', 'unchanged' => true]];
        array_pop($delta['days'][0]['stops']);
        $delta['days'][1] = ['id' => 'day2', 'unchanged' => true];
        self::assertSame(3, $this->save($delta, 2));

        $after = $this->documents->load($this->userId, $this->tripId);
        self::assertSame('Southwards', $after['days'][0]['name']);
        self::assertSame(['s1', 's2'], array_column($after['days'][0]['stops'], 'id'));
        self::assertEquals($before['days'][0]['routes'], $after['days'][0]['routes']);
        self::assertEquals($before['days'][1], $after['days'][1]);
    }

    public function testMovesARouteSentAsUnchangedToWhereItStands(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][] = TripFixture::track('t1');
        $document['days'][] = TripFixture::day('day2', [TripFixture::route('r2', [[1, 1], [2, 2]])]);
        $this->save($document, 1);

        // The days change places, and the track goes to the front of the other day.
        $first = ['routes' => [['id' => 'r1', 'unchanged' => true]]] + $document['days'][0];
        $second = ['routes' => [['id' => 't1', 'unchanged' => true], ['id' => 'r2', 'unchanged' => true]]] + $document['days'][1];
        $this->save(['days' => [$second, $first]] + $document, 2);

        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertSame(['day2', 'day1'], array_column($loaded['days'], 'id'));
        self::assertSame(['t1', 'r2'], array_column($loaded['days'][0]['routes'], 'id'));
        self::assertSame(['r1'], array_column($loaded['days'][1]['routes'], 'id'));
        self::assertSame(TripFixture::track('t1')['line'], $loaded['days'][0]['routes'][0]['line']);
    }

    public function testChecksAStopAgainstARouteSentAsUnchanged(): void
    {
        $document = TripFixture::document();
        $this->save($document, 1);
        $document['days'][0]['routes'] = [['id' => 'r1', 'unchanged' => true]];
        $document['days'][0]['stops'][2] = TripFixture::stop('s3', 'Halfway', [11.45, 47.8], 'r1-1');
        $this->save($document, 2);
        self::assertSame('r1-1', $this->documents->load($this->userId, $this->tripId)['days'][0]['stops'][2]['pointId']);

        $document['days'][0]['stops'][2]['pointId'] = 'r1-9';
        $this->expectException(InvalidDocument::class);
        $this->save($document, 3);
    }

    public function testRefusesAsUnchangedWhatTheTripDoesNotHold(): void
    {
        $other = $this->trips->create($this->userId, 'Vosges', $this->now)->id;
        $this->save(TripFixture::document(), 1);
        try {
            $this->save(['days' => [['id' => 'day1', 'unchanged' => true]]] + TripFixture::document(), 1, $other);
            self::fail('A day of another trip was taken as unchanged.');
        } catch (InvalidDocument) {
        }
        $day = ['id' => 'day9', 'routes' => [['id' => 'r1', 'unchanged' => true]], 'stops' => []] + TripFixture::document()['days'][0];
        $this->expectException(InvalidDocument::class);
        $this->save(['days' => [$day]] + TripFixture::document(), 1, $other);
    }

    public function testMovesAStopToAnotherDay(): void
    {
        $document = TripFixture::document();
        $document['days'][] = TripFixture::day('day2');
        $this->save($document, 1);
        $free = $document['days'][0]['stops'][2];
        unset($document['days'][0]['stops'][2]);
        $document['days'][0]['stops'] = array_values($document['days'][0]['stops']);
        $document['days'][1]['stops'] = [$free];
        $this->save($document, 2);
        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertSame(['s1', 's2'], array_column($loaded['days'][0]['stops'], 'id'));
        self::assertSame(['s3'], array_column($loaded['days'][1]['stops'], 'id'));
    }

    public function testKeepsTheStateAndTheOrderOfTheStops(): void
    {
        $document = TripFixture::document();
        $this->save($document, 1);
        $document['state'] = 'done';
        $document['days'][0]['stops'] = [$document['days'][0]['stops'][2], $document['days'][0]['stops'][0], $document['days'][0]['stops'][1]];
        $this->save($document, 2);
        $loaded = $this->documents->load($this->userId, $this->tripId);
        self::assertSame('done', $loaded['state']);
        self::assertSame(['s3', 's1', 's2'], array_column($loaded['days'][0]['stops'], 'id'));
        self::assertSame('done', $this->trips->listFor($this->userId)[0]->state);
        self::assertSame('planned', $this->documents->load($this->userId, $this->documents->copy($this->userId, $this->tripId, $this->now))['state']);
    }

    public function testSharesATripUnderAToken(): void
    {
        $this->save(TripFixture::document(), 1);
        self::assertNull($this->trips->shareToken($this->userId, $this->tripId));
        self::assertNull($this->trips->share($this->userId + 1, $this->tripId));
        $token = $this->trips->share($this->userId, $this->tripId);
        self::assertMatchesRegularExpression('/^[0-9a-f]{32}$/', $token);
        self::assertSame($token, $this->trips->share($this->userId, $this->tripId));
        self::assertSame($token, $this->trips->shareToken($this->userId, $this->tripId));
        self::assertSame('Alps', $this->documents->loadShared($token)['name']);
        self::assertNull($this->documents->loadShared(strrev($token)));
        self::assertTrue($this->trips->unshare($this->userId, $this->tripId));
        self::assertNull($this->documents->loadShared($token));
        self::assertNull($this->trips->shareToken($this->userId, $this->tripId));
    }

    public function testRefusesToSaveOverANewerVersion(): void
    {
        $this->save(TripFixture::document(), 1);
        try {
            $this->save(TripFixture::document(), 1);
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

    public function testRefusesADocumentNamingPartsOfAnotherTrip(): void
    {
        $this->save(TripFixture::document(), 1);
        $other = $this->trips->create($this->userId, 'Other', $this->now)->id;
        $document = TripFixture::document();
        $document['days'][0]['id'] = 'd9';
        $document['days'][0]['routes'][0]['id'] = 'r9';
        // The stops keep the fixture's ids, which trip 1 holds.
        try {
            $this->save($document, 1, $other);
            self::fail('Stops of another trip were taken over.');
        } catch (InvalidDocument) {
        }
        self::assertSame(['s1', 's2', 's3'], array_column($this->documents->load($this->userId, $this->tripId)['days'][0]['stops'], 'id'));
        self::assertSame([], $this->documents->load($this->userId, $other)['days']);
    }

    public function testCopiesATripWithItsDaysUnderNewIds(): void
    {
        $this->save(TripFixture::document(), 1);
        self::assertNull($this->documents->copy($this->userId + 1, $this->tripId, $this->now));
        $copyId = $this->documents->copy($this->userId, $this->tripId, $this->now->modify('+1 hour'));
        self::assertNotNull($copyId);
        $copy = $this->documents->load($this->userId, $copyId);
        self::assertSame('Alps copy', $copy['name']);
        self::assertSame('A weekend.', $copy['description']);
        self::assertCount(1, $copy['days']);
        self::assertNotSame('day1', $copy['days'][0]['id']);
        self::assertSame(['Home', 'Hotel Post', 'Café & Bar'], array_column($copy['days'][0]['stops'], 'name'));
        self::assertSame($copy['days'][0]['routes'][0]['points'][0]['id'], $copy['days'][0]['stops'][0]['pointId']);
        self::assertSame(['Alps copy', 'Alps'], array_map(fn ($t) => $t->name, $this->trips->listFor($this->userId)));
        self::assertSame(1, $this->trips->listFor($this->userId)[0]->dayCount);
    }

    public function testKeepsACollectionAsOneThroughListsLoadsAndCopies(): void
    {
        $id = $this->trips->create($this->userId, 'TET', $this->now, null, 'collection')->id;
        self::assertSame('collection', $this->documents->load($this->userId, $id)['kind']);
        $copyId = $this->documents->copy($this->userId, $id, $this->now);
        self::assertSame(['collection', 'collection', 'trip'], array_map(fn ($t) => $t->kind, $this->trips->listFor($this->userId)));
        self::assertSame('collection', $this->documents->load($this->userId, (int) $copyId)['kind']);
    }

    public function testListsTripsWithTheirDayCountAndDeletesThemWithTheirContent(): void
    {
        $this->save(TripFixture::document(), 1);
        $this->trips->create($this->userId, 'Later', $this->now->modify('+1 hour'));
        $list = $this->trips->listFor($this->userId);
        self::assertSame(['Later', 'Alps'], array_map(fn ($t) => $t->name, $list));
        self::assertSame([0, 1], array_map(fn ($t) => $t->dayCount, $list));
        self::assertSame('{"id":' . $this->tripId . ',"kind":"trip","name":"Alps","folderId":null,"state":"planned","startsOn":"2027-06-12","dayCount":1,"updatedAt":"2026-10-27T10:00:00Z"}', json_encode($list[1]));
        self::assertFalse($this->trips->delete($this->userId + 1, $this->tripId));
        self::assertTrue($this->trips->delete($this->userId, $this->tripId));
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM stops')->fetchColumn());
        self::assertSame(['Later'], array_map(fn ($t) => $t->name, $this->trips->listFor($this->userId)));
    }

    public function testMergesTripsWithTheirJournalUnderTheSameIds(): void
    {
        $this->save(TripFixture::document(), 1);
        $other = $this->trips->create($this->userId, 'Alps, day two', $this->now)->id;
        $document = TripFixture::document();
        $document['days'] = [
            ['date' => '2027-06-12', 'notes' => 'Second file'] + TripFixture::day('b1', [TripFixture::route('br', [[11.4, 47.3], [11.3, 47.1]])], [TripFixture::stop('bs', 'Pass', [11.4, 47.3], 'br-0')]),
            ['date' => '2027-06-13'] + TripFixture::day('b2'),
        ];
        $this->save($document, 1, $other);
        $entries = new Entries($this->db);
        $onDay = $entries->add($this->userId, $other, ['dayId' => 'b1'], 'Rain', null, $this->now);
        $onStop = $entries->add($this->userId, $other, ['stopId' => 'bs'], 'View', null, $this->now);
        $onTrip = $entries->add($this->userId, $other, [], 'Packed', null, $this->now);

        self::assertNull($this->documents->merge($this->userId + 1, $this->tripId, [$other], $this->now));
        self::assertSame(3, $this->documents->merge($this->userId, $this->tripId, [$other], $this->now));
        $merged = $this->documents->load($this->userId, $this->tripId);
        self::assertSame(['day1', 'b2'], array_column($merged['days'], 'id'));
        self::assertSame(['r1', 'br'], array_column($merged['days'][0]['routes'], 'id'));
        self::assertSame(['s1', 's2', 's3', 'bs'], array_column($merged['days'][0]['stops'], 'id'));
        self::assertSame('Second file', $merged['days'][0]['notes']);
        self::assertNull($this->documents->load($this->userId, $other));
        $moved = array_map(fn ($e) => [$e->id, $e->tripId, $e->dayId, $e->stopId], $entries->listFor($this->userId, $this->tripId));
        self::assertEqualsCanonicalizing([[$onDay->id, $this->tripId, 'day1', null], [$onStop->id, $this->tripId, null, 'bs'], [$onTrip->id, $this->tripId, null, null]], $moved);
    }

    public function testMergesOnlyTripsOfOneKind(): void
    {
        $collection = $this->trips->create($this->userId, 'TET', $this->now, null, 'collection')->id;
        try {
            $this->documents->merge($this->userId, $this->tripId, [$collection], $this->now);
            self::fail('merged a collection into a trip');
        } catch (InvalidDocument) {
        }
        self::assertNotNull($this->documents->load($this->userId, $collection));
    }
}
