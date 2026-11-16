<?php

declare(strict_types=1);

namespace Planner\Stash;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Journal\EntryFiles;
use Planner\Journal\FileStore;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The media kept with the Stash's files over the API. */
final class StashMediaController
{
    public function __construct(private readonly StashMedia $media, private readonly CurrentUser $currentUser)
    {
    }

    /**
     * Keeps a media file with a file of the Stash, from a multipart form with the `file`.
     * One the file has already is not kept again: the answer is then the media file as it
     * is kept, with 200 instead of 201.
     */
    public function add(Request $request, Response $response, array $args): Response
    {
        $upload = $request->getUploadedFiles()['file'] ?? null;
        $problem = $upload === null ? 'A file is required.' : FileStore::problemOf($upload);
        if ($problem !== null) {
            return Json::error($response, 422, $problem);
        }
        $file = FileStore::describe($upload);
        $stream = $upload->getStream();
        $preview = in_array($file['mediaType'], FileStore::PREVIEWABLE, true) ? FileStore::previewOf((string) $stream->getMetadata('uri'), $file['mediaType']) : null;
        $kept = $this->media->keep($this->currentUser->get()->id, (int) $args['file'], $file, (string) $stream, $preview, new DateTimeImmutable());
        return $kept === null ? Json::error($response, 404, 'File not found.') : Json::of($response->withStatus($kept['added'] ? 201 : 200), $kept['media']);
    }

    public function file(Request $request, Response $response, array $args): Response
    {
        $found = $this->media->content($this->currentUser->get()->id, (int) $args['file'], (int) $args['media']);
        if ($found === null) {
            return Json::error($response, 404, 'File not found.');
        }
        $response->getBody()->write($found['content']);
        return EntryFiles::describing($response, $found['name'], $found['mediaType']);
    }

    /** A small JPEG of an image among the media. */
    public function preview(Request $request, Response $response, array $args): Response
    {
        $preview = $this->media->preview($this->currentUser->get()->id, (int) $args['file'], (int) $args['media']);
        if ($preview === null) {
            return Json::error($response, 404, 'Image not found.');
        }
        $response->getBody()->write($preview);
        return $response->withHeader('Content-Type', 'image/jpeg')->withHeader('Cache-Control', EntryFiles::CACHE);
    }

    /** Removes one media file of the file, or without one named all of them. */
    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->media->delete($this->currentUser->get()->id, (int) $args['file'], isset($args['media']) ? (int) $args['media'] : null);
        return $deleted ? $response->withStatus(204) : Json::error($response, 404, 'File not found.');
    }
}
