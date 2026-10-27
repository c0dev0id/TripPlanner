<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The trips API: the library's list and the trip document. */
final class TripController
{
    public function __construct(
        private readonly Trips $trips,
        private readonly Folders $folders,
        private readonly TripDocuments $documents,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        return Json::of($response, $this->trips->listFor($this->currentUser->get()->id));
    }

    public function create(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $name = TripDocumentValidator::name(is_array($body) ? $body['name'] ?? null : null);
        if ($name === null) {
            return Json::error($response, 422, 'A trip needs a name of up to 200 characters.');
        }
        $folderId = $this->folderId($body);
        if ($folderId === false) {
            return Json::error($response, 422, 'No such folder.');
        }
        $trip = $this->trips->create($this->currentUser->get()->id, $name, new DateTimeImmutable(), $folderId);
        return Json::of($response->withStatus(201), $trip);
    }

    /** Puts the trip into the folder the body names, or into none for null. */
    public function move(Request $request, Response $response, array $args): Response
    {
        $folderId = $this->folderId($request->getParsedBody());
        if ($folderId === false) {
            return Json::error($response, 422, 'No such folder.');
        }
        $moved = $this->trips->move($this->currentUser->get()->id, (int) $args['id'], $folderId);
        return $moved ? $response->withStatus(204) : Json::error($response, 404, 'No such trip.');
    }

    /** The folder a body names: null for none, false for one the user does not have. */
    private function folderId(mixed $body): int|null|false
    {
        $folderId = is_array($body) ? $body['folderId'] ?? null : null;
        if ($folderId === null) {
            return null;
        }
        return is_int($folderId) && $this->folders->has($this->currentUser->get()->id, $folderId) ? $folderId : false;
    }

    public function show(Request $request, Response $response, array $args): Response
    {
        $document = $this->documents->load($this->currentUser->get()->id, (int) $args['id']);
        return $document === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, $document);
    }

    /** Replaces the trip's content with the document sent, if it was loaded at the current version. */
    public function update(Request $request, Response $response, array $args): Response
    {
        $body = $request->getParsedBody();
        $version = is_array($body) ? ($body['version'] ?? null) : null;
        if (!is_int($version)) {
            return Json::error($response, 422, 'The document must carry the version it was loaded at.');
        }
        try {
            $document = TripDocumentValidator::validated($body);
            $saved = $this->documents->save($this->currentUser->get()->id, (int) $args['id'], $document, $version, new DateTimeImmutable());
        } catch (InvalidDocument $error) {
            return Json::error($response, 422, $error->getMessage());
        } catch (VersionConflict $conflict) {
            return Json::of($response->withStatus(409), ['error' => $conflict->getMessage(), 'version' => $conflict->currentVersion]);
        }
        return $saved === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, ['version' => $saved]);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->trips->delete($this->currentUser->get()->id, (int) $args['id']);
        return $deleted ? $response->withStatus(204) : Json::error($response, 404, 'No such trip.');
    }
}
