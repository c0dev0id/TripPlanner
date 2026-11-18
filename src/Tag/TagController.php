<?php

declare(strict_types=1);

namespace Planner\Tag;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Name;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The user's tags, and the trips they are on. */
final class TagController
{
    private const INVALID = 'A tag needs a name of up to 40 characters and a color.';
    private const TAKEN = 'A tag with this name already exists.';

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
        $fields = self::fields($request);
        if ($fields === null) {
            return Json::error($response, 422, self::INVALID);
        }
        $tag = $this->tags->create($this->currentUser->get()->id, ...$fields);
        return $tag === null ? Json::error($response, 409, self::TAKEN) : Json::of($response, $tag)->withStatus(201);
    }

    public function change(Request $request, Response $response, array $args): Response
    {
        $fields = self::fields($request);
        if ($fields === null) {
            return Json::error($response, 422, self::INVALID);
        }
        return $this->tags->change($this->currentUser->get()->id, (int) $args['tag'], ...$fields) ? $response->withStatus(204) : Json::error($response, 409, self::TAKEN);
    }

    /** @return ?array{string, string} the name and the colour a request gives a tag; null where either is none */
    private static function fields(Request $request): ?array
    {
        [$name, $color] = [Name::of(Json::field($request, 'name'), Tags::MAX_NAME), Tags::colorOf(Json::field($request, 'color'))];
        return $name === null || $color === null ? null : [$name, $color];
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
        return $this->tags->set($this->currentUser->get()->id, (int) $args['id'], (int) $args['tag'], $on) ? $response->withStatus(204) : Json::error($response, 404, 'Trip or tag not found.');
    }
}
