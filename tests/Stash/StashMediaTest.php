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

    /** Keeps what is given as a media file of the file, from a file on disk as an upload is one. */
    private function keep(string $name, string $content, string $type = 'application/pdf', ?int $fileId = null, ?int $userId = null): ?array
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'planner-media-');
        file_put_contents($path, $content);
        try {
            return $this->media->keep($userId ?? $this->userId, $fileId ?? $this->fileId, ['name' => $name, 'mediaType' => $type, 'size' => strlen($content)], $path, $this->now);
        } finally {
            unlink($path);
        }
    }

    /** A JPEG of the size given, as a camera would write it. */
    private static function jpeg(int $width, int $height): string
    {
        ob_start();
        imagejpeg(imagecreatetruecolor($width, $height));
        return (string) ob_get_clean();
    }

    public function testKeepsMediaWithAFileAndListsThemWithItByName(): void
    {
        $photo = $this->keep('Photo 2.jpg', self::jpeg(80, 60), 'image/jpeg');
        self::assertTrue($photo['added']);
        self::assertSame(['name' => 'Photo 2.jpg', 'mediaType' => 'image/jpeg', 'image' => true], array_diff_key($photo['media'], ['id' => 0, 'size' => 0]));
        $this->keep('photo 1.jpg', self::jpeg(60, 80), 'image/jpeg');
        $this->keep('Roadbook.pdf', '%PDF');
        $listed = $this->files->listFor($this->userId)[0]['media'];
        self::assertSame(['photo 1.jpg', 'Photo 2.jpg', 'Roadbook.pdf'], array_column($listed, 'name'));
        self::assertSame([true, true, false], array_column($listed, 'image'));
        self::assertSame($listed, $this->files->find($this->userId, $this->fileId)['media']);
    }

    public function testAFileHasNoMediaFileTwiceButAnotherFileMayHaveTheSame(): void
    {
        $first = $this->keep('Roadbook.pdf', 'the same');
        $again = $this->keep('Roadbook again.pdf', 'the same');
        self::assertFalse($again['added']);
        self::assertSame($first['media'], $again['media']);
        $other = $this->files->keep($this->userId, $this->stash, 'Another', (string) gzencode(StashFixture::gpx('Another route')), $this->now)['file']['id'];
        self::assertTrue($this->keep('Roadbook.pdf', 'the same', fileId: $other)['added']);
    }

    public function testGivesAMediaFileBackAsItWasKeptAndAnImageWithASmallPreview(): void
    {
        $bytes = self::jpeg(1200, 900);
        $id = $this->keep('Photo.jpg', $bytes, 'image/jpeg')['media']['id'];
        self::assertSame(['name' => 'Photo.jpg', 'mediaType' => 'image/jpeg', 'content' => $bytes], $this->media->content($this->userId, $this->fileId, $id));
        self::assertSame([400, 300], array_slice((array) getimagesizefromstring((string) $this->media->preview($this->userId, $this->fileId, $id)), 0, 2));
        $pdf = $this->keep('Roadbook.pdf', '%PDF')['media']['id'];
        self::assertNull($this->media->preview($this->userId, $this->fileId, $pdf));
        // An image that cannot be read is kept as a file like any other.
        self::assertFalse($this->keep('Broken.jpg', 'no image', 'image/jpeg')['media']['image']);
    }

    public function testOnlyTheUsersOwnMediaAreKeptReadAndDeleted(): void
    {
        $other = (new Users($this->db))->create('other@example.com', 'correct horse battery', $this->now)->id;
        $id = $this->keep('Roadbook.pdf', 'mine')['media']['id'];
        self::assertNull($this->keep('x.pdf', 'x', userId: $other));
        self::assertNull($this->media->content($other, $this->fileId, $id));
        self::assertNull($this->media->preview($other, $this->fileId, $id));
        self::assertFalse($this->media->delete($other, $this->fileId));
        self::assertNotNull($this->media->content($this->userId, $this->fileId, $id));
    }

    public function testDeletesAllTheMediaOfAFile(): void
    {
        $this->keep('1.pdf', 'one');
        $this->keep('2.pdf', 'two');
        self::assertSame(['1.pdf', '2.pdf'], array_column($this->media->of($this->fileId), 'name'));
        self::assertTrue($this->media->delete($this->userId, $this->fileId));
        self::assertSame([], $this->media->of($this->fileId));
        self::assertFalse($this->media->delete($this->userId, $this->fileId));
    }

    public function testMediaGoWithTheirFileWhenItOrItsFolderIsDeleted(): void
    {
        $folder = $this->folders->create($this->userId, '2025', $this->stash, $this->now)->id;
        $inFolder = $this->files->keep($this->userId, $folder, 'Another', (string) gzencode(StashFixture::gpx('Another route')), $this->now)['file']['id'];
        $this->keep('1.pdf', 'one');
        $this->keep('2.pdf', 'two', fileId: $inFolder);
        self::assertTrue($this->files->delete($this->userId, $this->fileId));
        self::assertNotNull($this->folders->deleteWithContents($this->userId, $folder));
        self::assertSame(0, (int) $this->db->query('SELECT count(*) FROM stash_media')->fetchColumn());
    }
}
