<?php

declare(strict_types=1);

namespace Planner\Tests\Share;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Export\TripGpx;
use Planner\Journal\Entries;
use Planner\Share\Publications;
use Planner\Share\PublicTrip;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\Folders;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;

final class PublicTripTest extends TestCase
{
    private PDO $db;
    private Entries $entries;
    private Publications $publications;
    private TripDocuments $documents;
    private Trips $trips;
    private int $userId;
    private int $tripId;
    private DateTimeImmutable $now;

    private const PHOTO = ['name' => 'IMG_1.jpg', 'mediaType' => 'image/jpeg', 'size' => 1234, 'takenAt' => null, 'lngLat' => [11.45, 47.8]];

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-11-17T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->trips = new Trips($this->db, new Folders($this->db));
        $this->tripId = $this->trips->create($this->userId, 'Alps', $this->now)->id;
        $this->documents = new TripDocuments($this->db);
        $document = TripFixture::document();
        $document['days'][0]['stops'][1] = ['contact' => 'Ask for Maria, 0555 123', 'bookingReference' => 'XK-4471', 'address' => 'Dorfplatz 1', 'notes' => 'Garage for the bikes'] + $document['days'][0]['stops'][1];
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 1, $this->now);
        $this->entries = new Entries($this->db);
        $this->publications = new Publications($this->db);
    }

    public function testShowsThePlanAloneUntilTheJournalIsPublished(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, [], 'Packed the bags.', null, $this->now);
        $photo = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], '', self::PHOTO, $this->now);
        $ticket = $this->entries->addMedia($this->userId, $this->tripId, 'day1', '', ['name' => 'ferry.pdf', 'mediaType' => 'application/pdf', 'size' => 99], null, $this->now);
        self::assertSame(['token' => null, 'journal' => false, 'gpx' => true, 'coverEntryId' => null, 'hiddenRouteIds' => []], $this->publications->of($this->userId, $this->tripId));
        self::assertNull($this->publications->of($this->userId + 1, $this->tripId));
        self::assertNull($this->publications->shared(str_repeat('0', 32)));
        self::assertSame([], $this->entries->listShared(str_repeat('0', 32)));

        $token = $this->trips->share($this->userId, $this->tripId);
        self::assertSame(['name' => 'Alps', 'description' => 'A weekend.', 'journal' => false, 'gpx' => true, 'coverEntryId' => null], $this->publications->shared($token));
        self::assertSame([], $this->entries->listShared($token));
        self::assertNull($this->entries->findShared($token, $photo->id));

        self::assertFalse($this->publications->set($this->userId + 1, $this->tripId, true, true, null, []));
        self::assertTrue($this->publications->set($this->userId, $this->tripId, false, false, $photo->id, []));
        self::assertSame(['token' => $token, 'journal' => false, 'gpx' => false, 'coverEntryId' => $photo->id, 'hiddenRouteIds' => []], $this->publications->of($this->userId, $this->tripId));
        self::assertSame($photo->id, $this->entries->findShared($token, $photo->id)->id);
        self::assertNull($this->entries->findShared($token, $note->id));
        self::assertSame([], $this->entries->listShared($token));

        self::assertTrue($this->publications->set($this->userId, $this->tripId, true, true, $photo->id, []));
        self::assertSame([$note->id, $photo->id], array_map(fn ($e) => $e->id, $this->entries->listShared($token)));
        self::assertSame($note->id, $this->entries->findShared($token, $note->id)->id);
        self::assertNull($this->entries->findShared($token, $ticket->id));
        self::assertNull($this->entries->findShared(str_repeat('0', 32), $note->id));

        $this->entries->delete($this->userId, $this->tripId, $photo->id);
        self::assertNull($this->publications->of($this->userId, $this->tripId)['coverEntryId']);
        $this->trips->unshare($this->userId, $this->tripId);
        self::assertSame([], $this->entries->listShared($token));
        self::assertNull($this->entries->findShared($token, $note->id));
    }

    public function testLeavesOutWhatIsTheOwnersAlone(): void
    {
        $token = $this->trips->share($this->userId, $this->tripId);
        $public = PublicTrip::document($this->documents->loadShared($token), $this->publications->shared($token), $this->publications->hiddenRouteIds($this->tripId));
        $hotel = $public['days'][0]['stops'][1];
        self::assertSame(['Hotel Post', 'Dorfplatz 1', 'Garage for the bikes', '', ''], [$hotel['name'], $hotel['address'], $hotel['notes'], $hotel['contact'], $hotel['bookingReference']]);
        self::assertSame(['journal' => false, 'gpx' => true, 'coverEntryId' => null], $public['public']);
        self::assertSame(['r1'], array_column($public['days'][0]['routes'], 'id'));
        foreach ([json_encode($public), TripGpx::trip($public, $this->now)] as $given) {
            self::assertStringNotContainsString('Maria', $given);
            self::assertStringNotContainsString('XK-4471', $given);
        }
        self::assertStringContainsString('Maria', json_encode($this->documents->load($this->userId, $this->tripId)));

        $photo = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], '', self::PHOTO, $this->now);
        $this->entries->place($this->userId, $this->tripId, $photo->id, [10.5, 47.5]);
        $entry = PublicTrip::entry($this->entries->find($this->userId, $this->tripId, $photo->id));
        self::assertSame([[10.5, 47.5], null, 'IMG_1.jpg'], [$entry['lngLat'], $entry['takenLngLat'], $entry['file']['name']]);
        self::assertStringNotContainsString('11.45', json_encode($entry));
        self::assertArrayNotHasKey('tripId', $entry);
        // What a stop comes to have is not a visitor's until it is let through.
        $document = $this->documents->loadShared($token);
        $document['days'][0]['stops'][0]['doorCode'] = '4711';
        self::assertStringNotContainsString('4711', json_encode(PublicTrip::document($document, $this->publications->shared($token), [])));
    }

    public function testLeavesOutTheRoutesThePageDoesNotHaveWithTheirStops(): void
    {
        $document = TripFixture::document();
        $document['days'][0]['routes'][] = ['name' => 'In the rain'] + TripFixture::route('r2', [[11.5, 48.1], [11.6, 47.9]]);
        $document['days'][0]['stops'][] = TripFixture::stop('s4', 'Shelter', [11.6, 47.9], 'r2-1');
        $document['days'][0]['stops'][] = TripFixture::stop('s5', 'Shelter beside', [11.55, 48.0], null, null, 'r2');
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        $token = $this->trips->share($this->userId, $this->tripId);
        $public = fn () => PublicTrip::document($this->documents->loadShared($token), $this->publications->shared($token), $this->publications->hiddenRouteIds($this->tripId));
        self::assertSame([['r1', 'r2'], ['s1', 's2', 's3', 's4', 's5']], [array_column($public()['days'][0]['routes'], 'id'), array_column($public()['days'][0]['stops'], 'id')]);

        self::assertTrue($this->publications->set($this->userId, $this->tripId, false, true, null, ['r2', 'of another trip']));
        self::assertSame(['r2'], $this->publications->of($this->userId, $this->tripId)['hiddenRouteIds']);
        self::assertSame([['r1'], ['s1', 's2', 's3']], [array_column($public()['days'][0]['routes'], 'id'), array_column($public()['days'][0]['stops'], 'id')]);
        self::assertArrayNotHasKey('hiddenRouteIds', $public()['public']);
        self::assertStringNotContainsString('Shelter', TripGpx::day($public(), 0, $this->now, routeIds: ['r1']));
        self::assertSame(['r1', 'r2'], array_column($this->documents->load($this->userId, $this->tripId)['days'][0]['routes'], 'id'));

        // A save of the trip leaves what the page has as it is.
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(['name' => 'Alps again'] + $document), 3, $this->now);
        self::assertSame(['r2'], $this->publications->of($this->userId, $this->tripId)['hiddenRouteIds']);
        self::assertTrue($this->publications->set($this->userId, $this->tripId, false, true, null, []));
        self::assertSame(['r1', 'r2'], array_column($public()['days'][0]['routes'], 'id'));
    }

    public function testNamesTheFileOfARouteAfterItsDayAndWhereTheDayHasOthersAfterItself(): void
    {
        $document = TripFixture::document();
        self::assertSame(TripGpx::dayFileName($document, 0), TripGpx::routeFileName($document, 0, 'r1'));
        $document['days'][0]['routes'][] = ['name' => 'In the rain'] + TripFixture::route('r2', [[11.5, 48.1], [11.6, 47.9]]);
        self::assertSame(TripGpx::dayFileName($document, 0) . '-Route-1', TripGpx::routeFileName($document, 0, 'r1'));
        self::assertSame(TripGpx::dayFileName($document, 0) . '-In-the-rain', TripGpx::routeFileName($document, 0, 'r2'));
    }
}
