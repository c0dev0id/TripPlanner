<?php

declare(strict_types=1);

namespace Planner\Http;

use Planner\Account\LoginController;
use Planner\Account\PasswordChangeController;
use Planner\Account\PasswordResetController;
use Planner\Api\MeController;
use Planner\Export\ExportPresetController;
use Planner\Export\GpxExportController;
use Planner\Journal\JournalController;
use Planner\Pages\AppController;
use Planner\Pages\TripViewController;
use Planner\Recording\RecordingController;
use Planner\Share\SharedTripController;
use Planner\Trip\DuplicatesController;
use Planner\Trip\FolderController;
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
            $pages->get('/password/change', [PasswordChangeController::class, 'show']);
            $pages->post('/password/change', [PasswordChangeController::class, 'change']);
            $pages->get('/signup/{token}', [SignupController::class, 'show']);
            $pages->post('/signup/{token}', [SignupController::class, 'signup']);
            $pages->get('/app', [AppController::class, 'show'])->add(RequireUser::class);
            $pages->get('/trips/{id:[0-9]+}', [TripViewController::class, 'own'])->add(RequireUser::class);
            $pages->get('/t/{token:[0-9a-f]{32}}', [TripViewController::class, 'shared']);
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
            $api->post('/trips/{id:[0-9]+}/copies', [TripController::class, 'duplicate']);
            $api->post('/trips/{id:[0-9]+}/merge', [TripController::class, 'merge']);
            $api->patch('/trips/{id:[0-9]+}', [TripController::class, 'change']);
            $api->delete('/trips/{id:[0-9]+}', [TripController::class, 'delete']);
            $api->get('/trips/{id:[0-9]+}/gpx', [GpxExportController::class, 'gpx']);
            $api->get('/trips/{id:[0-9]+}/share', [TripController::class, 'showShare']);
            $api->post('/trips/{id:[0-9]+}/share', [TripController::class, 'share']);
            $api->delete('/trips/{id:[0-9]+}/share', [TripController::class, 'unshare']);
            $api->get('/trips/{id:[0-9]+}/entries', [JournalController::class, 'index']);
            $api->post('/trips/{id:[0-9]+}/entries', [JournalController::class, 'add']);
            $api->patch('/trips/{id:[0-9]+}/entries/{entry:[0-9]+}', [JournalController::class, 'update']);
            $api->delete('/trips/{id:[0-9]+}/entries/{entry:[0-9]+}', [JournalController::class, 'delete']);
            $api->get('/trips/{id:[0-9]+}/entries/{entry:[0-9]+}/file', [JournalController::class, 'file']);
            $api->get('/trips/{id:[0-9]+}/entries/{entry:[0-9]+}/preview', [JournalController::class, 'preview']);
            $api->get('/trips/{id:[0-9]+}/recordings', [RecordingController::class, 'index']);
            $api->post('/trips/{id:[0-9]+}/recordings', [RecordingController::class, 'add']);
            $api->patch('/trips/{id:[0-9]+}/recordings/{recording:[0-9]+}', [RecordingController::class, 'rename']);
            $api->delete('/trips/{id:[0-9]+}/recordings/{recording:[0-9]+}', [RecordingController::class, 'delete']);
            $api->get('/trips/{id:[0-9]+}/recordings/{recording:[0-9]+}/gpx', [RecordingController::class, 'gpx']);
            $api->get('/export-presets', [ExportPresetController::class, 'index']);
            $api->post('/export-presets', [ExportPresetController::class, 'save']);
            $api->delete('/export-presets/{id:[0-9]+}', [ExportPresetController::class, 'delete']);
            $api->get('/duplicates', [DuplicatesController::class, 'index']);
            $api->get('/folders', [FolderController::class, 'index']);
            $api->post('/folders', [FolderController::class, 'create']);
            $api->patch('/folders/{id:[0-9]+}', [FolderController::class, 'change']);
            $api->delete('/folders/{id:[0-9]+}', [FolderController::class, 'delete']);
        })->add(RequireUser::class);

        $app->group('/api/shared/{token:[0-9a-f]{32}}', function (RouteCollectorProxy $shared): void {
            $shared->get('', [SharedTripController::class, 'document']);
            $shared->get('/entries', [SharedTripController::class, 'entries']);
            $shared->get('/entries/{entry:[0-9]+}/file', [SharedTripController::class, 'file']);
            $shared->get('/entries/{entry:[0-9]+}/preview', [SharedTripController::class, 'preview']);
        });
    }
}
