<?php $this->layout('layout', ['title' => t('Create your account')]) ?>
<section class="card">
  <h1><?= $this->t('Create your account') ?></h1>
  <?php if ($email === null): ?>
    <p class="error"><?= $this->t('This link is not valid any more.') ?> <a href="/"><?= $open ? $this->t('Ask for a new one on the start page.') : $this->t('Ask for a new invitation from the waiting list.') ?></a></p>
  <?php else: ?>
    <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
    <form method="post">
      <?= $this->csrf() ?>
      <label><?= $this->t('E-mail') ?> <input type="email" value="<?= $this->e($email) ?>" disabled></label>
      <label><?= $this->t('Password') ?> <input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <label><?= $this->t('Password again') ?> <input type="password" name="password_repeat" required minlength="10" autocomplete="new-password"></label>
      <button type="submit"><?= $this->t('Create account') ?></button>
    </form>
  <?php endif ?>
</section>
