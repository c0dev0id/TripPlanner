<?php

declare(strict_types=1);

namespace Planner\Journal;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\UploadedFileInterface;

/** The journal API of a trip: its entries, adding one with a file, an entry's text, its deletion, its file and preview. */
final class JournalController
{
    public function __construct(
        private readonly Entries $entries,
        private readonly FileStore $files,
        private readonly EntryFiles $responses,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response, array $args): Response
    {
        $entries = $this->entries->listFor($this->currentUser->get()->id, (int) $args['id']);
        return $entries === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, $entries);
    }

    /** Adds an entry from a multipart form: `text`, one of `dayId`, `stopId`, `routeId`, and a `file`. */
    public function add(Request $request, Response $response, array $args): Response
    {
        $body = (array) $request->getParsedBody();
        $text = trim((string) ($body['text'] ?? ''));
        if (mb_strlen($text) > Entries::MAX_TEXT) {
            return Json::error($response, 422, 'The text is too long.');
        }
        $upload = $request->getUploadedFiles()['file'] ?? null;
        if ($upload !== null && !$upload instanceof UploadedFileInterface) {
            return Json::error($response, 422, 'One file at a time.');
        }
        if ($upload !== null && $upload->getError() !== UPLOAD_ERR_OK) {
            return Json::error($response, 422, $upload->getError() === UPLOAD_ERR_INI_SIZE || $upload->getError() === UPLOAD_ERR_FORM_SIZE ? 'The file is too large for the server.' : 'The upload failed.');
        }
        if ($upload === null && $text === '') {
            return Json::error($response, 422, 'An entry needs a text or a file.');
        }
        $target = array_intersect_key($body, array_flip(['dayId', 'stopId', 'routeId']));
        $file = $upload === null ? null : ['name' => mb_substr(basename($upload->getClientFilename() ?? 'file'), 0, 200), 'mediaType' => self::mediaType($upload), 'size' => (int) $upload->getSize()];
        $userId = $this->currentUser->get()->id;
        $tripId = (int) $args['id'];
        $entry = $this->entries->add($userId, $tripId, $target, $text, $file, new DateTimeImmutable());
        if ($entry === null) {
            return Json::error($response, 404, 'No such trip or part of it.');
        }
        if ($upload !== null) {
            $this->files->store($upload, $tripId, $entry->id);
            $exif = Exif::read($this->files->path($tripId, $entry->id), $file['mediaType']);
            if ($exif['takenAt'] !== null || $exif['lngLat'] !== null) {
                $entry = $this->entries->place($userId, $tripId, $entry->id, $exif['takenAt'], $exif['lngLat']);
            }
        }
        return Json::of($response->withStatus(201), $entry);
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $text = Json::field($request, 'text');
        if (!is_string($text) || mb_strlen($text) > Entries::MAX_TEXT) {
            return Json::error($response, 422, 'The text must be a string of up to 20000 characters.');
        }
        $updated = $this->entries->updateText($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry'], trim($text));
        return $updated ? $response->withStatus(204) : Json::error($response, 404, 'No such entry.');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $entry = $this->entries->delete($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry']);
        if ($entry === null) {
            return Json::error($response, 404, 'No such entry.');
        }
        $this->files->delete($entry->tripId, $entry->id);
        return $response->withStatus(204);
    }

    public function file(Request $request, Response $response, array $args): Response
    {
        return $this->responses->file($response, $this->entries->find($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry']));
    }

    public function preview(Request $request, Response $response, array $args): Response
    {
        return $this->responses->preview($response, $this->entries->find($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry']));
    }

    /** The file's type as its content says, not as the browser claims. */
    private static function mediaType(UploadedFileInterface $upload): string
    {
        $stream = $upload->getStream();
        $type = (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $stream->read(8192));
        $stream->rewind();
        return $type === false ? 'application/octet-stream' : $type;
    }
}
