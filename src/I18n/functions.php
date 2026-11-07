<?php

declare(strict_types=1);

use Planner\I18n\Language;

/**
 * A text in the request's language: the English text is the key of its German in
 * frontend/i18n/de.json, the dictionary the planner itself uses; `{name}` placeholders are
 * filled from `$params`. A text without a German stays English.
 */
function t(string $text, array $params = []): string
{
    static $german = null;
    if (Language::current() === 'de') {
        $german ??= json_decode(file_get_contents(dirname(__DIR__, 2) . '/frontend/i18n/de.json'), true, 512, JSON_THROW_ON_ERROR);
        $text = $german[$text] ?? $text;
    }
    foreach ($params as $name => $value) {
        $text = str_replace('{' . $name . '}', (string) $value, $text);
    }
    return $text;
}
