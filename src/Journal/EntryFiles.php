<?php

declare(strict_types=1);

namespace Planner\Journal;

use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Psr7\Factory\StreamFactory;

/** An entry's file and its picture as HTTP responses, for the owner's API and the shared one. */
final class EntryFiles
{
    /** Files of these types are shown in the browser; everything else is offered for download. */
    private const INLINE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

    /** A file never changes under its entry, and its address changes with it, so the browser may keep it a day. */
    private const CACHE = 'private, max-age=86400';

    public function __construct(private readonly FileStore $files)
    {
    }

    /** The file as it was uploaded, streamed: shown in the browser where it can be, offered for download otherwise. */
    public function file(Response $response, ?Entry $entry): Response
    {
        if ($entry === null || $entry->file === null) {
            return Json::error($response, 404, 'File not found.');
        }
        $path = $this->files->path($entry->tripId, $entry->id);
        if (!is_file($path)) {
            return Json::error($response, 404, 'The file no longer exists.');
        }
        return self::describing($response->withBody((new StreamFactory())->createStreamFromFile($path)), $entry->file['name'], $entry->file['mediaType']);
    }

    /** The response as a kept file is answered: under its name and type, shown in the browser where it can be, offered for download otherwise, and kept by the browser a day. */
    public static function describing(Response $response, string $name, string $mediaType): Response
    {
        $disposition = in_array($mediaType, self::INLINE_TYPES, true) ? 'inline' : 'attachment';
        return $response
            ->withHeader('Content-Type', $mediaType)
            ->withHeader('Content-Disposition', "$disposition; filename*=UTF-8''" . rawurlencode($name))
            ->withHeader('X-Content-Type-Options', 'nosniff')
            ->withHeader('Cache-Control', self::CACHE);
    }

    /** An image entry's picture as a JPEG of at most `$px` on its longer side, one of FileStore::SIZES. */
    public function image(Response $response, ?Entry $entry, int $px): Response
    {
        if ($entry === null || $entry->file === null || !$entry->file['image']) {
            return Json::error($response, 404, 'Image not found.');
        }
        $image = $this->files->image($entry->tripId, $entry->id, $entry->file['mediaType'], $px);
        if ($image === null) {
            return Json::error($response, 404, 'The image cannot be read.');
        }
        return self::asPreview($response->withBody((new StreamFactory())->createStreamFromFile($image)));
    }

    /** The response as a picture made of an image is answered: a JPEG the browser may keep a day. */
    public static function asPreview(Response $response): Response
    {
        return $response->withHeader('Content-Type', 'image/jpeg')->withHeader('Cache-Control', self::CACHE);
    }
}
