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

/** GPX downloads of a trip, or of some of its days or routes: one file, or one file per day in a zip. */
final class GpxExportController
{
    public function __construct(private readonly TripDocuments $documents, private readonly CurrentUser $currentUser)
    {
    }

    /**
     * The trip as GPX as the options in the query say (see ExportOptions): one file, or
     * with `per=day` a zip of one file per day. `days=<ids>` takes those days alone and
     * `routes=<ids>` those routes alone, ids separated by commas; what then lies in one
     * day is that day's file.
     */
    public function gpx(Request $request, Response $response, array $args): Response
    {
        $document = $this->documents->load($this->currentUser->get()->id, (int) $args['id']);
        if ($document === null) {
            return Json::error($response, 404, 'No such trip.');
        }
        $query = $request->getQueryParams();
        $options = ExportOptions::from($query);
        if ($options === null) {
            return Json::error($response, 422, 'The export options are malformed.');
        }
        $dayIds = self::ids($query['days'] ?? null);
        $routeIds = self::ids($query['routes'] ?? null);
        $indices = array_keys(array_filter(
            $document['days'],
            fn (array $day): bool => ($dayIds === null || in_array($day['id'], $dayIds, true))
                && ($routeIds === null || array_intersect(array_column($day['routes'], 'id'), $routeIds) !== []),
        ));
        if ($indices === [] && ($dayIds !== null || $routeIds !== null)) {
            return Json::error($response, 404, 'No such day or route.');
        }
        $now = new DateTimeImmutable();
        if (count($indices) === 1 && ($dayIds !== null || $routeIds !== null)) {
            return self::download($response, TripGpx::dayFileName($document, $indices[0]) . '.gpx', 'application/gpx+xml', TripGpx::day($document, $indices[0], $now, $options, $routeIds));
        }
        if ($options->per === 'day') {
            return self::zip($response, $document, $indices, $now, $options, $routeIds);
        }
        return self::download($response, TripGpx::fileName($document['name']) . '.gpx', 'application/gpx+xml', TripGpx::days($document, $indices, $now, $options, $routeIds));
    }

    /** @return ?list<string> the ids of a comma-separated list, or null where the query names none */
    private static function ids(mixed $list): ?array
    {
        return is_string($list) && $list !== '' ? explode(',', $list) : null;
    }

    /** @param list<int> $indices */
    private static function zip(Response $response, array $document, array $indices, DateTimeImmutable $now, ExportOptions $options, ?array $routeIds): Response
    {
        $file = tempnam(sys_get_temp_dir(), 'gpx');
        $zip = new ZipArchive();
        $zip->open($file, ZipArchive::OVERWRITE);
        foreach ($indices as $index) {
            $zip->addFromString(TripGpx::dayFileName($document, $index) . '.gpx', TripGpx::day($document, $index, $now, $options, $routeIds));
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
