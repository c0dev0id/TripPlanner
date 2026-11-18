<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php if (isset($shared)): ?>
<title><?= $this->e($shared['title']) ?> · Trip Planner</title>
<meta name="robots" content="noindex">
<meta property="og:type" content="article">
<meta property="og:title" content="<?= $this->e($shared['title']) ?>">
<?php if ($shared['description'] !== ''): ?>
<meta name="description" content="<?= $this->e($shared['description']) ?>">
<meta property="og:description" content="<?= $this->e($shared['description']) ?>">
<?php endif ?>
<?php if ($shared['image'] !== null): ?>
<meta property="og:image" content="<?= $this->e($shared['image']) ?>">
<?php if ($shared['card']): ?>
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<?php endif ?>
<meta name="twitter:card" content="summary_large_image">
<?php endif ?>
<?php else: ?>
<title>Trip Planner</title>
<?php endif ?>
<?php $this->insert('theme') ?>
</head>
<body>
<div id="root" data-api="<?= $this->e($api) ?>" data-document="<?= $this->e($document) ?>"></div>
<?= $assets ?>
</body>
</html>
