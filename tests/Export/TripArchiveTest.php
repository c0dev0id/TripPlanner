<?php

declare(strict_types=1);

namespace Planner\Tests\Export;

use DateTimeImmutable;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Export\TripArchive;
use Planner\Journal\Entries;
use Planner\Journal\FileStore;
use Planner\Recording\Recordings;
use Planner\Tests\TestDatabase;
use Planner\Tests\Trip\TripFixture;
use Planner\Trip\Folders;
use Planner\Trip\TripDocuments;
use Planner\Trip\TripDocumentValidator;
use Planner\Trip\Trips;
use ZipArchive;

final class TripArchiveTest extends TestCase
{
    private string $dir;
    private string $zip;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/archive-' . bin2hex(random_bytes(4));
        $this->zip = "$this->dir.zip";
    }

    protected function tearDown(): void
    {
        array_map('unlink', [...glob("$this->dir/*/*"), ...glob($this->zip)]);
        array_map('rmdir', [...glob("$this->dir/*"), ...glob($this->dir)]);
    }

    public function testWritesTheUsersTripsWithTheirJournalFilesAndRecordings(): void
    {
        $db = TestDatabase::create();
        $now = new DateTimeImmutable('2026-11-11T10:00:00Z');
        $users = new Users($db);
        $userId = $users->create('rider@example.com', 'correct horse battery', $now)->id;
        $otherId = $users->create('other@example.com', 'correct horse battery', $now)->id;
        $trips = new Trips($db, new Folders($db));
        $documents = new TripDocuments($db);
        $entries = new Entries($db);
        $recordings = new Recordings($db);
        $files = new FileStore($this->dir);

        $tripId = $trips->create($userId, 'Alps', $now)->id;
        $document = TripDocumentValidator::validated(TripFixture::document());
        $documents->save($userId, $tripId, $document, 1, $now);
        $dayId = $document['days'][0]['id'];
        $photo = $entries->add($userId, $tripId, ['dayId' => $dayId], 'At the pass', ['name' => 'pass höhe.jpg', 'mediaType' => 'image/jpeg', 'size' => 5], $now);
        mkdir("$this->dir/$tripId", 0750, true);
        file_put_contents($files->path($tripId, $photo->id), 'photo');
        $entries->add($userId, $tripId, [], 'A note', null, $now);
        $ticket = $entries->addMedia($userId, $tripId, $dayId, 'Ferry', ['name' => 'ferry.pdf', 'mediaType' => 'application/pdf', 'size' => 3], null, $now);
        file_put_contents($files->path($tripId, $ticket->id), 'pdf');
        $entries->addMedia($userId, $tripId, $dayId, 'Hotel', null, 'https://example.org/hotel', $now);
        $recording = $recordings->keep($userId, 'Morning ride', gzencode('<gpx><trk/></gpx>'), $now, $dayId)['recording'];
        $sameName = $trips->create($userId, 'Alps', $now)->id;
        $foreign = $trips->create($otherId, 'Theirs', $now)->id;

        $names = (new TripArchive($documents, $entries, $files, $recordings))->write($this->zip, $userId, [$tripId, $sameName, $foreign], $now);

        self::assertSame(['Alps', 'Alps'], $names);
        $zip = new ZipArchive();
        $zip->open($this->zip);
        $archive = json_decode($zip->getFromName('Alps/trip.json'), true);
        self::assertSame(['trip-planner', 'Alps', 'A weekend.'], [$archive['format'], $archive['trip']['name'], $archive['trip']['description']]);
        self::assertSame($document['days'][0]['routes'][0]['points'], $archive['trip']['days'][0]['routes'][0]['points']);
        $path = "journal/$photo->id-pass-höhe.jpg";
        self::assertSame([$dayId, 'At the pass', $path, 'pass höhe.jpg', '2026-11-11T10:00:00Z'], [$archive['journal'][0]['dayId'], $archive['journal'][0]['text'], $archive['journal'][0]['file'], $archive['journal'][0]['fileName'], $archive['journal'][0]['createdAt']]);
        self::assertNull($archive['journal'][1]['file']);
        self::assertCount(2, $archive['journal']);
        self::assertSame([
            ['dayId' => $dayId, 'name' => 'Ferry', 'url' => null, 'file' => "media/$ticket->id-ferry.pdf", 'fileName' => 'ferry.pdf'],
            ['dayId' => $dayId, 'name' => 'Hotel', 'url' => 'https://example.org/hotel', 'file' => null, 'fileName' => null],
        ], $archive['media']);
        self::assertSame('pdf', $zip->getFromName("Alps/media/$ticket->id-ferry.pdf"));
        self::assertSame('photo', $zip->getFromName("Alps/$path"));
        self::assertSame([['dayId' => $dayId, 'name' => 'Morning ride', 'file' => "recordings/$recording->id-Morning-ride.gpx"]], $archive['recordings']);
        self::assertSame('<gpx><trk/></gpx>', $zip->getFromName("Alps/recordings/$recording->id-Morning-ride.gpx"));
        $names = array_map($zip->getNameIndex(...), range(0, $zip->numFiles - 1));
        self::assertSame(count($document['days']), count(preg_grep('#^Alps/[^/]+\.gpx$#', $names)));
        self::assertNotFalse($zip->locateName('Alps-2/trip.json'));
        self::assertFalse($zip->locateName('Theirs/trip.json'));
        $zip->close();
    }
}
