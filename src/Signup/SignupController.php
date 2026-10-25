<?php

declare(strict_types=1);

namespace Planner\Signup;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Account\PasswordResetController;
use Planner\Account\Users;
use Planner\Http\Redirect;
use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class SignupController
{
    public function __construct(
        private readonly Invitations $invitations,
        private readonly Users $users,
        private readonly CurrentUser $currentUser,
        private readonly View $view,
    ) {
    }

    public function show(Request $request, Response $response, array $args): Response
    {
        $invitation = $this->invitations->findValid($args['token'], new DateTimeImmutable());
        return $this->view->render($response, 'signup', ['email' => $invitation?->email]);
    }

    public function signup(Request $request, Response $response, array $args): Response
    {
        $now = new DateTimeImmutable();
        $invitation = $this->invitations->findValid($args['token'], $now);
        if ($invitation === null) {
            return $this->view->render($response, 'signup', ['email' => null]);
        }
        if ($this->users->findByEmail($invitation->email) !== null) {
            return $this->view->render($response, 'signup', ['email' => $invitation->email, 'error' => 'There is an account for this address already. Sign in instead.']);
        }
        $form = (array) $request->getParsedBody();
        $error = PasswordResetController::passwordError((string) ($form['password'] ?? ''), (string) ($form['password_repeat'] ?? ''));
        if ($error !== null) {
            return $this->view->render($response, 'signup', ['email' => $invitation->email, 'error' => $error]);
        }
        $user = $this->users->create($invitation->email, $form['password'], $now);
        $this->invitations->markUsed($invitation->id, $now);
        $this->currentUser->login($user);
        return Redirect::to($response, '/app');
    }
}
