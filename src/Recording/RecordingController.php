<?php

declare(strict_types=1);

namespace Planner\Recording;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Name;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\UploadedFileInterface;

/** The recordings API of a trip: the list, adding one to a day, renaming, deleting, and a recording's GPX file. */
final class RecordingController
{
    /** The largest file a recording may be, compressed and as GPX: a long day of one point a second with sensor data stays well below. */
    private const MAX_COMPRESSED = 20_000_000;
    private const MAX_GPX = 200_000_000;

    public function __construct(
        private readonly Recordings $recordings,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response, array $args): Response
    {
        $recordings = $this->recordings->listFor($this->currentUser->get()->id, (int) $args['id']);
        return $recordings === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, $recordings);
    }

    /** Adds a recording from a multipart form: `dayId`, `name`, and the GPX `file` compressed with gzip. */
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
        $recording = $this->recordings->add($this->currentUser->get()->id, (int) $args['id'], (string) ($body['dayId'] ?? ''), $name, $gzip, new DateTimeImmutable());
        return $recording === null ? Json::error($response, 404, 'No such trip or day.') : Json::of($response->withStatus(201), $recording);
    }

    public function rename(Request $request, Response $response, array $args): Response
    {
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
