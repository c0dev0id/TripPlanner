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

/** The rides API: every ride of the user's, keeping a file as one, merging, renaming, deleting, its GPX file, the days it is on, the days rides may be of, and for a trip the rides on its days and those that may be a day's. */
final class RecordingController
{
    /** The largest file a recording may be, compressed and as GPX: a long day of one point a second with sensor data stays well below. */
    private const MAX_COMPRESSED = 20_000_000;
    private const MAX_GPX = 200_000_000;
    /** How long one answer looks through days for suggestions, in nanoseconds: well within what a server lets a request take. */
    private const SUGGESTING_NS = 3_000_000_000;

    public function __construct(
        private readonly Recordings $recordings,
        private readonly TripDocuments $documents,
        private readonly CurrentUser $currentUser,
    ) {
    }

    /** The rides on the trip's days, once for each day a ride is on. */
    public function index(Request $request, Response $response, array $args): Response
    {
        $recordings = $this->recordings->listFor($this->currentUser->get()->id, (int) $args['id']);
        return $recordings === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, $recordings);
    }

    /** Every ride of the user's, by when it began: its id, its name, its length, its line as polyline6 and the days it is on, each with its trip. */
    public function rides(Request $request, Response $response): Response
    {
        return Json::of($response, $this->recordings->rides($this->currentUser->get()->id));
    }

    /** Every ride of the user's that has a line as GeoJSON, with its name, when it began, its length and the trips it is on days of: what the map's overlay of the rides reads. */
    public function rideLines(Request $request, Response $response): Response
    {
        $rides = array_filter($this->recordings->rides($this->currentUser->get()->id), fn (array $ride) => $ride['line'] !== '');
        $features = array_map(fn (array $ride) => [
            'type' => 'Feature',
            'properties' => ['name' => $ride['name'], 'startedAt' => $ride['startedAt'], 'distanceM' => $ride['distanceM'], 'trip' => implode(', ', array_unique(array_column($ride['days'], 'trip')))],
            'geometry' => ['type' => 'LineString', 'coordinates' => Polyline::decode($ride['line'])],
        ], array_values($rides));
        return Json::of($response, ['type' => 'FeatureCollection', 'features' => $features]);
    }

    /**
     * The days of riding that may be those of the trip's day `day`, among all the user's
     * rides; `offset` is the minutes the user's clock is ahead of UTC.
     */
    public function lookup(Request $request, Response $response, array $args): Response
    {
        $query = $request->getQueryParams();
        $userId = $this->currentUser->get()->id;
        foreach ($this->documents->load($userId, (int) $args['id'])['days'] ?? [] as $day) {
            if ($day['id'] === ($query['day'] ?? null)) {
                return Json::of($response, (new Lookup($this->recordings->rides($userId), (int) ($query['offset'] ?? 0)))->of($day));
            }
        }
        return Json::error($response, 404, 'No such trip or day.');
    }

    /**
     * The days of the user's trips that rides on no day may be of, as a lookup finds them
     * for each day, without what the user declined: the trip and the day, the date of
     * the riding, whether it is the day's, the share along the routes, and the rides.
     * `offset` is the minutes the user's clock is ahead of UTC. A library's days are
     * many, so an answer covers those from the `from`th on that a few seconds take, and
     * says how many are `done` `of` all; the next request takes up from there.
     */
    public function suggestions(Request $request, Response $response): Response
    {
        $query = $request->getQueryParams();
        $userId = $this->currentUser->get()->id;
        $done = max(0, (int) ($query['from'] ?? 0));
        $suggestions = new Suggestions($this->recordings->rides($userId), $this->recordings->declined($userId), (int) ($query['offset'] ?? 0));
        $found = [];
        $until = hrtime(true) + self::SUGGESTING_NS;
        foreach ($this->documents->tripDays($userId, $done) as $day) {
            array_push($found, ...$suggestions->of($day));
            $done++;
            if (hrtime(true) > $until) {
                break;
            }
        }
        return Json::of($response, ['suggestions' => $found, 'done' => $done, 'of' => $this->documents->tripDayCount($userId)]);
    }

    /**
     * Keeps a ride from a multipart form: `name`, the GPX `file` compressed with gzip,
     * and with `dayId` the day it is put on. A file the user keeps already is not kept
     * again: the answer is then the ride it is kept as, with 200 instead of 201.
     */
    public function add(Request $request, Response $response): Response
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
        $dayId = $body['dayId'] ?? null;
        $kept = $this->recordings->keep($this->currentUser->get()->id, $name, $gzip, new DateTimeImmutable(), is_string($dayId) ? $dayId : null);
        return $kept === null ? Json::error($response, 404, 'No such day.') : Json::of($response->withStatus($kept['added'] ? 201 : 200), $kept['recording']);
    }

    /** Where the rides `ids=` (comma-separated) would be joined by a merge, with the pause and the way between them at each joint. */
    public function joints(Request $request, Response $response): Response
    {
        $ids = array_values(array_unique(array_map('intval', explode(',', (string) ($request->getQueryParams()['ids'] ?? '')))));
        $joints = $this->recordings->joints($this->currentUser->get()->id, $ids);
        return $joints === null ? Json::error($response, 404, 'No such recording.') : Json::of($response, $joints);
    }

    /**
     * Merges the user's rides `{ids}`, which follow one another, into one, which takes
     * their place on their days, and answers with it as the list of rides gives it.
     */
    public function merge(Request $request, Response $response): Response
    {
        $ids = Json::field($request, 'ids');
        if (!is_array($ids) || count($ids) < 2 || array_filter($ids, is_int(...)) !== $ids) {
            return Json::error($response, 422, 'Merging takes two recordings or more.');
        }
        $userId = $this->currentUser->get()->id;
        try {
            $id = $this->recordings->merge($userId, array_values(array_unique($ids)), new DateTimeImmutable());
        } catch (Unmergeable $refused) {
            return Json::error($response, 422, $refused->getMessage());
        }
        foreach ($this->recordings->rides($userId) as $ride) {
            if ($ride['id'] === $id) {
                return Json::of($response->withStatus(201), $ride);
            }
        }
        return Json::error($response, 404, 'No such recording.');
    }

    public function rename(Request $request, Response $response, array $args): Response
    {
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A recording needs a name of up to 200 characters.');
        }
        $renamed = $this->recordings->rename($this->currentUser->get()->id, (int) $args['recording'], $name);
        return $renamed ? $response->withStatus(204) : Json::error($response, 404, 'No such recording.');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->recordings->delete($this->currentUser->get()->id, (int) $args['recording']);
        return $deleted ? $response->withStatus(204) : Json::error($response, 404, 'No such recording.');
    }

    /** Puts the ride on a day of the user's. */
    public function link(Request $request, Response $response, array $args): Response
    {
        $linked = $this->recordings->link($this->currentUser->get()->id, (int) $args['recording'], $args['day']);
        return $linked ? $response->withStatus(204) : Json::error($response, 404, 'No such recording or day.');
    }

    /** Remembers that the ride is not of a day it was suggested for. */
    public function decline(Request $request, Response $response, array $args): Response
    {
        $declined = $this->recordings->decline($this->currentUser->get()->id, (int) $args['recording'], $args['day']);
        return $declined ? $response->withStatus(204) : Json::error($response, 404, 'No such recording or day.');
    }

    /** Takes the ride off a day, which keeps it as a ride. */
    public function unlink(Request $request, Response $response, array $args): Response
    {
        $unlinked = $this->recordings->unlink($this->currentUser->get()->id, (int) $args['recording'], $args['day']);
        return $unlinked ? $response->withStatus(204) : Json::error($response, 404, 'No such recording or day.');
    }

    /** The GPX file as kept: compressed, which the browser undoes. It never changes under its id. */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $gzip = $this->recordings->gzip($this->currentUser->get()->id, (int) $args['recording']);
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
