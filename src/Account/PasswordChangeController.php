<?php

declare(strict_types=1);

namespace Planner\Account;

use Planner\Http\Redirect;
use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The page a user with a generated password replaces it on, before anything else. */
final class PasswordChangeController
{
    public function __construct(
        private readonly Users $users,
        private readonly CurrentUser $currentUser,
        private readonly View $view,
    ) {
    }

    public function show(Request $request, Response $response): Response
    {
        return $this->elsewhere($response) ?? $this->view->render($response, 'password-change', ['email' => $this->currentUser->get()->email]);
    }

    public function change(Request $request, Response $response): Response
    {
        $redirect = $this->elsewhere($response);
        if ($redirect !== null) {
            return $redirect;
        }
        $user = $this->currentUser->get();
        $form = (array) $request->getParsedBody();
        $password = (string) ($form['password'] ?? '');
        $error = PasswordResetController::passwordError($password, (string) ($form['password_repeat'] ?? ''));
        if ($error === null && $this->users->authenticate($user->email, $password) !== null) {
            $error = 'Choose a password other than the one you were given.';
        }
        if ($error !== null) {
            return $this->view->render($response, 'password-change', ['email' => $user->email, 'error' => $error]);
        }
        $this->users->changePassword($user->id, $password);
        return Redirect::to($response, '/app');
    }

    /** Where to go instead of this page: to sign in without an account, to the planner without a password to replace. */
    private function elsewhere(Response $response): ?Response
    {
        $user = $this->currentUser->get();
        if ($user === null) {
            return Redirect::to($response, '/login');
        }
        return $user->mustChangePassword ? null : Redirect::to($response, '/app');
    }
}
