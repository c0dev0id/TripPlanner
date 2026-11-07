<?php $this->layout('layout', ['title' => t('Choose your password')]) ?>
<section class="card">
  <h1><?= $this->t('Choose your password') ?></h1>
  <p><?= $this->t('The account {email} was set up with a password to replace. Choose your own to go on.', ['email' => $email]) ?></p>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <form method="post">
    <?= $this->csrf() ?>
    <label><?= $this->t('New password') ?> <input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
    <label><?= $this->t('New password again') ?> <input type="password" name="password_repeat" required minlength="10" autocomplete="new-password"></label>
    <button type="submit"><?= $this->t('Set the password') ?></button>
  </form>
</section>
