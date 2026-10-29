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
}
