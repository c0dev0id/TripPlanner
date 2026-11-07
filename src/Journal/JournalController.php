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

    /** Adds an entry from a multipart form: `text`, at most one of `dayId`, `stopId`, `routeId`, a `file`, and `lng` and `lat` for a spot on the map. */
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
        $target = array_filter(array_intersect_key($body, Entries::PARTS), is_string(...));
        if (count($target) > 1) {
            return Json::error($response, 422, 'An entry is on one part at most.');
        }
        $spot = self::spotOf($body);
        if ($spot === false) {
            return Json::error($response, 422, 'The spot is not a position.');
        }
        $tripId = (int) $args['id'];
        $entry = $this->entries->add($this->currentUser->get()->id, $tripId, $target, $text, $upload === null ? null : self::fileOf($upload), new DateTimeImmutable(), $spot);
        if ($entry === null) {
            return Json::error($response, 404, 'No such trip or part of it.');
        }
        if ($upload !== null) {
            $this->files->store($upload, $tripId, $entry->id);
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

    /**
     * The spot the form names by `lng` and `lat`: null without them, false where they are no position.
     *
     * @return ?array{0: float, 1: float}|false
     */
    private static function spotOf(array $body): array|null|false
    {
        if (!isset($body['lng']) && !isset($body['lat'])) {
            return null;
        }
        $lng = filter_var($body['lng'] ?? null, FILTER_VALIDATE_FLOAT);
        $lat = filter_var($body['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($lng === false || $lat === false || abs($lng) > 180 || abs($lat) > 90) {
            return false;
        }
        return [$lng, $lat];
    }

    /**
     * What the entry keeps about the upload: its name, its type as its content says (not as
     * the browser claims), its size, and a photo's EXIF time and position, read from the
     * upload where it still lies.
     */
    private static function fileOf(UploadedFileInterface $upload): array
    {
        $stream = $upload->getStream();
        $type = (new \finfo(FILEINFO_MIME_TYPE))->buffer((string) $stream->read(8192));
        $stream->rewind();
        $mediaType = $type === false ? 'application/octet-stream' : $type;
        return [
            'name' => mb_substr(basename($upload->getClientFilename() ?? 'file'), 0, 200),
            'mediaType' => $mediaType,
            'size' => (int) $upload->getSize(),
            ...Exif::read((string) $stream->getMetadata('uri'), $mediaType),
        ];
    }
}
