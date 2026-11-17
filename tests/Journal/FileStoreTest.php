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

    public function testStoresAFileUnderItsTripMakesAnImageOnceAndDeletesBoth(): void
    {
        $this->files->store($this->upload(self::jpeg(640, 480)), 7, 1);
        self::assertFileExists($this->files->path(7, 1));
        $small = $this->files->image(7, 1, 'image/jpeg', 400);
        self::assertNotNull($small);
        self::assertSame([400, 300], array_slice(getimagesize($small), 0, 2));
        $made = filemtime($small);
        self::assertSame($small, $this->files->image(7, 1, 'image/jpeg', 400));
        self::assertSame($made, filemtime($small));
        $this->files->delete(7, 1);
        self::assertFileDoesNotExist($this->files->path(7, 1));
        self::assertFileDoesNotExist($small);
    }

    public function testMakesAnImageAtEverySizeNeverLargerThanItIsTurnedAndWithoutWhatTheCameraWrote(): void
    {
        $this->files->store($this->upload(self::jpeg(1600, 1200, 6)), 7, 1);
        self::assertNotFalse(exif_read_data($this->files->path(7, 1))['Orientation'] ?? false);
        $this->files->makeImages(7, 1, 'image/jpeg');
        self::assertSame(['1', '1.1280.jpg', '1.2048.jpg', '1.400.jpg'], array_values(array_diff(scandir("$this->dir/7"), ['.', '..'])));
        $sizes = array_map(fn (int $px) => array_slice(getimagesize($this->files->image(7, 1, 'image/jpeg', $px)), 0, 2), FileStore::SIZES);
        self::assertSame([[300, 400], [960, 1280], [1200, 1600]], $sizes);
        self::assertArrayNotHasKey('Orientation', (array) @exif_read_data($this->files->image(7, 1, 'image/jpeg', 2048)));
    }

    public function testHasNoImageForAFileThatIsNoneOrTooLargeAndRemovesATripsFiles(): void
    {
        $this->files->store($this->upload('not an image'), 8, 2);
        self::assertNull($this->files->image(8, 2, 'application/pdf', 400));
        self::assertNull($this->files->image(8, 2, 'image/jpeg', 400));
        // The head of a PNG of 6000 by 6000 pixels, which is all that is read of one too large.
        $ihdr = 'IHDR' . pack('NN', 6000, 6000) . "\x08\x02\0\0\0";
        $this->files->store($this->upload("\x89PNG\r\n\x1a\n" . pack('N', 13) . $ihdr . pack('N', crc32($ihdr))), 8, 3);
        self::assertSame([6000, 6000], FileStore::pixelsOf($this->files->path(8, 3), 'image/png'));
        self::assertNull($this->files->image(8, 3, 'image/png', 400));
        $this->files->deleteAll(8);
        self::assertDirectoryDoesNotExist("$this->dir/8");
        $this->files->deleteAll(9);
    }

    public function testMovesATripsFilesToAnother(): void
    {
        $this->files->store($this->upload(self::jpeg(64, 48)), 8, 3);
        $this->files->image(8, 3, 'image/jpeg', 400);
        $this->files->store($this->upload('kept'), 7, 4);
        $this->files->moveAll(8, 7);
        self::assertDirectoryDoesNotExist("$this->dir/8");
        self::assertSame(['3', '3.400.jpg', '4'], array_values(array_diff(scandir("$this->dir/7"), ['.', '..'])));
        $this->files->moveAll(9, 7);
    }

    public function testMovesAndCopiesAnEntrysFileWithItsImages(): void
    {
        $this->files->store($this->upload(self::jpeg(64, 48)), 8, 3);
        $this->files->image(8, 3, 'image/jpeg', 400);
        $this->files->copy(8, 3, 7, 5);
        self::assertSame(['5', '5.400.jpg'], array_values(array_diff(scandir("$this->dir/7"), ['.', '..'])));
        self::assertFileEquals("$this->dir/8/3", "$this->dir/7/5");
        $this->files->move(8, 3, 9);
        self::assertSame(['3', '3.400.jpg'], array_values(array_diff(scandir("$this->dir/9"), ['.', '..'])));
        self::assertSame([], array_values(array_diff(scandir("$this->dir/8"), ['.', '..'])));
        $this->files->move(9, 3, 9);
        self::assertFileExists("$this->dir/9/3");
        $this->files->deleteAll(7);
        $this->files->deleteAll(8);
        $this->files->deleteAll(9);
    }

    public function testSaysWhatAnUploadIsByItsContentAndWhyOneCannotBeTaken(): void
    {
        $upload = $this->upload(self::jpeg(8, 8));
        self::assertSame(['name' => 'photo.jpg', 'mediaType' => 'image/jpeg', 'size' => strlen(self::jpeg(8, 8))], FileStore::describe($upload));
        self::assertNull(FileStore::problemOf($upload));
        self::assertNull(FileStore::problemOf(null));
        self::assertSame('One file at a time.', FileStore::problemOf([$upload]));
        self::assertSame('The file is too large for the server.', FileStore::problemOf(new UploadedFile('', 'big.pdf', 'application/pdf', 0, UPLOAD_ERR_INI_SIZE)));
        unlink((string) $upload->getStream()->getMetadata('uri'));
    }

    public function testMeasuresAnImageAsItIsSeen(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'image');
        file_put_contents($path, self::jpeg(640, 480));
        self::assertSame([640, 480], FileStore::pixelsOf($path, 'image/jpeg'));
        file_put_contents($path, self::jpeg(640, 480, 6));
        self::assertSame([480, 640], FileStore::pixelsOf($path, 'image/jpeg'));
        self::assertNull(FileStore::pixelsOf($path, 'application/pdf'));
        file_put_contents($path, 'no image');
        self::assertNull(FileStore::pixelsOf($path, 'image/jpeg'));
        unlink($path);
    }

    private function upload(string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'upload');
        file_put_contents($path, $content);
        return new UploadedFile($path, 'photo.jpg', 'image/jpeg', strlen($content));
    }

    /** A JPEG of that size, with an EXIF block that names the orientation where one is given. */
    private static function jpeg(int $width, int $height, ?int $orientation = null): string
    {
        $image = imagecreatetruecolor($width, $height);
        ob_start();
        imagejpeg($image);
        $jpeg = ob_get_clean();
        if ($orientation === null) {
            return $jpeg;
        }
        $exif = "Exif\0\0MM\0*\0\0\0\x08\0\x01\x01\x12\0\x03\0\0\0\x01" . pack('n', $orientation) . "\0\0\0\0\0\0";
        return "\xFF\xD8\xFF\xE1" . pack('n', strlen($exif) + 2) . $exif . substr($jpeg, 2);
    }
}
