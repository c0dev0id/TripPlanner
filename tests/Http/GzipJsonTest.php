<?php

declare(strict_types=1);

namespace Planner\Tests\Http;

use PHPUnit\Framework\TestCase;
use Planner\Http\GzipJson;
use Planner\Http\Json;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Response;

final class GzipJsonTest extends TestCase
{
    /** The answer to a request with the Accept-Encoding given, where the application answers with `$response`. */
    private function answer(string $acceptEncoding, ResponseInterface $response): ResponseInterface
    {
        $handler = new class ($response) implements RequestHandlerInterface {
            public function __construct(private readonly ResponseInterface $response)
            {
            }

            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return $this->response;
            }
        };
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/api/trips/1')->withHeader('Accept-Encoding', $acceptEncoding);
        return (new GzipJson())->process($request, $handler);
    }

    private function json(int $items): ResponseInterface
    {
        return Json::of(new Response(), array_fill(0, $items, 'a stop of the trip'));
    }

    public function testCompressesAJsonAnswerForAClientThatTakesGzip(): void
    {
        $answer = $this->answer('gzip, deflate, br, zstd', $this->json(500));
        self::assertSame('gzip', $answer->getHeaderLine('Content-Encoding'));
        self::assertSame('Accept-Encoding', $answer->getHeaderLine('Vary'));
        self::assertSame((string) $this->json(500)->getBody()->getSize(), $answer->getHeaderLine('X-Uncompressed-Length'));
        self::assertSame((string) $this->json(500)->getBody(), gzdecode((string) $answer->getBody()));
        self::assertLessThan(1000, strlen((string) $answer->getBody()));
    }

    public function testLeavesTheAnswerForAClientThatTakesNoGzip(): void
    {
        self::assertSame('', $this->answer('', $this->json(500))->getHeaderLine('Content-Encoding'));
        self::assertSame('', $this->answer('br, gzip;q=0', $this->json(500))->getHeaderLine('Content-Encoding'));
    }

    public function testLeavesSmallAnswersAndThoseThatAreNoJson(): void
    {
        self::assertSame('', $this->answer('gzip', $this->json(2))->getHeaderLine('Content-Encoding'));
        $picture = new Response();
        $picture->getBody()->write(str_repeat('x', 5000));
        self::assertSame('', $this->answer('gzip', $picture->withHeader('Content-Type', 'image/jpeg'))->getHeaderLine('Content-Encoding'));
    }
}
