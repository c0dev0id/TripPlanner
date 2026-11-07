<?php $this->layout('layout', ['title' => t('Reset the password')]) ?>
<section class="card">
  <h1><?= $this->t('Reset the password') ?></h1>
  <?php if (isset($notice)): ?>
    <p class="notice"><?= $this->e($notice) ?></p>
  <?php else: ?>
    <p><?= $this->t('Enter the address of your account and a link to set a new password comes by mail.') ?></p>
    <form method="post" action="/password/forgot">
      <?= $this->csrf() ?>
      <label><?= $this->t('E-mail') ?> <input type="email" name="email" required autocomplete="email"></label>
      <button type="submit"><?= $this->t('Send the link') ?></button>
    </form>
  <?php endif ?>
</section>
