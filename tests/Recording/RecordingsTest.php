<?php

declare(strict_types=1);

namespace Planner\Tests\Recording;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Recording\Recordings;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\Folders;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;

final class RecordingsTest extends TestCase
{
    private PDO $db;
    private Recordings $recordings;
    private TripDocuments $documents;
    private Trips $trips;
    private int $userId;
    private int $tripId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-31T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->trips = new Trips($this->db, new Folders($this->db));
        $this->documents = new TripDocuments($this->db);
        $this->recordings = new Recordings($this->db);
        $this->tripId = $this->trips->create($this->userId, 'Alps', $this->now)->id;
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 1, $this->now);
    }

    public function testKeepsARecordingOnADayOfTheUsersTrip(): void
    {
        $gzip = gzencode('<gpx><trk/></gpx>');
        $recording = $this->recordings->add($this->userId, $this->tripId, 'day1', 'Morning ride', $gzip, $this->now);
        self::assertSame(['day1', 'Morning ride'], [$recording->dayId, $recording->name]);
        self::assertNull($this->recordings->add($this->userId + 1, $this->tripId, 'day1', 'Theirs', $gzip, $this->now));
        self::assertNull($this->recordings->add($this->userId, $this->tripId, 'no-such-day', 'Nowhere', $gzip, $this->now));
        self::assertSame($gzip, $this->recordings->gzip($this->userId, $this->tripId, $recording->id));
        self::assertNull($this->recordings->gzip($this->userId + 1, $this->tripId, $recording->id));

        self::assertTrue($this->recordings->rename($this->userId, $this->tripId, $recording->id, 'Ride to the pass'));
        self::assertFalse($this->recordings->rename($this->userId + 1, $this->tripId, $recording->id, 'Mine'));
        self::assertSame(['Ride to the pass'], array_map(fn ($r) => $r->name, $this->recordings->listFor($this->userId, $this->tripId)));
        self::assertNull($this->recordings->listFor($this->userId + 1, $this->tripId));

        self::assertFalse($this->recordings->delete($this->userId + 1, $this->tripId, $recording->id));
        self::assertTrue($this->recordings->delete($this->userId, $this->tripId, $recording->id));
        self::assertSame([], $this->recordings->listFor($this->userId, $this->tripId));
    }

    public function testGoesWithItsDayAndIsCopiedWithTheTrip(): void
    {
        $this->recordings->add($this->userId, $this->tripId, 'day1', 'Morning ride', gzencode('<gpx/>'), $this->now);
        $copyId = $this->documents->copy($this->userId, $this->tripId, $this->now);
        $copied = $this->recordings->listFor($this->userId, $copyId);
        self::assertSame(['Morning ride'], array_map(fn ($r) => $r->name, $copied));
        self::assertNotSame('day1', $copied[0]->dayId);

        $document = TripFixture::document();
        $document['days'] = [];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        self::assertSame([], $this->recordings->listFor($this->userId, $this->tripId));
        self::assertCount(1, $this->recordings->listFor($this->userId, $copyId));
    }

    public function testFollowsADayThatJoinsAnotherInAMerge(): void
    {
        $other = $this->trips->create($this->userId, 'Alps, again', $this->now)->id;
        $document = TripFixture::document();
        $document['days'] = [['date' => '2027-06-12'] + TripFixture::day('b1')];
        $this->documents->save($this->userId, $other, TripDocumentValidator::validated($document), 1, $this->now);
        $this->recordings->add($this->userId, $other, 'b1', 'Second file', gzencode('<gpx/>'), $this->now);
        $this->documents->merge($this->userId, $this->tripId, [$other], $this->now);
        self::assertSame([['day1', 'Second file']], array_map(fn ($r) => [$r->dayId, $r->name], $this->recordings->listFor($this->userId, $this->tripId)));
    }
}
