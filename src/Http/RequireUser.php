<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Account\CurrentUser;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

/**
 * Lets through users with a password of their own: visitors without an account are sent
 * to sign in, and users who still have the password they were handed over with to replace
 * it. API requests get 401 and 403 instead.
 */
final class RequireUser implements MiddlewareInterface
{
    public function __construct(
        private readonly CurrentUser $currentUser,
        private readonly ResponseFactoryInterface $responseFactory,
    ) {
    }

    public function process(Request $request, RequestHandler $handler): Response
    {
        $user = $this->currentUser->get();
        if ($user !== null && !$user->mustChangePassword) {
            return $handler->handle($request);
        }
        $response = $this->responseFactory->createResponse();
        if (str_starts_with($request->getUri()->getPath(), '/api/')) {
            return $user === null ? Json::error($response, 401, 'Sign in required.') : Json::error($response, 403, 'Choose your own password first.');
        }
        return Redirect::to($response, $user === null ? '/login' : '/password/change');
    }
}
