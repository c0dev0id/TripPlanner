<?php

declare(strict_types=1);

namespace Planner\Journal;

use Psr\Http\Message\UploadedFileInterface;

/** The files of the journal and of the days' media on disk, one per entry under its trip, and beside each image JPEGs of it at the sizes it is shown at. */
final class FileStore
{
    /** The image types GD reads here, so the ones that are shown as images; a HEIC is kept and offered as a file. */
    public const PREVIEWABLE = ['image/jpeg', 'image/png', 'image/webp'];

    /** The longer side of the sizes an image is kept at, in pixels: for a list, for the column of a page, for looking at it large. */
    public const SIZES = [400, 1280, 2048];

    /** An image of more pixels is not read: GD holds four bytes for each. */
    private const MAX_PIXELS = 20_000_000;

    private const JPEG_QUALITY = 85;

    public function __construct(private readonly string $dir)
    {
    }

    public function path(int $tripId, int $entryId): string
    {
        return "$this->dir/$tripId/$entryId";
    }

    public function store(UploadedFileInterface $upload, int $tripId, int $entryId): void
    {
        if (!is_dir("$this->dir/$tripId")) {
            mkdir("$this->dir/$tripId", 0750, true);
        }
        $upload->moveTo($this->path($tripId, $entryId));
    }

    /**
     * What is kept about an upload: its name, its type as its content says, not as the
     * browser claims, and its size.
     *
     * @return array{name: string, mediaType: string, size: int}
     */
    public static function describe(UploadedFileInterface $upload): array
    {
        $stream = $upload->getStream();
        $type = (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $stream->read(8192));
        $stream->rewind();
        return [
            'name' => mb_substr(basename($upload->getClientFilename() ?? 'file'), 0, 200),
            'mediaType' => $type === false ? 'application/octet-stream' : $type,
            'size' => (int) $upload->getSize(),
        ];
    }

    /**
     * The size an image at the path is seen at, in pixels, turned as its EXIF orientation
     * says; null for what is no image read here.
     *
     * @return ?array{0: int, 1: int}
     */
    public static function pixelsOf(string $path, string $mediaType): ?array
    {
        $size = in_array($mediaType, self::PREVIEWABLE, true) ? @getimagesize($path) : false;
        if ($size === false) {
            return null;
        }
        return $mediaType === 'image/jpeg' && self::orientation($path) >= 5 ? [$size[1], $size[0]] : [$size[0], $size[1]];
    }

    /** Why an upload cannot be taken, in the words the API answers with; null for one that can, and for none. */
    public static function problemOf(mixed $upload): ?string
    {
        if ($upload === null) {
            return null;
        }
        if (!$upload instanceof UploadedFileInterface) {
            return 'One file at a time.';
        }
        return match ($upload->getError()) {
            UPLOAD_ERR_OK => null,
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'The file is too large for the server.',
            default => 'The upload failed.',
        };
    }

    /** Moves an entry's file and images to another trip, where the entry is then. */
    public function move(int $fromTripId, int $entryId, int $toTripId): void
    {
        if ($fromTripId !== $toTripId) {
            $this->each($fromTripId, $entryId, $toTripId, $entryId, rename(...));
        }
    }

    /** Copies an entry's file and images for a copy of the entry. */
    public function copy(int $fromTripId, int $fromEntryId, int $toTripId, int $toEntryId): void
    {
        $this->each($fromTripId, $fromEntryId, $toTripId, $toEntryId, copy(...));
    }

    /** Hands an entry's file and its images, those there are, to `$take` with where they go. */
    private function each(int $fromTripId, int $fromEntryId, int $toTripId, int $toEntryId, callable $take): void
    {
        if (!is_dir("$this->dir/$toTripId")) {
            mkdir("$this->dir/$toTripId", 0750, true);
        }
        $to = $this->paths($toTripId, $toEntryId);
        foreach ($this->paths($fromTripId, $fromEntryId) as $index => $from) {
            if (is_file($from)) {
                $take($from, $to[$index]);
            }
        }
    }

