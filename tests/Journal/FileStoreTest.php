<?php

declare(strict_types=1);

namespace Planner\Tests\Journal;

use PHPUnit\Framework\TestCase;
use Planner\Journal\FileStore;
use Slim\Psr7\UploadedFile;

final class FileStoreTest extends TestCase
{
    private string $dir;
    private FileStore $files;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/planner-files-' . bin2hex(random_bytes(4));
        $this->files = new FileStore($this->dir);
    }

    protected function tearDown(): void
    {
        foreach ([7, 8] as $tripId) {
            $this->files->deleteAll($tripId);
        }
        if (is_dir($this->dir)) {
            rmdir($this->dir);
        }
    }

    public function testStoresAFileUnderItsTripMakesAPreviewOnceAndDeletesBoth(): void
    {
        $this->files->store($this->upload(self::jpeg(640, 480)), 7, 1);
        self::assertFileExists($this->files->path(7, 1));
        $preview = $this->files->preview(7, 1, 'image/jpeg');
        self::assertNotNull($preview);
        self::assertSame([400, 300], array_slice(getimagesize($preview), 0, 2));
        $made = filemtime($preview);
        self::assertSame($preview, $this->files->preview(7, 1, 'image/jpeg'));
        self::assertSame($made, filemtime($preview));
        $this->files->delete(7, 1);
        self::assertFileDoesNotExist($this->files->path(7, 1));
        self::assertFileDoesNotExist($preview);
    }

    public function testHasNoPreviewForAFileThatIsNoImageAndRemovesATripsFiles(): void
    {
        $this->files->store($this->upload('not an image'), 8, 2);
        self::assertNull($this->files->preview(8, 2, 'application/pdf'));
        self::assertNull($this->files->preview(8, 2, 'image/jpeg'));
        $this->files->deleteAll(8);
        self::assertDirectoryDoesNotExist("$this->dir/8");
        $this->files->deleteAll(9);
    }

    public function testMovesATripsFilesToAnother(): void
    {
        $this->files->store($this->upload(self::jpeg(64, 48)), 8, 3);
        $this->files->preview(8, 3, 'image/jpeg');
        $this->files->store($this->upload('kept'), 7, 4);
        $this->files->moveAll(8, 7);
        self::assertDirectoryDoesNotExist("$this->dir/8");
        self::assertSame(['3', '3.preview.jpg', '4'], array_values(array_diff(scandir("$this->dir/7"), ['.', '..'])));
        $this->files->moveAll(9, 7);
    }

    private function upload(string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'upload');
        file_put_contents($path, $content);
        return new UploadedFile($path, 'photo.jpg', 'image/jpeg', strlen($content));
    }

    private static function jpeg(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        ob_start();
        imagejpeg($image);
        return ob_get_clean();
    }
}
