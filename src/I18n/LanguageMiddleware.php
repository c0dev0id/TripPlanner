<?php

declare(strict_types=1);

namespace Planner\I18n;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

/** Sets the request's language, before anything answers in words: a `lang` query parameter, as a download link names it, else the Accept-Language header. */
final class LanguageMiddleware implements MiddlewareInterface
{
    public function process(Request $request, RequestHandler $handler): Response
    {
        $language = $request->getQueryParams()['lang'] ?? null;
        Language::set(is_string($language) && $language !== '' ? $language : Language::fromHeader($request->getHeaderLine('Accept-Language')));
        return $handler->handle($request);
    }
}
