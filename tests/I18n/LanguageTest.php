<?php

declare(strict_types=1);

namespace Planner\Tests\I18n;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Planner\Http\Json;
use Planner\I18n\Language;
use Slim\Psr7\Response;

final class LanguageTest extends TestCase
{
    protected function tearDown(): void
    {
        Language::set('en');
    }

    public static function headers(): array
    {
        return [
            'none' => [null, 'en'],
            'empty' => ['', 'en'],
            'german' => ['de', 'de'],
            'regional german' => ['de-AT,de;q=0.9,en;q=0.8', 'de'],
            'english first' => ['en-GB,de;q=0.9', 'en'],
            'weights over order' => ['en;q=0.5,de;q=0.8', 'de'],
            'unknown language skipped' => ['fr-FR,fr;q=0.9,de;q=0.8', 'de'],
            'only unknown languages' => ['fr,it;q=0.9', 'en'],
            'refused language' => ['de;q=0,en;q=0.5', 'en'],
        ];
    }

    #[DataProvider('headers')]
    public function testTheFirstSpokenLanguageAskedForWins(?string $header, string $language): void
    {
        self::assertSame($language, Language::fromHeader($header));
    }

    public function testTextsAreGermanOnlyWhileGermanIsSet(): void
    {
        self::assertSame('Day 3', t('Day {n}', ['n' => 3]));
        Language::set('de');
        self::assertSame('Tag 3', t('Day {n}', ['n' => 3]));
        self::assertSame('Not in the dictionary', t('Not in the dictionary'));
        Language::set('fr');
        self::assertSame('Day 3', t('Day {n}', ['n' => 3]));
    }

    public function testApiErrorsAreAnsweredInTheLanguage(): void
    {
        Language::set('de');
        $answer = Json::error(new Response(), 404, 'No such trip.');
        self::assertSame(404, $answer->getStatusCode());
        self::assertSame('{"error":"Diese Tour gibt es nicht."}', (string) $answer->getBody());
    }
}
