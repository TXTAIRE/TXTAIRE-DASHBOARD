/* Supabase auth gate. Shows a sign-in screen until a session exists; hides it and
 * boots the app once signed in. Sign-up is intentionally not offered here — access
 * is invite-only, granted from the Supabase dashboard (Authentication → Users → Invite).
 */

function showAuthScreen(errorMessage) {
  const app = document.getElementById('app');
  const screen = document.getElementById('auth-screen');
  app.classList.add('hidden');
  screen.classList.remove('hidden');

  screen.innerHTML = `
    <div class="auth-card">
      <img src="assets/logo.svg" alt="TxTAIRE" class="auth-logo" />
      <h1>Sign in</h1>
      <div class="page-sub" style="margin-bottom:18px;">HR &amp; Operations</div>
      ${errorMessage ? `<div class="auth-error">${escapeHtml(errorMessage)}</div>` : ''}
      <form id="auth-form">
        <div class="field full" style="margin-bottom:12px;">
          <label>Email</label>
          <input type="email" name="email" required autocomplete="username" />
        </div>
        <div class="field full" style="margin-bottom:18px;">
          <label>Password</label>
          <input type="password" name="password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Sign in</button>
      </form>
      <div class="page-sub" style="margin-top:18px; font-size:12px;">Access is invite-only. Contact your administrator if you need a login.</div>
    </div>
  `;

  document.getElementById('auth-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const btn = ev.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({
      email: fd.get('email').trim(),
      password: fd.get('password'),
    });
    if (error) {
      showAuthScreen(error.message);
    }
    // On success, the onAuthStateChange listener (registered in app.js) starts the app.
  });
}

function hideAuthScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

// Shown after a correct password when the account has a verified TOTP factor enrolled
// (js/app.js's routeSession decides this) -- the database itself requires this second
// factor (is_admin() now checks for an aal2 session once a factor exists), so skipping
// this screen isn't just a UI inconvenience to route around, the account genuinely has
// no admin access until it's completed.
async function showMfaChallengeScreen() {
  const app = document.getElementById('app');
  const screen = document.getElementById('auth-screen');
  app.classList.add('hidden');
  screen.classList.remove('hidden');

  const { data: factorsData } = await sb.auth.mfa.listFactors();
  const factor = factorsData && factorsData.totp && factorsData.totp[0];
  if (!factor) {
    // Shouldn't happen (getAuthenticatorAssuranceLevel said a second factor was needed),
    // but fail safe with a clear message rather than an infinite/broken loading state.
    showAuthScreen('Could not find your two-factor method — contact another admin for help.');
    return;
  }

  screen.innerHTML = `
    <div class="auth-card">
      <img src="assets/logo.svg" alt="TxTAIRE" class="auth-logo" />
      <h1>Two-Factor Authentication</h1>
      <div class="page-sub" style="margin-bottom:18px;">Enter the 6-digit code from your authenticator app.</div>
      <div id="mfa-error"></div>
      <form id="mfa-form">
        <div class="field full" style="margin-bottom:18px;">
          <label>Code</label>
          <input type="text" name="code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" required autofocus />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Verify</button>
      </form>
      <button type="button" class="link-btn" id="mfa-signout" style="margin-top:14px;">Sign out</button>
    </div>
  `;

  document.getElementById('mfa-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const code = new FormData(ev.target).get('code').trim();
    const btn = ev.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Verifying…';
    const { data, error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      document.getElementById('mfa-error').innerHTML = `<div class="auth-error">${escapeHtml(error.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    const { data: { session } } = await sb.auth.getSession();
    await startApp(session);
  });
  document.getElementById('mfa-signout').addEventListener('click', () => sb.auth.signOut());
}
