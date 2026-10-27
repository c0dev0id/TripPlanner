<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Account\LoginController;
use Planner\Account\PasswordResetController;
use Planner\Api\MeController;
use Planner\Export\GpxExportController;
use Planner\Pages\AppController;
use Planner\Trip\TripController;
use Planner\Signup\InvitationController;
use Planner\Signup\LandingController;
use Planner\Signup\SignupController;
use Slim\App;
use Slim\Csrf\Guard;
use Slim\Routing\RouteCollectorProxy;

final class Routes
{
    public static function register(App $app): void
    {
        $app->group('', function (RouteCollectorProxy $pages): void {
            $pages->get('/', [LandingController::class, 'show']);
            $pages->post('/waitlist', [LandingController::class, 'joinWaitlist']);
            $pages->get('/login', [LoginController::class, 'show']);
            $pages->post('/login', [LoginController::class, 'login']);
            $pages->post('/logout', [LoginController::class, 'logout']);
            $pages->get('/password/forgot', [PasswordResetController::class, 'showForgot']);
            $pages->post('/password/forgot', [PasswordResetController::class, 'sendReset']);
            $pages->get('/password/reset/{token}', [PasswordResetController::class, 'showReset']);
            $pages->post('/password/reset/{token}', [PasswordResetController::class, 'reset']);
            $pages->get('/signup/{token}', [SignupController::class, 'show']);
            $pages->post('/signup/{token}', [SignupController::class, 'signup']);
            $pages->get('/app', [AppController::class, 'show'])->add(RequireUser::class);
            $pages->group('/admin', function (RouteCollectorProxy $admin): void {
                $admin->get('/waitlist', [InvitationController::class, 'waitlist']);
                $admin->post('/invitations', [InvitationController::class, 'invite']);
            })->add(RequireAdmin::class)->add(RequireUser::class);
        })->add(Guard::class);

        $app->group('/api', function (RouteCollectorProxy $api): void {
            $api->get('/me', [MeController::class, 'show']);
            $api->get('/trips', [TripController::class, 'index']);
            $api->post('/trips', [TripController::class, 'create']);
            $api->get('/trips/{id:[0-9]+}', [TripController::class, 'show']);
            $api->put('/trips/{id:[0-9]+}', [TripController::class, 'update']);
            $api->patch('/trips/{id:[0-9]+}', [TripController::class, 'rename']);
            $api->delete('/trips/{id:[0-9]+}', [TripController::class, 'delete']);
            $api->get('/trips/{id:[0-9]+}/gpx', [GpxExportController::class, 'gpx']);
        })->add(RequireUser::class);
    }
}
