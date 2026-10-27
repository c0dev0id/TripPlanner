<?php

declare(strict_types=1);

namespace Planner\Export;

/** How a trip is written as GPX: the routes as tracks or as routes, with or without the optional parts, free stops within reach. */
final readonly class ExportOptions
{
    public const FORMS = ['tracks', 'routes'];
    public const MAX_REACH_M = 100_000;

    public function __construct(
        /** `tracks` writes each route's full line; `routes` writes its points only, for a device to route between. */
        public string $form = 'tracks',
        /** Whether optional routes and stops are written. */
        public bool $optional = true,
        /** How far from a route a free stop may stand to be written, in metres. */
        public int $reachM = 2000,
    ) {
    }

    /** From query parameters `form`, `optional` (0 or 1) and `reach` (metres); null where one is malformed. */
    public static function fromQuery(array $query): ?self
    {
        $form = $query['form'] ?? 'tracks';
        $optional = $query['optional'] ?? '1';
        $reach = $query['reach'] ?? '2000';
        if (!in_array($form, self::FORMS, true) || !in_array($optional, ['0', '1'], true) || !self::isReach($reach)) {
            return null;
        }
        return new self($form, $optional === '1', (int) $reach);
    }

    /** From a preset's stored options; null where they are malformed. */
    public static function fromArray(mixed $options): ?self
    {
        if (!is_array($options) || !in_array($options['form'] ?? null, self::FORMS, true) || !is_bool($options['optional'] ?? null) || !self::isReach($options['reachM'] ?? null)) {
            return null;
        }
        return new self($options['form'], $options['optional'], (int) $options['reachM']);
    }

    private static function isReach(mixed $value): bool
    {
        return (is_int($value) || (is_string($value) && preg_match('/^\d{1,6}$/', $value))) && (int) $value <= self::MAX_REACH_M;
    }
}
