<?php

declare(strict_types=1);

namespace Planner\Api;

use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class MeController
{
    public function __construct(private readonly CurrentUser $currentUser)
    {
    }

    public function show(Request $request, Response $response): Response
    {
        $user = $this->currentUser->get();
        return Json::of($response, ['email' => $user->email, 'isAdmin' => $user->isAdmin]);
    }
}
