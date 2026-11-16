<?php

declare(strict_types=1);

namespace Planner\Tests\Stash;

use DateTimeImmutable;
use PDO;
use PHPUnit\Framework\TestCase;
use Planner\Account\Users;
use Planner\Stash\StashFiles;
use Planner\Stash\StashMedia;
use Planner\Tests\TestDatabase;
use Planner\Trip\Folders;

final class StashMediaTest extends TestCase
{
    private PDO $db;
    private StashMedia $media;
    private StashFiles $files;
    private Folders $folders;
    private int $userId;
    private int $stash;
    private int $fileId;
    private DateTimeImmutable $now;

    protected function setUp(): void
    {
        $this->db = TestDatabase::create();
        $this->now = new DateTimeImmutable('2026-11-16T10:00:00Z');
        $this->userId = (new Users($this->db))->create('rider@example.com', 'correct horse battery', $this->now)->id;
        $this->folders = new Folders($this->db);
        $this->media = new StashMedia($this->db);
        $this->files = new StashFiles($this->db, $this->folders, $this->media);
        $this->stash = (int) $this->db->query("SELECT id FROM folders WHERE kind = 'collections' AND user_id = $this->userId")->fetchColumn();
        $this->fileId = $this->files->keep($this->userId, $this->stash, 'A day out', (string) gzencode(StashFixture::gpx()), $this->now)['file']['id'];
    }

    private function keep(string $name, string $content, string $type = 'image/jpeg', ?string $preview = 'small', ?int $fileId = null): ?array
    {
        return $this->media->keep($this->userId, $fileId ?? $this->fileId, ['name' => $name, 'mediaType' => $type, 'size' => strlen($content)], $content, $preview, $this->now);
    }

    public function testKeepsMediaWithAFileAndListsThemWithItByName(): void
    {
        $photo = $this->keep('Photo 2.jpg', 'second');
        self::assertTrue($photo['added']);
        self::assertSame(['name' => 'Photo 2.jpg', 'mediaType' => 'image/jpeg', 'size' => 6, 'image' => true], array_diff_key($photo['media'], ['id' => 0]));
        $this->keep('photo 1.jpg', 'first');
        $this->keep('Roadbook.pdf', '%PDF', 'application/pdf', null);
        $listed = $this->files->listFor($this->userId)[0]['media'];
        self::assertSame(['photo 1.jpg', 'Photo 2.jpg', 'Roadbook.pdf'], array_column($listed, 'name'));
        self::assertSame([true, true, false], array_column($listed, 'image'));
        self::assertSame($listed, $this->files->find($this->userId, $this->fileId)['media']);
    }

    public function testAFileHasNoMediaFileTwiceButAnotherFileMayHaveTheSame(): void
    {
        $first = $this->keep('Photo.jpg', 'the same');
        $again = $this->keep('Photo again.jpg', 'the same');
        self::assertFalse($again['added']);
        self::assertSame($first['media'], $again['media']);
        $other = $this->files->keep($this->userId, $this->stash, 'Another', (string) gzencode(StashFixture::gpx('Another route')), $this->now)['file']['id'];
        self::assertTrue($this->keep('Photo.jpg', 'the same', fileId: $other)['added']);
    }

    public function testGivesAMediaFileAndItsPreviewBackAsTheyWereKept(): void
    {
        $bytes = random_bytes(4096);
        $id = $this->keep('Photo.jpg', $bytes, preview: 'a small jpeg')['media']['id'];
        self::assertSame(['name' => 'Photo.jpg', 'mediaType' => 'image/jpeg', 'content' => $bytes], $this->media->content($this->userId, $this->fileId, $id));
        self::assertSame('a small jpeg', $this->media->preview($this->userId, $this->fileId, $id));
        $pdf = $this->keep('Roadbook.pdf', '%PDF', 'application/pdf', null)['media']['id'];
        self::assertNull($this->media->preview($this->userId, $this->fileId, $pdf));
    }

    public function testOnlyTheUsersOwnMediaAreKeptReadAndDeleted(): void
    {
        $other = (new Users($this->db))->create('other@example.com', 'correct horse battery', $this->now)->id;
        $id = $this->keep('Photo.jpg', 'mine')['media']['id'];
        self::assertNull($this->media->keep($other, $this->fileId, ['name' => 'x', 'mediaType' => 'image/jpeg', 'size' => 1], 'x', null, $this->now));
        self::assertNull($this->media->content($other, $this->fileId, $id));
        self::assertNull($this->media->preview($other, $this->fileId, $id));
        self::assertFalse($this->media->delete($other, $this->fileId, $id));
        self::assertFalse($this->media->delete($other, $this->fileId, null));
        self::assertNotNull($this->media->content($this->userId, $this->fileId, $id));
    }

    public function testDeletesOneMediaFileOrAllOfAFile(): void
    {
        $one = $this->keep('1.jpg', 'one')['media']['id'];
        $this->keep('2.jpg', 'two');
        $this->keep('3.jpg', 'three');
        self::assertTrue($this->media->delete($this->userId, $this->fileId, $one));
        self::assertFalse($this->media->delete($this->userId, $this->fileId, $one));
        self::assertSame(['2.jpg', '3.jpg'], array_column($this->media->of($this->fileId), 'name'));
        self::assertTrue($this->media->delete($this->userId, $this->fileId, null));
        self::assertSame([], $this->media->of($this->fileId));
        self::assertFalse($this->media->delete($this->userId, $this->fileId, null));
    }

    public function testMediaGoWithTheirFileWhenItOrItsFolderIsDeleted(): void
    {
        $folder = $this->folders->create($this->userId, '2025', $this->stash, $this->now)->id;
        $inFolder = $this->files->keep($this->userId, $folder, 'Another', (string) gzencode(StashFixture::gpx('Another route')), $this->now)['file']['id'];
        $this->keep('1.jpg', 'one');
        $this->keep('2.jpg', 'two', fileId: $inFolder);
        self::assertTrue($this->files->delete($this->userId, $this->fileId));
        self::assertNotNull($this->folders->deleteWithContents($this->userId, $folder));
        self::assertSame(0, (int) $this->db->query('SELECT count(*) FROM stash_media')->fetchColumn());
    }
}
