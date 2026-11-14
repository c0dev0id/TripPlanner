<?php

declare(strict_types=1);

namespace Planner\Media;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Journal\Entries;
use Planner\Journal\EntryFiles;
use Planner\Journal\FileStore;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * The additional media API: the files and links kept with the days of a trip. They are
 * entries of a kind of their own beside the journal's, so that they are copied, merged,
 * archived and removed with the trip as the journal's files are.
 */
final class MediaController
{
    private const MAX_NAME = 200;
    private const MAX_URL = 2000;

    public function __construct(
        private readonly Entries $entries,
        private readonly FileStore $files,
        private readonly EntryFiles $responses,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response, array $args): Response
    {
        $media = $this->entries->listFor($this->currentUser->get()->id, (int) $args['id'], Entries::MEDIA);
        return $media === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, $media);
    }

    /** Keeps a file or a link with a day, from a multipart form: `dayId`, and a `file`, or a `url` with its `name`. */
    public function add(Request $request, Response $response, array $args): Response
    {
        $body = (array) $request->getParsedBody();
        $upload = $request->getUploadedFiles()['file'] ?? null;
        $problem = FileStore::problemOf($upload) ?? self::problemOf($body['name'] ?? '', $body['url'] ?? null);
        if ($problem !== null) {
            return Json::error($response, 422, $problem);
        }
        if (($upload === null) === !isset($body['url']) || !is_string($body['dayId'] ?? null)) {
            return Json::error($response, 422, 'Media are a file or a link, on a day.');
        }
        $tripId = (int) $args['id'];
        $file = $upload === null ? null : FileStore::describe($upload);
        $entry = $this->entries->addMedia($this->currentUser->get()->id, $tripId, $body['dayId'], trim((string) ($body['name'] ?? '')), $file, $body['url'] ?? null, new DateTimeImmutable());
        if ($entry === null) {
            return Json::error($response, 404, 'No such trip or day of it.');
        }
        if ($upload !== null) {
            $this->files->store($upload, $tripId, $entry->id);
        }
        return Json::of($response->withStatus(201), $entry);
    }

    /** Moves a file or a link to the day `dayId`, of this trip or another of the user's; or names it anew from `name`, a link with its `url`. */
    public function change(Request $request, Response $response, array $args): Response
    {
        $userId = $this->currentUser->get()->id;
        $tripId = (int) $args['id'];
        $dayId = Json::field($request, 'dayId');
        if (is_string($dayId)) {
            $moved = $this->entries->moveMedia($userId, $tripId, (int) $args['entry'], $dayId);
            if ($moved === null) {
                return Json::error($response, 404, 'No such file or day.');
            }
            $this->files->move($tripId, $moved->id, $moved->tripId);
            return $response->withStatus(204);
        }
        $name = Json::field($request, 'name');
        $url = Json::field($request, 'url');
        $problem = is_string($name) ? self::problemOf($name, $url) : 'A day or a name is needed.';
        if ($problem !== null) {
            return Json::error($response, 422, $problem);
        }
        return $this->entries->changeMedia($userId, $tripId, (int) $args['entry'], trim($name), $url) ? $response->withStatus(204) : Json::error($response, 404, 'No such file.');
    }

    /** A copy of a file or a link on the day `dayId`, of this trip or another of the user's. */
    public function copy(Request $request, Response $response, array $args): Response
    {
        $tripId = (int) $args['id'];
        $dayId = Json::field($request, 'dayId');
        $copy = is_string($dayId) ? $this->entries->copyMedia($this->currentUser->get()->id, $tripId, (int) $args['entry'], $dayId, new DateTimeImmutable()) : null;
        if ($copy === null) {
            return Json::error($response, 404, 'No such file or day.');
        }
        $this->files->copy($tripId, (int) $args['entry'], $copy->tripId, $copy->id);
        return Json::of($response->withStatus(201), $copy);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $entry = $this->entries->delete($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry'], Entries::MEDIA);
        if ($entry === null) {
            return Json::error($response, 404, 'No such file.');
        }
        $this->files->delete($entry->tripId, $entry->id);
        return $response->withStatus(204);
    }

    public function file(Request $request, Response $response, array $args): Response
    {
        return $this->responses->file($response, $this->entries->find($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry'], Entries::MEDIA));
    }

    public function preview(Request $request, Response $response, array $args): Response
    {
        return $this->responses->preview($response, $this->entries->find($this->currentUser->get()->id, (int) $args['id'], (int) $args['entry'], Entries::MEDIA));
    }

    /** What is wrong with a name and, where one is given, a link's address; null for none. */
    private static function problemOf(mixed $name, mixed $url): ?string
    {
        if (!is_string($name) || mb_strlen(trim($name)) > self::MAX_NAME) {
            return 'The name is too long.';
        }
        if ($url === null) {
            return null;
        }
        $web = is_string($url) && strlen($url) <= self::MAX_URL && preg_match('#^https?://\S+$#i', $url) === 1 && filter_var($url, FILTER_VALIDATE_URL) !== false;
        return $web ? null : 'A link needs an address of the web.';
    }
}
