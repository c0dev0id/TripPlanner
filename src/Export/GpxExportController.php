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

    /**
     * The trip as one file; with `?day=<id>` that day alone; with `?per=day` a zip of one
     * file per day. `form`, `optional` and `reach` are the options (see ExportOptions).
     */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $document = $this->documents->load($this->currentUser->get()->id, (int) $args['id']);
        if ($document === null) {
            return Json::error($response, 404, 'No such trip.');
        }
        $query = $request->getQueryParams();
        $options = ExportOptions::fromQuery($query);
        if ($options === null) {
            return Json::error($response, 422, 'The export options are malformed.');
        }
        if (($query['per'] ?? null) === 'day') {
            return self::zip($response, $document, $options);
        }
        $dayId = $query['day'] ?? null;
        if ($dayId === null) {
            return self::download($response, TripGpx::fileName($document['name']) . '.gpx', 'application/gpx+xml', TripGpx::trip($document, new DateTimeImmutable(), $options));
        }
        $index = array_search($dayId, array_column($document['days'], 'id'), true);
        if ($index === false) {
            return Json::error($response, 404, 'No such day.');
        }
        return self::download($response, TripGpx::dayFileName($document, $index) . '.gpx', 'application/gpx+xml', TripGpx::day($document, $index, new DateTimeImmutable(), $options));
    }

    private static function zip(Response $response, array $document, ExportOptions $options): Response
    {
        $file = tempnam(sys_get_temp_dir(), 'gpx');
        $zip = new ZipArchive();
        $zip->open($file, ZipArchive::OVERWRITE);
        $now = new DateTimeImmutable();
        foreach (array_keys($document['days']) as $index) {
            $zip->addFromString(TripGpx::dayFileName($document, $index) . '.gpx', TripGpx::day($document, $index, $now, $options));
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
