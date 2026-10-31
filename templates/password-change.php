<?php $this->layout('layout', ['title' => 'Choose your password']) ?>
<section class="card">
  <h1>Choose your password</h1>
  <p>The account <?= $this->e($email) ?> was set up with a password to replace. Choose your own to go on.</p>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <form method="post">
    <?= $this->csrf() ?>
    <label>New password <input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
    <label>New password again <input type="password" name="password_repeat" required minlength="10" autocomplete="new-password"></label>
    <button type="submit">Set the password</button>
  </form>
</section>
