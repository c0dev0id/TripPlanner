<?php

declare(strict_types=1);

namespace Planner\I18n;

/** The language of this request's answers, pages, mails and exports: German where the client asks for it first, else English. */
final class Language
{
    private static string $current = 'en';

    public static function current(): string
    {
        return self::$current;
    }

    public static function set(string $language): void
    {
        self::$current = $language === 'de' ? 'de' : 'en';
    }

    /** The language an Accept-Language header asks for first among those spoken here. */
    public static function fromHeader(?string $header): string
    {
        $choices = [];
        foreach (explode(',', (string) $header) as $entry) {
            $parts = array_map('trim', explode(';', $entry));
            $tag = strtolower(array_shift($parts));
            $q = 1.0;
            foreach ($parts as $part) {
                if (str_starts_with($part, 'q=')) {
                    $q = (float) substr($part, 2);
                }
            }
            if ($tag !== '' && $q > 0) {
                $choices[] = [$tag, $q];
            }
        }
        usort($choices, fn (array $a, array $b) => $b[1] <=> $a[1]);
        foreach ($choices as [$tag]) {
            $primary = explode('-', $tag)[0];
            if ($primary === 'de' || $primary === 'en') {
                return $primary;
            }
        }
        return 'en';
    }
}
