<?php

declare(strict_types=1);

namespace Planner\Journal;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Timestamp;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\UploadedFileInterface;

/** The journal API of a trip: its entries, adding one with a file, an entry's text, link and place, the order in a chapter, an entry's deletion, its file and its picture. */
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
        return $entries === null ? Json::error($response, 404, 'Trip not found.') : Json::of($response, $entries);
    }

    public function photos(Request $request, Response $response): Response
    {
        return Json::of($response, $this->entries->photosOnMap($this->currentUser->get()->id));
    }

    /**
     * Adds an entry from a multipart form: `text`, at most one of `dayId`, `stopId`, `routeId`, a `file`, `lng` and `lat` for a
     * spot on the map, `byDate` for a photo without a part to go to the day of its date, and for an entry written earlier and
     * imported now `createdAt`, as the journal gives it.
     */
    public function add(Request $request, Response $response, array $args): Response
    {
        $body = (array) $request->getParsedBody();
        $text = trim((string) ($body['text'] ?? ''));
        if (mb_strlen($text) > Entries::MAX_TEXT) {
            return Json::error($response, 422, 'The text is too long.');
        }
        $upload = $request->getUploadedFiles()['file'] ?? null;
        $problem = FileStore::problemOf($upload);
        if ($problem !== null) {
            return Json::error($response, 422, $problem);
        }
        if ($upload === null && $text === '') {
            return Json::error($response, 422, 'An entry needs a text or a file.');
        }
        $target = array_filter(array_intersect_key($body, Entries::PARTS), is_string(...));
        if (count($target) > 1) {
            return Json::error($response, 422, 'An entry can belong to only one item.');
        }
        $spot = self::spotOf($body);
        if ($spot === false) {
            return Json::error($response, 422, 'Invalid position.');
        }
        $createdAt = isset($body['createdAt']) ? Timestamp::parse((string) $body['createdAt']) : new DateTimeImmutable();
        if ($createdAt === null) {
            return Json::error($response, 422, 'createdAt is not a time.');
        }
        $tripId = (int) $args['id'];
        $entry = $this->entries->add($this->currentUser->get()->id, $tripId, $target, $text, $upload === null ? null : self::fileOf($upload), $createdAt, $spot, isset($body['byDate']));
        if ($entry === null) {
            return Json::error($response, 404, 'Trip or item not found.');
        }
        if ($upload !== null) {
            $this->files->store($upload, $tripId, $entry->id);
            $this->files->makeImages($tripId, $entry->id, $entry->file['mediaType']);
        }
        return Json::of($response->withStatus(201), $entry);
    }

    /**
     * Changes what the body names of an entry: its `text`; its `link`, an object with at most one of `dayId`, `stopId`,
     * `routeId`, none for the trip itself; its `lngLat`, where it stands on the map, null for nowhere.
     */
    public function update(Request $request, Response $response, array $args): Response
    {
        $body = (array) $request->getParsedBody();
        $text = $body['text'] ?? null;
        if (isset($body['text']) && (!is_string($text) || mb_strlen($text) > Entries::MAX_TEXT)) {
            return Json::error($response, 422, 'The text must be a string of up to 20000 characters.');
        }
        $link = $body['link'] ?? null;
        if ($link !== null && (!is_array($link) || count($link) > 1 || array_diff_key($link, Entries::PARTS) !== [] || array_filter($link, is_string(...)) !== $link)) {
            return Json::error($response, 422, 'An entry can belong to only one item.');
        }
        $lngLat = $body['lngLat'] ?? null;
        if ($lngLat !== null && !self::isPosition($lngLat)) {
            return Json::error($response, 422, 'Invalid position.');
        }
        [$userId, $tripId, $entryId] = [$this->currentUser->get()->id, (int) $args['id'], (int) $args['entry']];
        $found = $this->entries->find($userId, $tripId, $entryId) !== null
            && ($text === null || $this->entries->updateText($userId, $tripId, $entryId, trim($text)))
            && ($link === null || $this->entries->relink($userId, $tripId, $entryId, $link))
            && (!array_key_exists('lngLat', $body) || $this->entries->place($userId, $tripId, $entryId, $lngLat));
        return $found ? $response->withStatus(204) : Json::error($response, 404, 'Entry or item not found.');
    }

    /** Puts the entries `ids` in that order in the chapter of the day `dayId`, or with null of the trip itself. */
    public function order(Request $request, Response $response, array $args): Response
    {
        $dayId = Json::field($request, 'dayId');
        $ids = Json::field($request, 'ids');
        if (($dayId !== null && !is_string($dayId)) || !is_array($ids) || !array_is_list($ids) || array_filter($ids, is_int(...)) !== $ids) {
            return Json::error($response, 422, 'The order names a day and the ids of entries.');
        }
        $ordered = $this->entries->reorder($this->currentUser->get()->id, (int) $args['id'], $dayId, $ids);
        return $ordered ? $response->withStatus(204) : Json::error($response, 404, 'Trip, day or entry not found.');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $entry = $this->entries->delete($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry']);
        if ($entry === null) {
            return Json::error($response, 404, 'Entry not found.');
        }
        $this->files->delete($entry->tripId, $entry->id);
        return $response->withStatus(204);
    }

    public function file(Request $request, Response $response, array $args): Response
    {
        return $this->responses->file($response, $this->entries->find($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry']));
    }

    public function image(Request $request, Response $response, array $args): Response
    {
        return $this->responses->image($response, $this->entries->find($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry']), (int) $args['px']);
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

    /** Whether a value of a JSON body is a position: longitude and latitude as numbers within their ranges. */
    private static function isPosition(mixed $value): bool
    {
        return is_array($value) && array_is_list($value) && count($value) === 2
            && (is_int($value[0]) || is_float($value[0])) && (is_int($value[1]) || is_float($value[1]))
            && abs($value[0]) <= 180 && abs($value[1]) <= 90;
    }

    /** What the entry keeps about the upload, with a photo's EXIF time and position and an image's size, read from the upload where it still lies. */
    private static function fileOf(UploadedFileInterface $upload): array
    {
        $file = FileStore::describe($upload);
        $path = (string) $upload->getStream()->getMetadata('uri');
        return [...$file, ...Exif::read($path, $file['mediaType']), 'pixels' => FileStore::pixelsOf($path, $file['mediaType'])];
    }
}
