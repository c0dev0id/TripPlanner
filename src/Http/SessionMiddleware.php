<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Config;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

/**
 * Starts the PHP session with a Lax, HttpOnly cookie that is Secure under HTTPS. Cookie and
 * session data last the configured time from the last request.
 */
final class SessionMiddleware implements MiddlewareInterface
{
    private const NAME = 'planner';

    public function __construct(private readonly Config $config)
    {
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        $dir = $this->config->dataDir . '/sessions';
        if (!is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
        session_save_path($dir);
        ini_set('session.gc_maxlifetime', (string) $this->config->sessionTtl);
        $cookie = [
            'path' => '/',
            'secure' => str_starts_with($this->config->baseUrl, 'https://'),
            'httponly' => true,
            'samesite' => 'Lax',
        ];
        session_name(self::NAME);
        session_set_cookie_params(['lifetime' => $this->config->sessionTtl] + $cookie);
        ini_set('session.use_strict_mode', '1');
        session_start();
        // PHP sends the cookie only with a new session id; a session that continues gets it again.
        if (session_id() === ($request->getCookieParams()[self::NAME] ?? null)) {
            setcookie(self::NAME, session_id(), ['expires' => time() + $this->config->sessionTtl] + $cookie);
        }
        return $handler->handle($request);
    }
}
