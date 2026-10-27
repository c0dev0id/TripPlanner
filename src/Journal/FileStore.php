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
        foreach ([$this->path($tripId, $entryId), $this->path($tripId, $entryId) . '.preview.jpg'] as $file) {
            if (is_file($file)) {
                unlink($file);
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
        $preview = $this->path($tripId, $entryId) . '.preview.jpg';
        if (is_file($preview)) {
            return $preview;
        }
        $image = self::readImage($this->path($tripId, $entryId), $mediaType);
        if ($image === null) {
            return null;
        }
        $scale = min(1, self::PREVIEW_PX / max(imagesx($image), imagesy($image)));
        $small = imagescale($image, (int) round(imagesx($image) * $scale), (int) round(imagesy($image) * $scale));
        imagedestroy($image);
        if ($small === false) {
            return null;
        }
        imagejpeg($small, $preview, 80);
        imagedestroy($small);
        return $preview;
    }

    /** The image turned the way its EXIF orientation says it is to be seen. */
    private static function readImage(string $path, string $mediaType): ?\GdImage
    {
        $image = match ($mediaType) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => @imagecreatefromwebp($path),
            default => false,
        };
        if ($image === false) {
            return null;
        }
        $orientation = $mediaType === 'image/jpeg' && function_exists('exif_read_data') ? (@exif_read_data($path)['Orientation'] ?? 1) : 1;
        $turned = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };
        return $turned === false ? $image : $turned;
    }
}
