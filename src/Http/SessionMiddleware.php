<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Config;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

/** Starts the PHP session with a Lax, HttpOnly cookie that is Secure under HTTPS. */
final class SessionMiddleware implements MiddlewareInterface
{
    public function __construct(private readonly Config $config)
    {
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        session_name('planner');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => str_starts_with($this->config->baseUrl, 'https://'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        ini_set('session.use_strict_mode', '1');
        session_start();
        return $handler->handle($request);
    }
}
