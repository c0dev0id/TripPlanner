<?php

declare(strict_types=1);

namespace Planner\Poi;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The places API: the places of a tile, of the kinds asked for, and the user's own places. */
final class PlacesController
{
    public function __construct(
        private readonly Places $places,
        private readonly Kinds $kinds,
        private readonly OwnPlaces $ownPlaces,
        private readonly CurrentUser $currentUser,
    ) {
    }

    /** The places the user keeps in the lists of the folder for places. */
    public function own(Request $request, Response $response): Response
    {
        return Json::of($response, $this->ownPlaces->of($this->currentUser->get()->id));
    }

    /** The places of the tile whose kind is among `?kinds=`, a comma-separated list. They change when a cron job fetches an area again, so a day old is new enough. */
    public function tile(Request $request, Response $response, array $args): Response
    {
        $asked = explode(',', (string) ($request->getQueryParams()['kinds'] ?? ''));
        $kinds = array_values(array_intersect($this->kinds->ids(), $asked));
        return Json::of($response, $this->places->inTile((int) $args['x'], (int) $args['y'], $kinds))->withHeader('Cache-Control', 'private, max-age=86400');
    }
}
