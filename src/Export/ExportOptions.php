<?php

declare(strict_types=1);

namespace Planner\Export;

/**
 * How a trip is written as GPX: one file or one per day, the routes as tracks or as
 * routes, with or without the optional parts. Read from the query of a download and from
 * a preset's JSON alike; the public properties are its JSON.
 */
final readonly class ExportOptions
{
    public const FORMS = ['tracks', 'routes'];

    public function __construct(
        /** `trip` for one file, `day` for one file per day in a zip. */
        public string $per = 'trip',
        /** `tracks` writes each route's full line; `routes` writes its points only, for a device to route between. */
        public string $form = 'tracks',
        /** Whether optional routes and stops are written. */
        public bool $optional = true,
    ) {
    }

    /**
     * From the fields `per`, `form` and `optional`, each as the query writes it
     * (text, `optional` as 0 or 1) or as JSON does; the defaults where a field is absent;
     * null where one is malformed.
     */
    public static function from(mixed $values): ?self
    {
        if (!is_array($values)) {
            return null;
        }
        $per = $values['per'] ?? 'trip';
        $form = $values['form'] ?? 'tracks';
        $optional = $values['optional'] ?? true;
        if (!in_array($per, ['trip', 'day'], true) || !in_array($form, self::FORMS, true) || !in_array($optional, [true, false, '1', '0'], true)) {
            return null;
        }
        return new self($per, $form, $optional === true || $optional === '1');
    }
}
