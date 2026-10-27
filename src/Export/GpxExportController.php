<?php

declare(strict_types=1);

namespace Planner\Export;

use DateTimeImmutable;
use Planner\Account\CurrentUser;
use Planner\Http\Json;
use Planner\Trip\TripDocuments;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use ZipArchive;

/** GPX downloads of a trip: one file, one day of it, or one file per day in a zip. */
final class GpxExportController
{
    public function __construct(private readonly TripDocuments $documents, private readonly CurrentUser $currentUser)
    {
    }

    /** The trip as one file; with `?day=<id>` that day alone. */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $document = $this->documents->load($this->currentUser->get()->id, (int) $args['id']);
        if ($document === null) {
            return Json::of($response->withStatus(404), ['error' => 'No such trip.']);
        }
        $dayId = $request->getQueryParams()['day'] ?? null;
        if ($dayId === null) {
            return self::download($response, TripGpx::fileName($document['name']) . '.gpx', 'application/gpx+xml', TripGpx::trip($document, new DateTimeImmutable()));
        }
        $index = array_search($dayId, array_column($document['days'], 'id'), true);
        if ($index === false) {
            return Json::of($response->withStatus(404), ['error' => 'No such day.']);
        }
        return self::download($response, TripGpx::dayFileName($document, $index) . '.gpx', 'application/gpx+xml', TripGpx::day($document, $index, new DateTimeImmutable()));
    }

    /** A zip with one GPX file per day. */
    public function zip(Request $request, Response $response, array $args): Response
    {
        $document = $this->documents->load($this->currentUser->get()->id, (int) $args['id']);
        if ($document === null) {
            return Json::of($response->withStatus(404), ['error' => 'No such trip.']);
        }
        $file = tempnam(sys_get_temp_dir(), 'gpx');
        $zip = new ZipArchive();
        $zip->open($file, ZipArchive::OVERWRITE);
        $now = new DateTimeImmutable();
        foreach (array_keys($document['days']) as $index) {
            $zip->addFromString(TripGpx::dayFileName($document, $index) . '.gpx', TripGpx::day($document, $index, $now));
        }
        $zip->close();
        $content = file_get_contents($file);
        unlink($file);
        return self::download($response, TripGpx::fileName($document['name']) . '.zip', 'application/zip', $content);
    }

    private static function download(Response $response, string $fileName, string $type, string $content): Response
    {
        $response->getBody()->write($content);
        return $response
            ->withHeader('Content-Type', $type)
            ->withHeader('Content-Disposition', "attachment; filename*=UTF-8''" . rawurlencode($fileName));
    }
}
