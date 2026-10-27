<?php

declare(strict_types=1);

namespace Planner\Journal;

use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Psr7\Factory\StreamFactory;

/** An entry's file and its preview as HTTP responses, for the owner's API and the shared one. */
final class EntryFiles
{
    /** Files of these types are shown in the browser; everything else is offered for download. */
    private const INLINE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

    /** A file never changes under its entry's id, so the browser may keep it a day. */
    private const CACHE = 'private, max-age=86400';

    public function __construct(private readonly FileStore $files)
    {
    }

    /** The file as it was uploaded, streamed: shown in the browser where it can be, offered for download otherwise. */
    public function file(Response $response, ?Entry $entry): Response
    {
        if ($entry === null || $entry->file === null) {
            return Json::error($response, 404, 'No such file.');
        }
        $path = $this->files->path($entry->tripId, $entry->id);
        if (!is_file($path)) {
            return Json::error($response, 404, 'The file is gone.');
        }
        $disposition = in_array($entry->file['mediaType'], self::INLINE_TYPES, true) ? 'inline' : 'attachment';
        return $response
            ->withBody((new StreamFactory())->createStreamFromFile($path))
            ->withHeader('Content-Type', $entry->file['mediaType'])
            ->withHeader('Content-Disposition', "$disposition; filename*=UTF-8''" . rawurlencode($entry->file['name']))
            ->withHeader('Cache-Control', self::CACHE);
    }

    /** A small JPEG of an image entry. */
    public function preview(Response $response, ?Entry $entry): Response
    {
        if ($entry === null || $entry->file === null || !$entry->file['image']) {
            return Json::error($response, 404, 'No such image.');
        }
        $preview = $this->files->preview($entry->tripId, $entry->id, $entry->file['mediaType']);
        if ($preview === null) {
            return Json::error($response, 404, 'The image cannot be read.');
        }
        return $response
            ->withBody((new StreamFactory())->createStreamFromFile($preview))
            ->withHeader('Content-Type', 'image/jpeg')
            ->withHeader('Cache-Control', self::CACHE);
    }
}
