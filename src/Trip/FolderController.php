<?php

declare(strict_types=1);

namespace Planner\Trip;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Name;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The folders API of the library. */
final class FolderController
{
    public function __construct(
        private readonly Folders $folders,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        return Json::of($response, $this->folders->listFor($this->currentUser->get()->id));
    }

    public function create(Request $request, Response $response): Response
    {
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A folder needs a name of up to 200 characters.');
        }
        $parentId = Json::field($request, 'parentId');
        if ($parentId !== null && !is_int($parentId)) {
            return Json::error($response, 422, 'parentId must be a number or null.');
        }
        try {
            $folder = $this->folders->create($this->currentUser->get()->id, $name, $parentId, new DateTimeImmutable());
        } catch (UnknownFolder $unknown) {
            return Json::error($response, 422, $unknown->getMessage());
        }
        return Json::of($response->withStatus(201), $folder);
    }

    public function rename(Request $request, Response $response, array $args): Response
    {
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A folder needs a name of up to 200 characters.');
        }
        $renamed = $this->folders->rename($this->currentUser->get()->id, (int) $args['id'], $name);
        return $renamed ? $response->withStatus(204) : Json::error($response, 404, 'No such folder.');
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->folders->delete($this->currentUser->get()->id, (int) $args['id']);
        return $deleted ? $response->withStatus(204) : Json::error($response, 404, 'No such folder.');
    }
}
