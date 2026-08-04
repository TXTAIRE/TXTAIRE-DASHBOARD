window.EssViews.settings = (function () {
  function render(main, emp) {
    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">Settings</div>
      <div class="ess-card">
        <div class="ess-row"><span class="label">Employee ID</span><span class="value">${escapeHtml(emp.employeeCode || '—')}</span></div>
        <div class="ess-row"><span class="label">Name</span><span class="value">${escapeHtml(emp.name)}</span></div>
      </div>

      <div class="ess-section-title">Change Password</div>
      <div class="ess-card">
        <form id="pw-form">
          <div class="field full" style="margin-bottom:12px;">
            <label>New Password</label>
            <input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters" />
          </div>
          <div class="field full" style="margin-bottom:14px;">
            <label>Confirm New Password</label>
            <input type="password" name="confirm" required minlength="8" autocomplete="new-password" />
          </div>
          <div id="pw-error" class="auth-error hidden" style="margin-bottom:12px;"></div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Update Password</button>
        </form>
      </div>

      <button type="button" class="btn btn-ghost btn-sm" id="btn-ess-sign-out" style="width:100%; justify-content:center; margin-top:6px;">Sign out</button>
    `;

    qs('#pw-form', main).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const pw = fd.get('password');
      const confirm = fd.get('confirm');
      const errEl = qs('#pw-error', main);
      errEl.classList.add('hidden');

      if (pw !== confirm) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
      }

      const btn = ev.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Updating…';
      const { error } = await sb.auth.updateUser({ password: pw });
      btn.disabled = false;
      btn.textContent = 'Update Password';

      if (error) {
        errEl.textContent = error.message || 'Could not update password — try again.';
        errEl.classList.remove('hidden');
        return;
      }
      ev.target.reset();
      toast('✔ Password updated.');
    });

    qs('#btn-ess-sign-out', main).addEventListener('click', () => sb.auth.signOut());
  }

  return { render };
})();
