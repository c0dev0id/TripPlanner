<?php

declare(strict_types=1);

namespace Planner\Http;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class Json
{
    private const FLAGS = JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;

    public static function encode(mixed $data): string
    {
        return json_encode($data, self::FLAGS);
    }

    public static function of(Response $response, mixed $data): Response
    {
        $response->getBody()->write(self::encode($data));
        return $response->withHeader('Content-Type', 'application/json');
    }

    /** A field of the request's JSON body; null where the body is no object or lacks the field. */
    public static function field(Request $request, string $name): mixed
    {
        $body = $request->getParsedBody();
        return is_array($body) ? $body[$name] ?? null : null;
    }

    /** An error answer: the status, and the message under `error`. */
    public static function error(Response $response, int $status, string $message): Response
    {
        return self::of($response->withStatus($status), ['error' => $message]);
    }
}
