<?php

declare(strict_types=1);

namespace Planner\Http;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\UploadedFileInterface;

/** A GPX file a request brings as its upload `file`, compressed with gzip. */
final class GpxUpload
{
    /** The largest file taken, compressed and as GPX: a long day of one point a second with sensor data stays well below. */
    private const MAX_COMPRESSED = 20_000_000;
    private const MAX_GPX = 200_000_000;

    /**
     * The file's bytes as they were sent.
     *
     * @throws InvalidUpload where no file arrived, it is too large, or it is no GPX file compressed with gzip
     */
    public static function gzip(Request $request): string
    {
        $upload = $request->getUploadedFiles()['file'] ?? null;
        if (!$upload instanceof UploadedFileInterface || $upload->getError() !== UPLOAD_ERR_OK || $upload->getSize() > self::MAX_COMPRESSED) {
            throw new InvalidUpload('The file did not arrive, or is too large.');
        }
        $gzip = (string) $upload->getStream();
        $gpx = @gzdecode($gzip, self::MAX_GPX);
        if ($gpx === false || preg_match('/<gpx[\s>]/', substr($gpx, 0, 4096)) !== 1) {
            throw new InvalidUpload('The file is not a GPX file compressed with gzip.');
        }
        return $gzip;
    }
}
