<?php

declare(strict_types=1);

namespace Planner\Share;

use DateTimeImmutable;
use Planner\Export\GpxExportController;
use Planner\Export\TripGpx;
use Planner\Http\Json;
use Planner\Journal\Entries;
use Planner\Journal\EntryFiles;
use Planner\Trip\TripDocuments;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/** The read-only API of a trip shared under a token: its document, its GPX file, and its journal with its files once that is published. No sign-in. */
final class SharedTripController
{
    public function __construct(
        private readonly TripDocuments $documents,
        private readonly Publications $publications,
        private readonly Entries $entries,
        private readonly EntryFiles $files,
    ) {
    }

    public function document(Request $request, Response $response, array $args): Response
    {
        $document = $this->publicDocument($args['token']);
        return $document === null ? Json::error($response, 404, 'This trip is not shared.') : Json::of($response, $document);
    }

    /** The trip as one GPX file, written as an export without options is, where its page offers it. */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $document = $this->publicDocument($args['token']);
        if ($document === null || !$document['public']['gpx']) {
            return Json::error($response, 404, 'This trip is not shared.');
        }
        return GpxExportController::download($response, TripGpx::fileName($document['name']) . '.gpx', 'application/gpx+xml', TripGpx::trip($document, new DateTimeImmutable()));
    }

    /** The journal, empty until it is published. */
    public function entries(Request $request, Response $response, array $args): Response
    {
        if ($this->publications->shared($args['token']) === null) {
            return Json::error($response, 404, 'This trip is not shared.');
        }
        return Json::of($response, array_map(PublicTrip::entry(...), $this->entries->listShared($args['token'])));
    }

    public function file(Request $request, Response $response, array $args): Response
    {
        return $this->files->file($response, $this->entries->findShared($args['token'], (int) $args['entry']));
    }

    public function preview(Request $request, Response $response, array $args): Response
    {
        return $this->files->preview($response, $this->entries->findShared($args['token'], (int) $args['entry']));
    }

    private function publicDocument(string $token): ?array
    {
        $document = $this->documents->loadShared($token);
        return $document === null ? null : PublicTrip::document($document, $this->publications->shared($token));
    }
}
