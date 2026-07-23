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
