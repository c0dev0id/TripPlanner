<?php

declare(strict_types=1);

namespace Planner\Stash;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\GpxUpload;
use Planner\Http\InvalidUpload;
use Planner\Http\Json;
use Planner\Name;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The Stash's files over the API. */
final class StashController
{
    public function __construct(private readonly StashFiles $files, private readonly StashRides $rides, private readonly CurrentUser $currentUser)
    {
    }

    /** The user's files, each with its routes and tracks. */
    public function index(Request $request, Response $response): Response
    {
        return Json::of($response, $this->files->listFor($this->currentUser->get()->id));
    }

    /**
     * Keeps a file in a folder of the Stash: a multipart form with the file's `name`, the
     * `folderId` and the GPX file compressed with gzip as `file`. A file the user keeps
     * already is not kept again: the answer is then the file as it is kept, with 200
     * instead of 201.
     */
    public function add(Request $request, Response $response): Response
    {
        $body = (array) $request->getParsedBody();
        $name = Name::of($body['name'] ?? null);
        if ($name === null) {
            return Json::error($response, 422, 'A file needs a name of up to 200 characters.');
        }
        try {
            $gzip = GpxUpload::gzip($request);
        } catch (InvalidUpload $invalid) {
            return Json::error($response, 422, $invalid->getMessage());
        }
        $kept = $this->files->keep($this->currentUser->get()->id, (int) ($body['folderId'] ?? 0), $name, $gzip, new DateTimeImmutable());
        return $kept === null ? Json::error($response, 404, 'No such folder in the Stash.') : Json::of($response->withStatus($kept['added'] ? 201 : 200), $kept['file']);
    }

    /** Renames the file with `{name}`, or moves it into another folder of the Stash with `{folderId}`. */
    public function change(Request $request, Response $response, array $args): Response
    {
        $userId = $this->currentUser->get()->id;
        $folderId = Json::field($request, 'folderId');
        if (is_int($folderId)) {
            return $this->files->move($userId, (int) $args['file'], $folderId) ? $response->withStatus(204) : Json::error($response, 404, 'No such file, or no such folder in the Stash.');
        }
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A file needs a name of up to 200 characters.');
        }
        return $this->files->rename($userId, (int) $args['file'], $name) ? $response->withStatus(204) : Json::error($response, 404, 'No such file.');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->files->delete($this->currentUser->get()->id, (int) $args['file']);
        return $deleted ? $response->withStatus(204) : Json::error($response, 404, 'No such file.');
    }

    /** Renames a route or a track of the file, by its kind and its place among the file's routes or tracks, with `{name}`. */
    public function renameItem(Request $request, Response $response, array $args): Response
    {
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A route needs a name of up to 200 characters.');
        }
        $renamed = $this->files->renameItem($this->currentUser->get()->id, (int) $args['file'], $args['kind'], (int) $args['position'], $name);
        return $renamed ? $response->withStatus(204) : Json::error($response, 404, 'No such route or track in the file.');
    }

    /** Removes routes and tracks from the file: `items=` names them, comma-separated, each as its kind and its place among the file's routes or tracks, as `track:0`. */
    public function removeItems(Request $request, Response $response, array $args): Response
    {
        $items = [];
        foreach (array_filter(explode(',', (string) ($request->getQueryParams()['items'] ?? ''))) as $item) {
            if (preg_match('/^(route|track):([0-9]+)$/', $item, $found) !== 1) {
                return Json::error($response, 422, 'No such route or track in the file.');
            }
            $items[] = ['kind' => $found[1], 'position' => (int) $found[2]];
        }
        $removed = $items !== [] && $this->files->removeItems($this->currentUser->get()->id, (int) $args['file'], $items);
        return $removed ? $response->withStatus(204) : Json::error($response, 404, 'No such route or track in the file.');
    }

    /** Keeps the file's tracks as rides: all of them, or with `{tracks}` those at these places among its tracks. Answers how many were `kept` and how many the user kept already, `known`. */
    public function keepRides(Request $request, Response $response, array $args): Response
    {
        $tracks = Json::field($request, 'tracks');
        $kept = $this->rides->keep($this->currentUser->get()->id, (int) $args['file'], is_array($tracks) ? array_map('intval', $tracks) : null, new DateTimeImmutable());
        return $kept === null ? Json::error($response, 404, 'No such file.') : Json::of($response, $kept);
    }

    /** The file as it is kept, compressed, which the browser unpacks itself. */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $gzip = $this->files->gzip($this->currentUser->get()->id, (int) $args['file']);
        if ($gzip === null) {
            return Json::error($response, 404, 'No such file.');
        }
        $response->getBody()->write($gzip);
        return $response->withHeader('Content-Type', 'application/gpx+xml')->withHeader('Content-Encoding', 'gzip')->withHeader('Cache-Control', 'private, no-cache');
    }
}
