<?php $this->layout('layout', ['title' => t('New password')]) ?>
<section class="card">
  <h1><?= $this->t('New password') ?></h1>
  <?php if (!$valid): ?>
    <p class="error"><?= $this->t('This link is no longer valid.') ?> <a href="/password/forgot"><?= $this->t('Request a new one.') ?></a></p>
  <?php else: ?>
    <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
    <form method="post">
      <?= $this->csrf() ?>
      <label><?= $this->t('Password') ?> <input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <label><?= $this->t('Repeat password') ?> <input type="password" name="password_repeat" required minlength="10" autocomplete="new-password"></label>
      <button type="submit"><?= $this->t('Set password') ?></button>
    </form>
  <?php endif ?>
</section>
