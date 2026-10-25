<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $this->e($title) ?> · Trip Planner</title>
<link rel="stylesheet" href="/site.css">
</head>
<body>
<header class="site">
  <a class="brand" href="/">Trip Planner</a>
  <nav>
    <?php if ($this->currentUser() !== null): ?>
      <a href="/app">Open the planner</a>
      <?php if ($this->currentUser()->isAdmin): ?><a href="/admin/waitlist">Waiting list</a><?php endif ?>
      <form method="post" action="/logout"><?= $this->csrf() ?><button type="submit" class="link">Sign out</button></form>
    <?php else: ?>
      <a href="/login">Sign in</a>
    <?php endif ?>
  </nav>
</header>
<main>
<?= $this->section('content') ?>
</main>
</body>
</html>
