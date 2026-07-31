window.Views.auditLog = (function () {
  function fmtWhen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function summarize(entry) {
    const details = entry.details;
    if (!details || typeof details !== 'object') return '';
    const keys = Object.keys(details).filter(k => k !== 'id' && k !== 'history');
    if (!keys.length) return '';
    return keys.slice(0, 4).map(k => `${k}: ${String(details[k]).slice(0, 40)}`).join(', ');
  }

  function renderList(main) {
    const rows = Store.listAuditLog().slice(0, 300);
    const retentionDays = Number(Store.getAppSetting('auditLogRetentionDays', 30));

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Audit Log</h1>
          <div class="page-sub">Read-only record of every administrative change — who, what, and when. Populated automatically; showing the most recent 300 entries.</div>
        </div>
      </div>

      <div class="filters">
        <div class="field">
          <label>Keep entries for</label>
          <div class="seg" id="seg-retention">
            ${[7, 30].map(d => `<button data-val="${d}" class="${retentionDays === d ? 'active' : ''}">${d} days</button>`).join('')}
          </div>
        </div>
        <div class="page-sub" style="align-self:flex-end; margin-bottom:8px;">Entries older than this are deleted automatically the next time this page is opened.</div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            ${rows.map(e => `
              <tr>
                <td class="dim">${fmtWhen(e.created_at)}</td>
                <td class="name">${escapeHtml(e.actorEmail || '—')}</td>
                <td><span class="badge badge-gray">${escapeHtml(e.action)}</span></td>
                <td class="dim" style="max-width:360px;">${escapeHtml(summarize(e))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No administrative actions logged yet.</div>'}
      </div>
    `;

    qsa('#seg-retention button', main).forEach(b => b.addEventListener('click', async () => {
      await Store.setAppSetting('auditLogRetentionDays', Number(b.dataset.val));
      await Store.purgeOldAuditLog();
      toast(`✔ Now keeping audit log entries for ${b.dataset.val} days.`);
      renderList(main);
    }));

    // Opportunistic purge -- there's no server-side cron in this app, so entries older
    // than the configured retention are cleaned up the next time someone actually opens
    // this page, not on a strict schedule.
    Store.purgeOldAuditLog().then((deleted) => { if (deleted) renderList(main); });
  }

  return { render: renderList };
})();
