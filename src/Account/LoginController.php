<?php

declare(strict_types=1);

namespace Planner\Account;

use Planner\Http\Redirect;
use Planner\Http\View;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class LoginController
{
    public function __construct(
        private readonly Users $users,
        private readonly CurrentUser $currentUser,
        private readonly View $view,
    ) {
    }

    public function show(Request $request, Response $response): Response
    {
        if ($this->currentUser->get() !== null) {
            return Redirect::to($response, '/app');
        }
        return $this->view->render($response, 'login');
    }

    public function login(Request $request, Response $response): Response
    {
        $form = (array) $request->getParsedBody();
        $email = (string) ($form['email'] ?? '');
        $user = $this->users->authenticate($email, (string) ($form['password'] ?? ''));
        if ($user === null) {
            return $this->view->render($response, 'login', ['email' => $email, 'error' => 'Unknown e-mail address or wrong password.']);
        }
        $this->currentUser->login($user);
        return Redirect::to($response, $user->mustChangePassword ? '/password/change' : '/app');
    }

    public function logout(Request $request, Response $response): Response
    {
        $this->currentUser->logout();
        return Redirect::to($response, '/');
    }
}
