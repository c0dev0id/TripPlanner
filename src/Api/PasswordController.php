<?php

declare(strict_types=1);

namespace Planner\Api;

use Planner\Account\CurrentUser;
use Planner\Account\PasswordResetController;
use Planner\Account\Users;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The signed-in user's password, changed from the planner with the one in use. */
final class PasswordController
{
    public function __construct(
        private readonly Users $users,
        private readonly CurrentUser $currentUser,
    ) {
    }

    /** Sets `password`, given twice as `password` and `repeat`, once `current` is the password in use. */
    public function change(Request $request, Response $response): Response
    {
        $user = $this->currentUser->get();
        if ($this->users->authenticate($user->email, (string) Json::field($request, 'current')) === null) {
            return Json::error($response, 403, 'The current password is not right.');
        }
        $password = (string) Json::field($request, 'password');
        $error = PasswordResetController::passwordError($password, (string) Json::field($request, 'repeat'));
        if ($error !== null) {
            // The reason is in the request's language already.
            return Json::of($response->withStatus(422), ['error' => $error]);
        }
        $this->users->changePassword($user->id, $password);
        return $response->withStatus(204);
    }
}
