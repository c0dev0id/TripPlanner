<?php

declare(strict_types=1);

namespace Planner\Recording;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Export\Polyline;
use Planner\Http\Json;
use Planner\Name;
use Planner\Trip\TripDocuments;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\UploadedFileInterface;

/** The recordings API of a trip: the list, adding one to a day, renaming, moving, deleting, a recording's GPX file, and the recordings that may be a day's. */
final class RecordingController
{
    /** The largest file a recording may be, compressed and as GPX: a long day of one point a second with sensor data stays well below. */
    private const MAX_COMPRESSED = 20_000_000;
    private const MAX_GPX = 200_000_000;

    public function __construct(
        private readonly Recordings $recordings,
        private readonly TripDocuments $documents,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response, array $args): Response
    {
        $recordings = $this->recordings->listFor($this->currentUser->get()->id, (int) $args['id']);
        return $recordings === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, $recordings);
    }

    /** Every ride of the user's as GeoJSON, a line each with its name, when it began, its length and where it is kept: what the map's overlay of the rides reads. */
    public function rides(Request $request, Response $response): Response
    {
        $features = array_map(fn (array $ride) => [
            'type' => 'Feature',
            'properties' => ['name' => $ride['name'], 'startedAt' => $ride['startedAt'], 'distanceM' => $ride['distanceM'], 'trip' => $ride['trip']],
            'geometry' => ['type' => 'LineString', 'coordinates' => Polyline::decode($ride['line'])],
        ], $this->recordings->rides($this->currentUser->get()->id));
        return Json::of($response, ['type' => 'FeatureCollection', 'features' => $features]);
    }

    /**
     * The recordings waiting in the folder for recordings that may be those of the day
     * `day`; `offset` is the minutes the user's clock is ahead of UTC.
     */
    public function lookup(Request $request, Response $response, array $args): Response
    {
        $query = $request->getQueryParams();
        $userId = $this->currentUser->get()->id;
        foreach ($this->documents->load($userId, (int) $args['id'])['days'] ?? [] as $day) {
            if ($day['id'] === ($query['day'] ?? null)) {
                return Json::of($response, Lookup::of($day, $this->recordings->unassigned($userId), (int) ($query['offset'] ?? 0)));
            }
        }
        return Json::error($response, 404, 'No such trip or day.');
    }

    /**
     * Adds a recording from a multipart form: `dayId`, `name`, and the GPX `file`
     * compressed with gzip. With `unlessKept`, a file the user keeps already is not kept
     * again, and the answer is empty.
     */
    public function add(Request $request, Response $response, array $args): Response
    {
        $body = (array) $request->getParsedBody();
        $name = Name::of($body['name'] ?? null);
        if ($name === null) {
            return Json::error($response, 422, 'A recording needs a name of up to 200 characters.');
        }
        $upload = $request->getUploadedFiles()['file'] ?? null;
        if (!$upload instanceof UploadedFileInterface || $upload->getError() !== UPLOAD_ERR_OK || $upload->getSize() > self::MAX_COMPRESSED) {
            return Json::error($response, 422, 'The recording did not arrive, or is too large.');
        }
        $gzip = (string) $upload->getStream();
        $gpx = @gzdecode($gzip, self::MAX_GPX);
        if ($gpx === false || preg_match('/<gpx[\s>]/', substr($gpx, 0, 4096)) !== 1) {
            return Json::error($response, 422, 'A recording is a GPX file compressed with gzip.');
        }
        try {
            $recording = $this->recordings->add($this->currentUser->get()->id, (int) $args['id'], (string) ($body['dayId'] ?? ''), $name, $gzip, new DateTimeImmutable(), isset($body['unlessKept']));
        } catch (AlreadyKept) {
            return $response->withStatus(204);
        }
        return $recording === null ? Json::error($response, 404, 'No such trip or day.') : Json::of($response->withStatus(201), $recording);
    }

    /** Renames the recording from `name`, or puts it on another day, of this trip or another of the user's, from `dayId`. */
    public function change(Request $request, Response $response, array $args): Response
    {
        $dayId = Json::field($request, 'dayId');
        if ($dayId !== null) {
            $moved = is_string($dayId) && $this->recordings->move($this->currentUser->get()->id, (int) $args['id'], (int) $args['recording'], $dayId);
            return $moved ? $response->withStatus(204) : Json::error($response, 404, 'No such recording or day.');
        }
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A recording needs a name of up to 200 characters.');
        }
        $renamed = $this->recordings->rename($this->currentUser->get()->id, (int) $args['id'], (int) $args['recording'], $name);
        return $renamed ? $response->withStatus(204) : Json::error($response, 404, 'No such recording.');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->recordings->delete($this->currentUser->get()->id, (int) $args['id'], (int) $args['recording']);
        return $deleted ? $response->withStatus(204) : Json::error($response, 404, 'No such recording.');
    }

    /** The GPX file as kept: compressed, which the browser undoes. It never changes under its id. */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $gzip = $this->recordings->gzip($this->currentUser->get()->id, (int) $args['id'], (int) $args['recording']);
        if ($gzip === null) {
            return Json::error($response, 404, 'No such recording.');
        }
        $response->getBody()->write($gzip);
        return $response
            ->withHeader('Content-Type', 'application/gpx+xml')
            ->withHeader('Content-Encoding', 'gzip')
            ->withHeader('Cache-Control', 'private, max-age=86400');
    }
}
