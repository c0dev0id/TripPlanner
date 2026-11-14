<?php

declare(strict_types=1);

namespace Planner\Journal;

use Psr\Http\Message\UploadedFileInterface;

/** The files of the journal and of the days' media on disk, one per entry under its trip, and small JPEG previews of the images. */
final class FileStore
{
    /** The image types GD reads here, so the ones that get a preview; a HEIC is kept and offered as a file. */
    public const PREVIEWABLE = ['image/jpeg', 'image/png', 'image/webp'];

    /** The longer side of a preview, in pixels. */
    private const PREVIEW_PX = 400;

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

    /** Moves an entry's file and preview to another trip, where the entry is then. */
    public function move(int $fromTripId, int $entryId, int $toTripId): void
    {
        if ($fromTripId !== $toTripId) {
            $this->each($fromTripId, $entryId, $toTripId, $entryId, rename(...));
        }
    }

    /** Copies an entry's file and preview for a copy of the entry. */
    public function copy(int $fromTripId, int $fromEntryId, int $toTripId, int $toEntryId): void
    {
        $this->each($fromTripId, $fromEntryId, $toTripId, $toEntryId, copy(...));
    }

    /** Hands an entry's file and its preview, those there are, to `$take` with where they go. */
    private function each(int $fromTripId, int $fromEntryId, int $toTripId, int $toEntryId, callable $take): void
    {
        if (!is_dir("$this->dir/$toTripId")) {
            mkdir("$this->dir/$toTripId", 0750, true);
        }
        foreach ([[$this->path($fromTripId, $fromEntryId), $this->path($toTripId, $toEntryId)], [$this->previewPath($fromTripId, $fromEntryId), $this->previewPath($toTripId, $toEntryId)]] as [$from, $to]) {
            if (is_file($from)) {
                $take($from, $to);
            }
        }
    }

    public function delete(int $tripId, int $entryId): void
    {
        foreach ([$this->path($tripId, $entryId), $this->previewPath($tripId, $entryId)] as $file) {
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

    /** The preview of an image entry, made on first use; null where the image cannot be read. */
    public function preview(int $tripId, int $entryId, string $mediaType): ?string
    {
        $preview = $this->previewPath($tripId, $entryId);
        if (is_file($preview)) {
            return $preview;
        }
        $path = $this->path($tripId, $entryId);
        $image = match ($mediaType) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => @imagecreatefromwebp($path),
            default => false,
        };
        if ($image === false) {
            return null;
        }
        // Scaled first, then turned: turning the small image costs nothing, the full one a second copy of it.
        $scale = min(1, self::PREVIEW_PX / max(imagesx($image), imagesy($image)));
        $small = imagescale($image, (int) round(imagesx($image) * $scale), (int) round(imagesy($image) * $scale));
        imagedestroy($image);
        if ($small === false) {
            return null;
        }
        imagejpeg(self::turned($small, $mediaType === 'image/jpeg' ? self::orientation($path) : 1), $preview, 80);
        return $preview;
    }

    private function previewPath(int $tripId, int $entryId): string
    {
        return $this->path($tripId, $entryId) . '.preview.jpg';
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
