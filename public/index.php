<?php

declare(strict_types=1);

use Planner\Kernel;

ini_set('zlib.output_compression', '0');

require dirname(__DIR__) . '/vendor/autoload.php';

Kernel::app(Kernel::container(dirname(__DIR__)))->run();
