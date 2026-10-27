<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Name;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The export presets API. */
final class ExportPresetController
{
    public function __construct(
        private readonly ExportPresets $presets,
        private readonly CurrentUser $currentUser,
    ) {
    }

    public function index(Request $request, Response $response): Response
    {
        return Json::of($response, $this->presets->listFor($this->currentUser->get()->id));
    }

    /** Keeps the preset of `{name, options}`, replacing one of that name. */
    public function save(Request $request, Response $response): Response
    {
        $name = Name::of(Json::field($request, 'name'));
        if ($name === null) {
            return Json::error($response, 422, 'A preset needs a name of up to 200 characters.');
        }
        $options = ExportOptions::from(Json::field($request, 'options'));
        if ($options === null) {
            return Json::error($response, 422, 'The preset\'s options are malformed.');
        }
        $preset = $this->presets->save($this->currentUser->get()->id, $name, $options, new DateTimeImmutable());
        return Json::of($response->withStatus(201), $preset);
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $deleted = $this->presets->delete($this->currentUser->get()->id, (int) $args['id']);
        return $deleted ? $response->withStatus(204) : Json::error($response, 404, 'No such preset.');
    }
}
