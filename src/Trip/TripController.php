<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Journal\FileStore;
use Planner\Name;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The trips API: the library's list and the trip document. */
final class TripController
{
    public function __construct(
        private readonly Trips $trips,
        private readonly TripDocuments $documents,
        private readonly FileStore $files,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        return Json::of($response, $this->trips->listFor($this->currentUser->get()->id));
    }

    public function create(Request $request, Response $response): Response
    {
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A trip needs a name of up to 200 characters.');
        }
        $folderId = Json::field($request, 'folderId');
        if ($folderId !== null && !is_int($folderId)) {
            return Json::error($response, 422, 'folderId must be a number or null.');
        }
        try {
            $trip = $this->trips->create($this->currentUser->get()->id, $name, new DateTimeImmutable(), $folderId);
        } catch (UnknownFolder $unknown) {
            return Json::error($response, 422, $unknown->getMessage());
        }
        return Json::of($response->withStatus(201), $trip);
    }

    /** A copy of the trip with all its days, named after it, in its folder; the answer is the copy's id. */
    public function duplicate(Request $request, Response $response, array $args): Response
    {
        $copyId = $this->documents->copy($this->currentUser->get()->id, (int) $args['id'], new DateTimeImmutable());
        return $copyId === null ? Json::error($response, 404, 'No such trip.') : Json::of($response->withStatus(201), ['id' => $copyId]);
    }

    /** Renames the trip where the body has a `name`; else puts it into the folder `folderId` names, or into none for null. */
    public function change(Request $request, Response $response, array $args): Response
    {
        $body = (array) $request->getParsedBody();
        if (array_key_exists('name', $body)) {
            $name = Name::of($body['name']);
            if ($name === null) {
                return Json::error($response, 422, 'A trip needs a name of up to 200 characters.');
            }
            $renamed = $this->trips->rename($this->currentUser->get()->id, (int) $args['id'], $name, new DateTimeImmutable());
            return $renamed ? $response->withStatus(204) : Json::error($response, 404, 'No such trip.');
        }
        $folderId = $body['folderId'] ?? null;
        if ($folderId !== null && !is_int($folderId)) {
            return Json::error($response, 422, 'folderId must be a number or null.');
        }
        try {
            $moved = $this->trips->move($this->currentUser->get()->id, (int) $args['id'], $folderId);
        } catch (UnknownFolder $unknown) {
            return Json::error($response, 422, $unknown->getMessage());
        }
        return $moved ? $response->withStatus(204) : Json::error($response, 404, 'No such trip.');
    }

    /** The token the trip is shared under, or null. */
    public function showShare(Request $request, Response $response, array $args): Response
    {
        return Json::of($response, ['token' => $this->trips->shareToken($this->currentUser->get()->id, (int) $args['id'])]);
    }

    /** Makes the trip's read-only page public; the answer is its token. */
    public function share(Request $request, Response $response, array $args): Response
    {
        $token = $this->trips->share($this->currentUser->get()->id, (int) $args['id']);
        return $token === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, ['token' => $token]);
    }

    public function unshare(Request $request, Response $response, array $args): Response
    {
        $unshared = $this->trips->unshare($this->currentUser->get()->id, (int) $args['id']);
        return $unshared ? $response->withStatus(204) : Json::error($response, 404, 'No such trip.');
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
        $version = Json::field($request, 'version');
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

    /** Deletes the trip with everything in it, its journal's files included. */
    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->trips->delete($this->currentUser->get()->id, (int) $args['id']);
        if (!$deleted) {
            return Json::error($response, 404, 'No such trip.');
        }
        $this->files->deleteAll((int) $args['id']);
        return $response->withStatus(204);
    }
}
