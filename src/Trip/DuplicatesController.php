<?php

declare(strict_types=1);

namespace Planner\Trip;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The report of the routes the user's library keeps more than once. */
final class DuplicatesController
{
    public function __construct(
        private readonly Duplicates $duplicates,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        return Json::of($response, $this->duplicates->of($this->currentUser->get()->id));
    }

    /** The lines of the routes named by `routes=` (comma-separated ids), by id; an object, also where it is empty. */
    public function lines(Request $request, Response $response): Response
    {
        $ids = explode(',', (string) ($request->getQueryParams()['routes'] ?? ''));
        return Json::of($response, (object) $this->duplicates->lines($this->currentUser->get()->id, $ids));
    }
}
