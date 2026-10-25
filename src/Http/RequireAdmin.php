<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Account\CurrentUser;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

/** Runs after RequireUser; answers 403 to users who are not admins. */
final class RequireAdmin implements MiddlewareInterface
{
    public function __construct(
        private readonly CurrentUser $currentUser,
        private readonly ResponseFactoryInterface $responseFactory,
    ) {
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        if ($this->currentUser->get()?->isAdmin) {
            return $handler->handle($request);
        }
        $response = $this->responseFactory->createResponse(403)->withHeader('Content-Type', 'text/plain');
        $response->getBody()->write('Admins only.');
        return $response;
    }
}
