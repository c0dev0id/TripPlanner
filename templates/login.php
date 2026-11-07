<?php $this->layout('layout', ['title' => t('Sign in')]) ?>
<section class="card">
  <h1><?= $this->t('Sign in') ?></h1>
  <?php if (isset($notice)): ?><p class="notice"><?= $this->e($notice) ?></p><?php endif ?>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <form method="post" action="/login">
    <?= $this->csrf() ?>
    <label><?= $this->t('E-mail') ?> <input type="email" name="email" required autocomplete="email" value="<?= $this->e($email ?? '') ?>"></label>
    <label><?= $this->t('Password') ?> <input type="password" name="password" required autocomplete="current-password"></label>
    <button type="submit"><?= $this->t('Sign in') ?></button>
  </form>
  <p><a href="/password/forgot"><?= $this->t('Forgot the password?') ?></a></p>
</section>
