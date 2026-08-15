window.EssViews.settings = (function () {
  // Push subscription state is per-device and can't be read synchronously, so the card
  // first renders a "Checking…" placeholder and fills in the real state once
  // getCurrentEssPushSubscription() resolves (js/ess-app.js) -- same pattern as the
  // admin dashboard's Payroll -> Push Notifications card.
  function renderNotificationsCard(main, emp) {
    const card = qs('#ess-push-card', main);
    if (!card) return;
    card.innerHTML = `
      <div class="ess-sub" id="ess-push-status">Checking this device…</div>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-ess-test-sound">🔊 Test Sound</button>
        <button type="button" class="btn btn-primary btn-sm" id="btn-ess-toggle-push" disabled>…</button>
      </div>
    `;
    qs('#btn-ess-test-sound', card).addEventListener('click', () => playEssNotificationTone());

    function setState(subscribed) {
      const btn = qs('#btn-ess-toggle-push', card);
      const statusEl = qs('#ess-push-status', card);
      btn.disabled = false;
      if (Notification.permission === 'denied') {
        btn.textContent = 'Blocked';
        btn.disabled = true;
        statusEl.textContent = 'Notifications are blocked for this device — enable them in your browser\'s site settings, then reload.';
        return;
      }
      if (subscribed) {
        btn.textContent = '🔕 Disable on this device';
        btn.className = 'btn btn-ghost btn-sm';
        statusEl.textContent = 'Enabled on this device — you\'ll get a push (and this device\'s ringtone, if My Portal is open) the moment a request is approved, payroll is released, or an NTE is issued.';
      } else {
        btn.textContent = '🔔 Enable on this device';
        btn.className = 'btn btn-primary btn-sm';
        statusEl.textContent = 'Not enabled on this device yet.';
      }
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = subscribed ? 'Disabling…' : 'Enabling…';
        try {
          if (subscribed) {
            await disableEssPushNotifications();
            toast('Notifications disabled on this device.');
          } else {
            // enableEssPushNotifications() already shows its own toast for known failure
            // cases (unsupported browser, permission denied/dismissed) and returns false
            // without throwing -- showing a generic "enabled" toast on top of that was
            // masking the real reason with a false success message.
            const ok = await enableEssPushNotifications();
            if (ok) toast('✔ Notifications enabled on this device.');
          }
        } catch (err) {
          toast('Something went wrong: ' + (err && err.message ? err.message : String(err)));
        }
        renderNotificationsCard(main, emp);
      };
    }

    const unsupportedReason = pushUnsupportedReason();
    if (unsupportedReason) {
      const btn = qs('#btn-ess-toggle-push', card);
      btn.textContent = 'Not available here';
      btn.disabled = true;
      qs('#ess-push-status', card).textContent = unsupportedReason;
      return;
    }
    getCurrentEssPushSubscription().then((sub) => setState(!!sub));
  }

  function render(main, emp) {
    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">Settings</div>
      <div class="ess-card">
        <div class="ess-row"><span class="label">Employee ID</span><span class="value">${escapeHtml(emp.employeeCode || '—')}</span></div>
        <div class="ess-row"><span class="label">Name</span><span class="value">${escapeHtml(emp.name)}</span></div>
      </div>

      <div class="ess-section-title">🔔 Notifications</div>
      <div class="ess-card" id="ess-push-card"></div>

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

    renderNotificationsCard(main, emp);

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
