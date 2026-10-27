<?php

declare(strict_types=1);

namespace Planner;

use DI\ContainerBuilder;
use League\Plates\Engine;
use PDO;
use Planner\Account\CurrentUser;
use Planner\Account\PasswordResets;
use Planner\Http\Routes;
use Planner\Http\SessionMiddleware;
use Planner\Journal\FileStore;
use Planner\Mail\LogMailer;
use Planner\Mail\Mailer;
use Planner\Mail\SmtpMailer;
use Planner\Pages\ViteAssets;
use Planner\Signup\Invitations;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseFactoryInterface;
use Slim\App;
use Slim\Csrf\Guard;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ResponseFactory;

/** Wires the container and the Slim application. */
final class Kernel
{
    public static function container(string $root): ContainerInterface
    {
        $builder = new ContainerBuilder();
        $builder->addDefinitions([
            Config::class => fn () => Config::load($root . '/config'),
            PDO::class => fn (Config $config) => Database::open($config->dataDir . '/planner.sqlite'),
            FileStore::class => fn (Config $config) => new FileStore($config->dataDir . '/files'),
            ResponseFactoryInterface::class => fn () => new ResponseFactory(),
            Guard::class => fn (ResponseFactoryInterface $factory) => new Guard($factory),
            Mailer::class => fn (Config $config) => $config->mailTransport === 'smtp'
                ? new SmtpMailer($config)
                : new LogMailer($config->dataDir . '/mail.log'),
            Invitations::class => fn (PDO $db, Config $config) => new Invitations($db, $config->invitationTtl),
            PasswordResets::class => fn (PDO $db, Config $config) => new PasswordResets($db, $config->passwordResetTtl),
            ViteAssets::class => fn (Config $config) => new ViteAssets($config, $root . '/public/build/.vite/manifest.json'),
            Engine::class => fn (ContainerInterface $c) => self::templates($root . '/templates', $c),
        ]);
        return $builder->build();
    }

    public static function app(ContainerInterface $container): App
    {
        $app = AppFactory::createFromContainer($container);
        Routes::register($app);
        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        $app->add(SessionMiddleware::class);
        $app->addErrorMiddleware($container->get(Config::class)->debug, true, true);
        return $app;
    }

    /** Plates with the mail folder and the functions templates call: csrf(), csrfToken(), currentUser(). */
    private static function templates(string $dir, ContainerInterface $c): Engine
    {
        $engine = new Engine($dir);
        $engine->addFolder('mail', $dir . '/mail');
        $engine->registerFunction('csrfToken', function () use ($c): array {
            $guard = $c->get(Guard::class);
            return [
                'nameKey' => $guard->getTokenNameKey(),
                'name' => $guard->getTokenName(),
                'valueKey' => $guard->getTokenValueKey(),
                'value' => $guard->getTokenValue(),
            ];
        });
        $engine->registerFunction('csrf', function () use ($c): string {
            $guard = $c->get(Guard::class);
            return sprintf(
                '<input type="hidden" name="%s" value="%s"><input type="hidden" name="%s" value="%s">',
                $guard->getTokenNameKey(),
                $guard->getTokenName(),
                $guard->getTokenValueKey(),
                $guard->getTokenValue(),
            );
        });
        $engine->registerFunction('currentUser', fn () => $c->get(CurrentUser::class)->get());
        return $engine;
    }
}
