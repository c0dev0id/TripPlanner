<?php

declare(strict_types=1);

namespace Planner\Tests\Journal;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Journal\Entries;
use Planner\Journal\Exif;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;

final class EntriesTest extends TestCase
{
    private PDO $db;
    private Entries $entries;
    private TripDocuments $documents;
    private int $userId;
    private int $otherUserId;
    private int $tripId;
    private DateTimeImmutable $now;

    private const PHOTO = ['name' => 'IMG_1.jpg', 'mediaType' => 'image/jpeg', 'size' => 1234, 'takenAt' => null, 'lngLat' => null];

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-10-27T10:00:00Z');
        $users = new Users($this->db);
        $this->userId = $users->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->otherUserId = $users->create('other@example.com', 'correct horse battery', $this->now)->id;
        $this->tripId = (new Trips($this->db))->create($this->userId, 'Alps', $this->now)->id;
        $this->documents = new TripDocuments($this->db);
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated(TripFixture::document()), 1, $this->now);
        $this->entries = new Entries($this->db);
    }

    public function testAddsNotesAndFilesOnTheTripAndItsParts(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, [], 'Packed the bags.', null, $this->now);
        $photo = $this->entries->add($this->userId, $this->tripId, ['stopId' => 's2'], '', self::PHOTO, $this->now);
        self::assertSame([null, null, null, 'Packed the bags.', null], [$note->dayId, $note->stopId, $note->routeId, $note->text, $note->file]);
        self::assertSame(['s2', ['name' => 'IMG_1.jpg', 'mediaType' => 'image/jpeg', 'size' => 1234, 'image' => true]], [$photo->stopId, $photo->file]);
        self::assertSame([$note->id, $photo->id], array_map(fn ($e) => $e->id, $this->entries->listFor($this->userId, $this->tripId)));
        $heic = $this->entries->add($this->userId, $this->tripId, [], '', ['mediaType' => 'image/heic', 'name' => 'IMG_2.heic'] + self::PHOTO, $this->now);
        self::assertFalse($heic->file['image']);
        self::assertNull($this->entries->listFor($this->otherUserId, $this->tripId));
        self::assertNull($this->entries->add($this->otherUserId, $this->tripId, [], 'Mine', null, $this->now));
        self::assertNull($this->entries->add($this->userId, $this->tripId, ['dayId' => 'nope'], 'Nowhere', null, $this->now));
        self::assertNull($this->entries->find($this->userId, $this->tripId + 1, $note->id));
        self::assertSame('{"id":' . $note->id . ',"tripId":' . $this->tripId . ',"dayId":null,"stopId":null,"routeId":null,"text":"Packed the bags.","file":null,"takenAt":null,"lngLat":null,"createdAt":"2026-10-27T10:00:00Z"}', json_encode($note));
    }

    public function testPlacesAPhotoOnTheDayOfItsDate(): void
    {
        $taken = ['takenAt' => '2027-06-12T14:30:00', 'lngLat' => [11.45, 47.8]] + self::PHOTO;
        $placed = $this->entries->add($this->userId, $this->tripId, [], '', $taken, $this->now);
        self::assertSame(['day1', '2027-06-12T14:30:00', [11.45, 47.8]], [$placed->dayId, $placed->takenAt, $placed->lngLat]);
        $otherDay = ['takenAt' => '2027-06-20T09:00:00'] + self::PHOTO;
        self::assertNull($this->entries->add($this->userId, $this->tripId, [], '', $otherDay, $this->now)->dayId);
        $onStop = $this->entries->add($this->userId, $this->tripId, ['stopId' => 's1'], '', $taken, $this->now);
        self::assertSame(['s1', null], [$onStop->stopId, $onStop->dayId]);
    }

    public function testStandsAtTheSpotUnlessThePhotoKnowsBetter(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], 'Viewpoint', null, $this->now, [10.5, 47.5]);
        self::assertSame([10.5, 47.5], $note->lngLat);
        $located = ['lngLat' => [11.45, 47.8]] + self::PHOTO;
        self::assertSame([11.45, 47.8], $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], '', $located, $this->now, [10.5, 47.5])->lngLat);
        self::assertSame([10.5, 47.5], $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1'], '', self::PHOTO, $this->now, [10.5, 47.5])->lngLat);
    }

    public function testRefusesAnEntryOnTwoParts(): void
    {
        $this->expectException(\PDOException::class);
        $this->entries->add($this->userId, $this->tripId, ['dayId' => 'day1', 'stopId' => 's1'], 'Both', null, $this->now);
    }

    public function testEditsAndDeletesOnlyOwnEntries(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, [], 'Draft', null, $this->now);
        self::assertFalse($this->entries->updateText($this->otherUserId, $this->tripId, $note->id, 'Theirs'));
        self::assertTrue($this->entries->updateText($this->userId, $this->tripId, $note->id, 'Final'));
        self::assertSame('Final', $this->entries->find($this->userId, $this->tripId, $note->id)->text);
        self::assertNull($this->entries->delete($this->otherUserId, $this->tripId, $note->id));
        self::assertSame($note->id, $this->entries->delete($this->userId, $this->tripId, $note->id)->id);
        self::assertNull($this->entries->find($this->userId, $this->tripId, $note->id));
    }

    public function testStaysWithTheTripWhenItsPartGoes(): void
    {
        $onStop = $this->entries->add($this->userId, $this->tripId, ['stopId' => 's3'], 'Great cake', null, $this->now);
        $document = TripFixture::document();
        array_pop($document['days'][0]['stops']);
        $this->documents->save($this->userId, $this->tripId, TripDocumentValidator::validated($document), 2, $this->now);
        self::assertNull($this->entries->find($this->userId, $this->tripId, $onStop->id)->stopId);
        self::assertSame('Great cake', $this->entries->find($this->userId, $this->tripId, $onStop->id)->text);
    }

    public function testListsTheEntriesOfASharedTrip(): void
    {
        $note = $this->entries->add($this->userId, $this->tripId, [], 'Packed the bags.', null, $this->now);
        $trips = new Trips($this->db);
        self::assertNull($this->entries->listShared(str_repeat('0', 32)));
        $token = $trips->share($this->userId, $this->tripId);
        self::assertSame([$note->id], array_map(fn ($e) => $e->id, $this->entries->listShared($token)));
        self::assertSame($note->id, $this->entries->findShared($token, $note->id)->id);
        self::assertNull($this->entries->findShared($token, $note->id + 1));
        $trips->unshare($this->userId, $this->tripId);
        self::assertNull($this->entries->listShared($token));
    }

    public function testReadsTimeAndPositionFromExifData(): void
    {
        $data = [
            'EXIF' => ['DateTimeOriginal' => '2027:06:12 14:30:05'],
            'GPS' => ['GPSLatitudeRef' => 'N', 'GPSLatitude' => ['47/1', '48/1', '0/1'], 'GPSLongitudeRef' => 'E', 'GPSLongitude' => ['11/1', '27/1', '3600/100']],
        ];
        $read = Exif::fromData($data);
        self::assertSame('2027-06-12T14:30:05', $read['takenAt']);
        self::assertEqualsWithDelta(11.46, $read['lngLat'][0], 1e-9);
        self::assertEqualsWithDelta(47.8, $read['lngLat'][1], 1e-9);
        self::assertSame(['takenAt' => null, 'lngLat' => null], Exif::fromData([]));
        $south = $data;
        $south['GPS']['GPSLatitudeRef'] = 'S';
        self::assertLessThan(0, Exif::fromData($south)['lngLat'][1]);
        $broken = $data;
        $broken['GPS']['GPSLongitude'] = ['11/0', '27/1', '0/1'];
        self::assertNull(Exif::fromData($broken)['lngLat']);
    }
}
