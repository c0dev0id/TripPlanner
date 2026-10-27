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
        private readonly TripDocuments $documents,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        $summaries = $this->trips->listFor($this->currentUser->get()->id);
        return Json::of($response, array_map(fn (TripSummary $trip) => $trip->toArray(), $summaries));
    }

    public function create(Request $request, Response $response): Response
    {
        $name = self::name($request);
        if ($name === null) {
            return Json::of($response->withStatus(422), ['error' => 'A trip needs a name.']);
        }
        $trip = $this->trips->create($this->currentUser->get()->id, $name, new DateTimeImmutable());
        return Json::of($response->withStatus(201), $trip->toArray());
    }

    public function show(Request $request, Response $response, array $args): Response
    {
        $document = $this->documents->load($this->currentUser->get()->id, (int) $args['id']);
        return $document === null ? self::notFound($response) : Json::of($response, $document);
    }

    /** Replaces the trip's content with the document sent, if it was loaded at the current version. */
    public function update(Request $request, Response $response, array $args): Response
    {
        $body = $request->getParsedBody();
        $version = is_array($body) ? ($body['version'] ?? null) : null;
        if (!is_int($version)) {
            return Json::of($response->withStatus(422), ['error' => 'The document must carry the version it was loaded at.']);
        }
        try {
            $document = TripDocumentValidator::validated($body);
            $saved = $this->documents->save($this->currentUser->get()->id, (int) $args['id'], $document, $version, new DateTimeImmutable());
        } catch (InvalidDocument $error) {
            return Json::of($response->withStatus(422), ['error' => $error->getMessage()]);
        } catch (VersionConflict $conflict) {
            return Json::of($response->withStatus(409), ['error' => $conflict->getMessage(), 'version' => $conflict->currentVersion]);
        }
        return $saved === null ? self::notFound($response) : Json::of($response, ['version' => $saved]);
    }

    public function rename(Request $request, Response $response, array $args): Response
    {
        $name = self::name($request);
        if ($name === null) {
            return Json::of($response->withStatus(422), ['error' => 'A trip needs a name.']);
        }
        $renamed = $this->trips->rename($this->currentUser->get()->id, (int) $args['id'], $name, new DateTimeImmutable());
        return $renamed ? Json::of($response, ['name' => $name]) : self::notFound($response);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->trips->delete($this->currentUser->get()->id, (int) $args['id']);
        return $deleted ? $response->withStatus(204) : self::notFound($response);
    }

    /** The trimmed name in the request body, or null where there is none. */
    private static function name(Request $request): ?string
    {
        $body = $request->getParsedBody();
        $name = is_array($body) && is_string($body['name'] ?? null) ? trim($body['name']) : '';
        return $name === '' || strlen($name) > 200 ? null : $name;
    }

    private static function notFound(Response $response): Response
    {
        return Json::of($response->withStatus(404), ['error' => 'No such trip.']);
    }
}
