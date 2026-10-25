<?php $this->layout('layout', ['title' => 'Reset the password']) ?>
<section class="card">
  <h1>Reset the password</h1>
  <?php if (isset($notice)): ?>
    <p class="notice"><?= $this->e($notice) ?></p>
  <?php else: ?>
    <p>Enter the address of your account and a link to set a new password comes by mail.</p>
    <form method="post" action="/password/forgot">
      <?= $this->csrf() ?>
      <label>E-mail <input type="email" name="email" required autocomplete="email"></label>
      <button type="submit">Send the link</button>
    </form>
  <?php endif ?>
</section>
