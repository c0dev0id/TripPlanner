<?php

declare(strict_types=1);

namespace Planner\Journal;

use Psr\Http\Message\UploadedFileInterface;

/** The journal's files on disk, one per entry under its trip, and small JPEG previews of the images. */
final class FileStore
{
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
