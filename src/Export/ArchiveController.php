<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Psr7\Factory\StreamFactory;

final class ArchiveController
{
    public function __construct(
        private readonly TripArchive $archive,
        private readonly CurrentUser $currentUser,
    ) {
    }

    /** The trips named by `ids` (comma-separated) as a zip to keep or to import again; see TripArchive. */
    public function zip(Request $request, Response $response): Response
    {
        $ids = (string) ($request->getQueryParams()['ids'] ?? '');
        if (preg_match('/^\d+(,\d+)*$/', $ids) !== 1) {
            return Json::error($response, 422, 'ids must be the numbers of trips, separated by commas.');
        }
        $file = tempnam(sys_get_temp_dir(), 'trips');
        try {
            $names = $this->archive->write($file, $this->currentUser->get()->id, array_map(intval(...), explode(',', $ids)), new DateTimeImmutable());
            if ($names === []) {
                return Json::error($response, 404, 'No such trip.');
            }
            $body = (new StreamFactory())->createStreamFromFile($file);
        } finally {
            // An open file outlives its name.
            unlink($file);
        }
        $name = count($names) === 1 ? TripGpx::fileName($names[0]) : 'trips';
        return $response
            ->withBody($body)
            ->withHeader('Content-Type', 'application/zip')
            ->withHeader('Content-Length', (string) $body->getSize())
            ->withHeader('Content-Disposition', "attachment; filename*=UTF-8''" . rawurlencode("$name.zip"));
    }
}
