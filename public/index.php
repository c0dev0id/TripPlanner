<?php

declare(strict_types=1);

use Planner\Kernel;

require dirname(__DIR__) . '/vendor/autoload.php';

Kernel::app(Kernel::container(dirname(__DIR__)))->run();
