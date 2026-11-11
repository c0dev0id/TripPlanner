<?php

declare(strict_types=1);

namespace Planner\Http;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\Psr7\Factory\StreamFactory;

/** Compresses JSON answers with gzip for a client that takes it: httpd compresses nothing PHP answers. */
final class GzipJson implements MiddlewareInterface
{
    /** Below this many bytes an answer goes out as it is. */
    private const MIN_BYTES = 1024;

    public function process(Request $request, Handler $handler): Response
    {
        $response = $handler->handle($request);
        $takesGzip = preg_match('/\bgzip\b(?!\s*;\s*q=0(\.0*)?\s*(,|$))/', $request->getHeaderLine('Accept-Encoding')) === 1;
        if (!$takesGzip || $response->getHeaderLine('Content-Type') !== 'application/json' || $response->getBody()->getSize() < self::MIN_BYTES) {
            return $response;
        }
        return $response
            ->withBody((new StreamFactory())->createStream(gzencode((string) $response->getBody(), 6)))
            ->withHeader('Content-Encoding', 'gzip')
            ->withHeader('Vary', 'Accept-Encoding');
    }
}
