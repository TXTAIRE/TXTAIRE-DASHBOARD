window.EssViews.notifications = (function () {
  // One icon per notification type, so the list is scannable at a glance without reading
  // every message in full.
  const ICONS = {
    ot_approved: '✅', ot_rejected: '❌', nsd_approved: '✅', nsd_rejected: '❌',
    holiday_approved: '✅', holiday_rejected: '❌', leave_approved: '✅', leave_rejected: '❌',
    correction_approved: '✅', correction_rejected: '❌', payroll_released: '💰',
  };

  function relativeTime(iso) {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function render(main, emp) {
    const list = Store.listNotificationsForEmployee(emp.id);
    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0; display:flex; justify-content:space-between; align-items:center;">
        <span>Notifications</span>
        ${list.length ? '<button type="button" class="link-btn" id="btn-mark-all-read">Mark all as read</button>' : ''}
      </div>
      ${list.length ? list.map(n => `
        <div class="ess-card" data-notif-id="${n.id}" style="cursor:pointer; display:flex; align-items:flex-start; gap:10px; ${n.readAt ? '' : 'background:var(--accent-dim);'}">
          <span style="font-size:18px;">${ICONS[n.type] || '🔔'}</span>
          <span style="flex:1;">
            <div style="font-size:13.5px; ${n.readAt ? '' : 'font-weight:700;'}">${escapeHtml(n.message)}</div>
            <div class="ess-sub" style="margin-top:4px;">${relativeTime(n.created_at)}</div>
          </span>
          <button type="button" class="link-btn" data-delete-notif="${n.id}" title="Delete notification" style="color:var(--red); font-size:16px; line-height:1; padding:2px;">✕</button>
        </div>
      `).join('') : '<div class="ess-empty">No notifications yet.</div>'}
    `;

    const markAllBtn = qs('#btn-mark-all-read', main);
    if (markAllBtn) markAllBtn.addEventListener('click', async () => {
      await Store.markAllNotificationsRead(emp.id);
      updateEssBellBadge();
      render(main, emp);
    });
    qsa('[data-notif-id]', main).forEach(el => el.addEventListener('click', async () => {
      await Store.markNotificationRead(el.dataset.notifId);
      updateEssBellBadge();
      render(main, emp);
    }));
    qsa('[data-delete-notif]', main).forEach(btn => btn.addEventListener('click', async (ev) => {
      ev.stopPropagation(); // don't also trigger the card's mark-as-read click
      await Store.deleteNotification(btn.dataset.deleteNotif);
      updateEssBellBadge();
      render(main, emp);
    }));
  }

  return { render };
})();