    public function delete(int $tripId, int $entryId): void
    {
        foreach ($this->paths($tripId, $entryId) as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
    }

    /** Removes every trip's files: for a database recreated from scratch. */
    public function clear(): void
    {
        foreach (is_dir($this->dir) ? scandir($this->dir) : [] as $name) {
            if (ctype_digit($name)) {
                $this->deleteAll((int) $name);
            }
        }
    }

    /** Removes everything of a trip, for a trip being deleted. */
    public function deleteAll(int $tripId): void
    {
        $dir = "$this->dir/$tripId";
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) as $name) {
            if ($name !== '.' && $name !== '..') {
                unlink("$dir/$name");
            }
        }
        rmdir($dir);
    }

    /** Moves every file of a trip to another, for a trip merged into it; files are named by entry, so none is in the way. */
    public function moveAll(int $fromTripId, int $toTripId): void
    {
        $from = "$this->dir/$fromTripId";
        if (!is_dir($from)) {
            return;
        }
        if (!is_dir("$this->dir/$toTripId")) {
            mkdir("$this->dir/$toTripId", 0750, true);
        }
        foreach (scandir($from) as $name) {
            if ($name !== '.' && $name !== '..') {
                rename("$from/$name", "$this->dir/$toTripId/$name");
            }
        }
        rmdir($from);
    }

    /** An image entry's picture at one of SIZES, made on first use; null where the image cannot be read. */
    public function image(int $tripId, int $entryId, string $mediaType, int $px): ?string
    {
        $path = $this->imagePath($tripId, $entryId, $px);
        if (!is_file($path)) {
            $this->makeImages($tripId, $entryId, $mediaType, [$px]);
        }
        return is_file($path) ? $path : null;
    }

    /**
     * Makes an image entry's pictures at the sizes given from one reading of its file:
     * all of them for a file just stored, so that nobody who looks at it waits for them.
     *
     * @param int[] $sizes of SIZES
     */
    public function makeImages(int $tripId, int $entryId, string $mediaType, array $sizes = self::SIZES): void
    {
        $file = $this->path($tripId, $entryId);
        $image = self::read($file, $mediaType);
        if ($image === null) {
            return;
        }
        $orientation = $mediaType === 'image/jpeg' ? self::orientation($file) : 1;
        foreach ($sizes as $px) {
            $path = $this->imagePath($tripId, $entryId, $px);
            // Written beside and renamed, so that a request made meanwhile never reads half a picture.
            file_put_contents("$path.part", self::jpeg($image, $px, $orientation));
            rename("$path.part", $path);
        }
    }

    /** A small JPEG of the image at the path, turned the way it is to be seen; null where the image cannot be read. */
    public static function previewOf(string $path, string $mediaType): ?string
    {
        $image = self::read($path, $mediaType);
        return $image === null ? null : self::jpeg($image, self::SIZES[0], $mediaType === 'image/jpeg' ? self::orientation($path) : 1);
    }

    /** The image at the path as GD holds it; null where it is none read here, cannot be read, or is too large to be. */
    private static function read(string $path, string $mediaType): ?\GdImage
    {
        $size = in_array($mediaType, self::PREVIEWABLE, true) ? @getimagesize($path) : false;
        if ($size === false || $size[0] * $size[1] > self::MAX_PIXELS) {
            return null;
        }
        $image = match ($mediaType) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => @imagecreatefromwebp($path),
        };
        return $image === false ? null : $image;
    }

    /** The image as a JPEG of at most `$px` on its longer side, never larger than it is, turned as the orientation says. It carries nothing of the file's metadata. */
    private static function jpeg(\GdImage $image, int $px, int $orientation): string
    {
        // Scaled first, then turned: turning the small image costs nothing, the full one a second copy of it.
        $scale = min(1, $px / max(imagesx($image), imagesy($image)));
        [$width, $height] = [max(1, (int) round(imagesx($image) * $scale)), max(1, (int) round(imagesy($image) * $scale))];
        $scaled = imagecreatetruecolor($width, $height);
        imagefill($scaled, 0, 0, imagecolorallocate($scaled, 255, 255, 255));
        imagecopyresampled($scaled, $image, 0, 0, 0, 0, $width, $height, imagesx($image), imagesy($image));
        ob_start();
        imagejpeg(self::turned($scaled, $orientation), null, self::JPEG_QUALITY);
        return (string) ob_get_clean();
    }

    private function imagePath(int $tripId, int $entryId, int $px): string
    {
        return $this->path($tripId, $entryId) . ".$px.jpg";
    }

    /** @return list<string> where an entry's file and its images lie */
    private function paths(int $tripId, int $entryId): array
    {
        return [$this->path($tripId, $entryId), ...array_map(fn (int $px) => $this->imagePath($tripId, $entryId, $px), self::SIZES)];
    }

    /** The EXIF orientation of a JPEG: 1 where there is none or exif is missing. */
    private static function orientation(string $path): int
    {
        return function_exists('exif_read_data') ? (int) (@exif_read_data($path)['Orientation'] ?? 1) : 1;
    }

    /** The image turned the way its EXIF orientation says it is to be seen. */
    private static function turned(\GdImage $image, int $orientation): \GdImage
    {
        $turned = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };
        return $turned === false ? $image : $turned;
    }
}
