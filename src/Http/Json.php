<?php

declare(strict_types=1);

namespace Planner\Http;

use Psr\Http\Message\ResponseInterface as Response;

final class Json
{
    public static function of(Response $response, mixed $data): Response
    {
        $response->getBody()->write(json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
