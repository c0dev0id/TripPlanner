<?php $this->layout('layout', ['title' => t('Waiting list')]) ?>
<section class="card">
  <h1><?= $this->e(t('Waiting list')) ?></h1>
  <?php if (isset($error)): ?><p class="error"><?= $this->e($error) ?></p><?php endif ?>
  <?php if ($pending === []): ?>
    <p><?= $this->e(t('Nobody is waiting.')) ?></p>
  <?php else: ?>
    <table>
      <thead><tr><th><?= $this->e(t('E-mail')) ?></th><th><?= $this->e(t('Since')) ?></th><th></th></tr></thead>
      <tbody>
      <?php foreach ($pending as $entry): ?>
        <tr>
          <td><?= $this->e($entry['email']) ?></td>
          <td><?= $this->e(substr($entry['created_at'], 0, 10)) ?></td>
          <td>
            <form method="post" action="/admin/invitations">
              <?= $this->csrf() ?>
              <input type="hidden" name="email" value="<?= $this->e($entry['email']) ?>">
              <button type="submit"><?= $this->e(t('Invite')) ?></button>
            </form>
          </td>
        </tr>
      <?php endforeach ?>
      </tbody>
    </table>
  <?php endif ?>
  <h2><?= $this->e(t('Invite an address')) ?></h2>
  <form method="post" action="/admin/invitations">
    <?= $this->csrf() ?>
    <label><?= $this->e(t('E-mail')) ?> <input type="email" name="email" required></label>
    <button type="submit"><?= $this->e(t('Invite')) ?></button>
  </form>
</section>
