<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class LandingController
{
    public function __construct(private readonly Waitlist $waitlist, private readonly View $view)
    {
    }

    public function show(Request $request, Response $response): Response
    {
        return $this->view->render($response, 'landing');
    }

    public function joinWaitlist(Request $request, Response $response): Response
    {
        $form = (array) $request->getParsedBody();
        $email = trim((string) ($form['email'] ?? ''));
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return $this->view->render($response, 'landing', ['email' => $email, 'error' => 'That is not an e-mail address.']);
        }
        $this->waitlist->join($email, new DateTimeImmutable());
        return $this->view->render($response, 'landing', ['notice' => 'You are on the list. The invitation comes by mail.']);
    }
}
