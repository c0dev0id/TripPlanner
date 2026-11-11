<?php

declare(strict_types=1);

namespace Planner\Poi;

/** The tiles places are kept and asked for by: those of the web's maps at zoom 10, some 25 km wide in central Europe. */
final class Tile
{
    public const ZOOM = 10;
    public const COUNT = 1 << self::ZOOM;

    /** @return array{int, int} the column and row of the tile a position lies in */
    public static function of(float $lng, float $lat): array
    {
        $x = (int) floor(($lng + 180) / 360 * self::COUNT);
        $y = (int) floor((1 - asinh(tan(deg2rad($lat))) / M_PI) / 2 * self::COUNT);
        return [max(0, min(self::COUNT - 1, $x)), max(0, min(self::COUNT - 1, $y))];
    }
}
