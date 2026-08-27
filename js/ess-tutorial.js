// Simple step-by-step onboarding tour for My Portal (ess.html) -- shown automatically once
// per device on first login (localStorage 'essTutorialSeen'), and replayable anytime from
// Settings. Deliberately lightweight: a full-screen dimmed backdrop with a spotlight
// cutout around the current step's target (a plain oversized box-shadow trick, not SVG
// masking) plus a small callout card with a CSS-triangle arrow pointing at it. The
// welcome/closing steps skip the spotlight and just show a centered card.
//
// Relies on globals already defined by js/ess-app.js by the time this actually runs
// (qs, escapeHtml, essRoute, renderEssRoute) -- safe regardless of <script> tag order
// since startEssTutorial() is only ever called later, from a user action or a deferred
// setTimeout, never at page-load time.

const ESS_TUTORIAL_SEEN_KEY = 'essTutorialSeen';

function shouldShowEssTutorial() {
  return !localStorage.getItem(ESS_TUTORIAL_SEEN_KEY);
}
function markEssTutorialSeen() {
  localStorage.setItem(ESS_TUTORIAL_SEEN_KEY, '1');
}

function essTutorialSteps() {
  const steps = [
    { placement: 'center', title: 'Welcome to My Portal 👋', body: 'Let’s take a quick look around so you know where everything is. You can replay this tour anytime from Settings.' },
    { selector: '[data-route="attendance"]', title: 'My Attendance', body: 'Clock in and out, and see today’s attendance record here.' },
    { selector: '[data-route="payroll"]', title: 'My Payroll', body: 'View your payslips and pay breakdown for each cutoff.' },
    { selector: '[data-route="leave"]', title: 'My Leave', body: 'File and track your leave requests here.' },
    { selector: '[data-route="discipline"]', title: 'Code of Discipline', body: 'Read the company’s Code of Discipline, in English or Filipino.' },
    { selector: '#ess-fab-clock', title: 'Quick Clock In/Out', body: 'Tap this anytime, from any page, for a one-tap time in or time out.' },
    { selector: '[data-route="profile"]', title: 'My Profile', body: 'View and update your personal details, bank info, and photo.' },
    { selector: '[data-route="notifications"]', title: 'Notifications', body: 'Get alerted the moment a request is approved or payroll is released.' },
    { selector: '[data-route="settings"]', title: 'Settings', body: 'Change your language, password, and notification preferences here.' },
  ];
  const adminLink = qs('#ess-admin-portal-link');
  if (adminLink && !adminLink.classList.contains('hidden')) {
    steps.push({ selector: '#ess-admin-portal-link', placement: 'below', title: 'Admin Portal', body: 'You’ve been given access to extra admin tools here, like AI receipt scanning for expenses.' });
  }
  steps.push({ placement: 'center', title: 'You’re all set! 🎉', body: 'You can replay this tour anytime from Settings.' });
  return steps;
}

function startEssTutorial() {
  const steps = essTutorialSteps();
  const savedRoute = essRoute;
  let i = 0;

  const backdrop = document.createElement('div');
  backdrop.className = 'ess-tour-backdrop';
  const spotlight = document.createElement('div');
  spotlight.className = 'ess-tour-spotlight';
  const tooltip = document.createElement('div');
  tooltip.className = 'ess-tour-tooltip';
  backdrop.appendChild(spotlight);
  backdrop.appendChild(tooltip);
  document.body.appendChild(backdrop);

  function finish() {
    markEssTutorialSeen();
    backdrop.remove();
    if (essRoute !== savedRoute) { essRoute = savedRoute; renderEssRoute(); }
  }

  function position(step) {
    tooltip.classList.remove('center');
    const oldArrow = qs('.ess-tour-arrow', tooltip);
    if (oldArrow) oldArrow.remove();

    if (step.placement === 'center' || !step.selector) {
      spotlight.style.opacity = '0';
      tooltip.classList.add('center');
      return;
    }

    const target = document.querySelector(step.selector);
    if (!target) {
      spotlight.style.opacity = '0';
      tooltip.classList.add('center');
      return;
    }

    spotlight.style.opacity = '1';
    const r = target.getBoundingClientRect();
    const pad = 6;
    spotlight.style.top = (r.top - pad) + 'px';
    spotlight.style.left = (r.left - pad) + 'px';
    spotlight.style.width = (r.width + pad * 2) + 'px';
    spotlight.style.height = (r.height + pad * 2) + 'px';

    const tw = Math.min(300, window.innerWidth - 32);
    tooltip.style.width = tw + 'px';
    const th = tooltip.offsetHeight || 140;

    const below = step.placement === 'below';
    const top = below ? (r.bottom + pad + 12) : (r.top - pad - th - 12);
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tw - 16));

    tooltip.style.top = Math.max(16, top) + 'px';
    tooltip.style.left = left + 'px';

    const arrowEl = document.createElement('div');
    arrowEl.className = 'ess-tour-arrow ' + (below ? 'point-up' : 'point-down');
    const arrowLeft = Math.max(14, Math.min(r.left + r.width / 2 - left - 7, tw - 28));
    arrowEl.style.left = arrowLeft + 'px';
    tooltip.appendChild(arrowEl);
  }

  function renderStep() {
    const step = steps[i];
    // A nav-bar step needs that tab's page actually showing underneath first, so the
    // spotlight highlights the real button in its real page context, not a stale route.
    if (step.selector && step.selector.indexOf('[data-route=') === 0) {
      const routeMatch = /"([^"]+)"/.exec(step.selector);
      const route = routeMatch && routeMatch[1];
      if (route && essRoute !== route) { essRoute = route; renderEssRoute(); }
    }

    const isLast = i === steps.length - 1;
    tooltip.innerHTML = `
      <div class="ess-tour-title">${escapeHtml(step.title)}</div>
      <div class="ess-tour-body">${escapeHtml(step.body)}</div>
      <div class="ess-tour-footer">
        <span class="ess-tour-step-count">${i + 1} / ${steps.length}</span>
        <div class="ess-tour-actions">
          ${isLast ? '' : '<button type="button" class="btn btn-ghost btn-sm" id="ess-tour-skip">Skip</button>'}
          <button type="button" class="btn btn-primary btn-sm" id="ess-tour-next">${isLast ? 'Done' : 'Next'}</button>
        </div>
      </div>
    `;
    qs('#ess-tour-next', tooltip).addEventListener('click', () => {
      if (isLast) { finish(); } else { i++; renderStep(); }
    });
    const skipBtn = qs('#ess-tour-skip', tooltip);
    if (skipBtn) skipBtn.addEventListener('click', finish);

    position(step);
  }

  renderStep();
}
