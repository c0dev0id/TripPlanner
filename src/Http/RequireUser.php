<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Account\CurrentUser;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

/** Sends visitors without an account to sign in; API requests get 401 instead. */
final class RequireUser implements MiddlewareInterface
{
    public function __construct(
        private readonly CurrentUser $currentUser,
        private readonly ResponseFactoryInterface $responseFactory,
    ) {
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        if ($this->currentUser->get() !== null) {
            return $handler->handle($request);
        }
        if (str_starts_with($request->getUri()->getPath(), '/api/')) {
            return Json::of($this->responseFactory->createResponse(401), ['error' => 'Sign in required.']);
        }
        return Redirect::to($this->responseFactory->createResponse(), '/login');
    }
}
