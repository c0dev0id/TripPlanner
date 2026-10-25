<?php

declare(strict_types=1);

namespace Planner\Http;

use Psr\Http\Message\ResponseInterface as Response;

final class Redirect
{
    public static function to(Response $response, string $location): Response
    {
        return $response->withStatus(303)->withHeader('Location', $location);
    }
}
