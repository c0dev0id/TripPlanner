<?php

declare(strict_types=1);

namespace Planner\Poi;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The API of the places found along a trip's routes: the list, keeping what a search found for a route and kind, forgetting it. */
final class RoutePoisController
{
    /** The most places kept for a route and kind, and the farthest a search reaches, in metres. */
    private const MAX_PLACES = 5000;
    private const MAX_REACH_M = 50_000;

    public function __construct(
        private readonly RoutePoisStore $store,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response, array $args): Response
    {
        $found = $this->store->listFor($this->currentUser->get()->id, (int) $args['id']);
        return $found === null ? Json::error($response, 404, 'No such trip.') : Json::of($response, $found);
    }

    /** Keeps `{reachM, lineMark, places}` for the route and kind of the path. */
    public function keep(Request $request, Response $response, array $args): Response
    {
        $reachM = Json::field($request, 'reachM');
        $lineMark = Json::field($request, 'lineMark');
        $places = self::places(Json::field($request, 'places'));
        if (!is_int($reachM) || $reachM < 1 || $reachM > self::MAX_REACH_M || !is_string($lineMark) || strlen($lineMark) > 64 || $places === null) {
            return Json::error($response, 422, 'What a POI search found is a distance, the mark of a line and a list of places.');
        }
        $kept = $this->store->keep($this->currentUser->get()->id, (int) $args['id'], $args['route'], $args['category'], $reachM, $lineMark, $places, new DateTimeImmutable());
        return $kept ? $response->withStatus(204) : Json::error($response, 404, 'No such trip or route.');
    }

    public function forget(Request $request, Response $response, array $args): Response
    {
        $forgotten = $this->store->forget($this->currentUser->get()->id, (int) $args['id'], $args['route'], $args['category']);
        return $forgotten ? $response->withStatus(204) : Json::error($response, 404, 'Nothing is kept for this route and kind.');
    }

    /**
     * The places of a request, each with its id, position and tags and nothing else; null
     * where the value is no such list.
     *
     * @return ?list<array{id: string, lngLat: array{float, float}, tags: array<string, string>}>
     */
    private static function places(mixed $value): ?array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) > self::MAX_PLACES) {
            return null;
        }
        $places = [];
        foreach ($value as $place) {
            $id = $place['id'] ?? null;
            $lngLat = $place['lngLat'] ?? null;
            $tags = $place['tags'] ?? null;
            $isPosition = is_array($lngLat) && array_is_list($lngLat) && count($lngLat) === 2 && (is_int($lngLat[0]) || is_float($lngLat[0])) && (is_int($lngLat[1]) || is_float($lngLat[1]));
            if (!is_string($id) || strlen($id) > 40 || !$isPosition || !is_array($tags) || array_filter($tags, fn (mixed $tag) => !is_string($tag)) !== []) {
                return null;
            }
            $places[] = ['id' => $id, 'lngLat' => [(float) $lngLat[0], (float) $lngLat[1]], 'tags' => (object) $tags];
        }
        return $places;
    }
}
