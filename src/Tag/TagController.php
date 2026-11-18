<?php

declare(strict_types=1);

namespace Planner\Tag;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The user's tags, and the trips they are on. */
final class TagController
{
    private const INVALID = 'A tag needs a name of up to 40 characters and a color.';
    private const TAKEN = 'There is a tag of that name already.';

    public function __construct(
        private readonly Tags $tags,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        return Json::of($response, $this->tags->listFor($this->currentUser->get()->id));
    }

    public function create(Request $request, Response $response): Response
    {
        [$name, $color] = [Tags::nameOf(Json::field($request, 'name')), Tags::colorOf(Json::field($request, 'color'))];
        if ($name === null || $color === null) {
            return Json::error($response, 422, self::INVALID);
        }
        $tag = $this->tags->create($this->currentUser->get()->id, $name, $color);
        return $tag === null ? Json::error($response, 409, self::TAKEN) : Json::of($response, $tag)->withStatus(201);
    }

    public function change(Request $request, Response $response, array $args): Response
    {
        [$name, $color] = [Tags::nameOf(Json::field($request, 'name')), Tags::colorOf(Json::field($request, 'color'))];
        if ($name === null || $color === null) {
            return Json::error($response, 422, self::INVALID);
        }
        return $this->tags->change($this->currentUser->get()->id, (int) $args['tag'], $name, $color) ? $response->withStatus(204) : Json::error($response, 409, self::TAKEN);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        return $this->tags->delete($this->currentUser->get()->id, (int) $args['tag']) ? $response->withStatus(204) : Json::error($response, 404, 'Tag not found.');
    }

    /** Puts the tag on the trip. */
    public function put(Request $request, Response $response, array $args): Response
    {
        return $this->set($response, $args, true);
    }

    /** Takes the tag off the trip. */
    public function take(Request $request, Response $response, array $args): Response
    {
        return $this->set($response, $args, false);
    }

    private function set(Response $response, array $args, bool $on): Response
    {
        return $this->tags->put($this->currentUser->get()->id, (int) $args['id'], (int) $args['tag'], $on) ? $response->withStatus(204) : Json::error($response, 404, 'Trip or tag not found.');
    }
}
