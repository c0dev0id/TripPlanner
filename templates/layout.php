<!doctype html>
<html lang="<?= $this->language() ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $this->e($title) ?> · Trip Planner</title>
<link rel="stylesheet" href="/site.css">
<?php $this->insert('theme') ?>
</head>
<body>
<header class="site">
  <a class="brand" href="/">Trip Planner</a>
  <nav>
    <?php if ($this->currentUser() !== null): ?>
      <a href="/app"><?= $this->t('Open the planner') ?></a>
      <?php if ($this->currentUser()->isAdmin): ?><a href="/admin/waitlist"><?= $this->t('Waiting list') ?></a><?php endif ?>
      <form method="post" action="/logout"><?= $this->csrf() ?><button type="submit" class="link"><?= $this->t('Sign out') ?></button></form>
    <?php else: ?>
      <a href="/login"><?= $this->t('Sign in') ?></a>
    <?php endif ?>
  </nav>
</header>
<main>
<?= $this->section('content') ?>
</main>
</body>
</html>
