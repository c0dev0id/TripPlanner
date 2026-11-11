<?php

declare(strict_types=1);

namespace Planner\Api;

use Planner\Account\CurrentUser;
use Planner\Account\Preferences;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The signed-in user's preferences: read, and replaced as a whole. */
final class PreferencesController
{
    /** The most a user's preferences may take, as JSON. */
    private const MAX_BYTES = 8192;

    public function __construct(
        private readonly Preferences $preferences,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function show(Request $request, Response $response): Response
    {
        return Json::of($response, $this->preferences->of($this->currentUser->get()->id));
    }

    public function replace(Request $request, Response $response): Response
    {
        $body = (string) $request->getBody();
        $preferences = json_decode($body);
        if (!is_object($preferences) || strlen($body) > self::MAX_BYTES) {
            return Json::error($response, 422, 'Preferences are a small JSON object.');
        }
        $this->preferences->set($this->currentUser->get()->id, $preferences);
        return $response->withStatus(204);
    }
}
