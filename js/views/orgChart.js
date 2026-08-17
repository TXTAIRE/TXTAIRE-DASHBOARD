window.Views.orgChart = (function () {
  function personCard(emp) {
    const reports = Store.directReports(emp.id);
    return `
      <div class="tl-item" style="align-items:flex-start;">
        <div class="tl-dot"></div>
        <div class="tl-body">
          <div class="tl-title">${escapeHtml(emp.name)}</div>
          <div class="tl-meta">${escapeHtml(emp.position || emp.category)}${reports.length ? ' · ' + reports.length + ' direct report' + (reports.length === 1 ? '' : 's') : ''}</div>
          ${reports.length ? `<div class="timeline" style="margin-top:8px; margin-left:6px;">${reports.map(personCard).join('')}</div>` : ''}
        </div>
      </div>
    `;
  }

  function render(main) {
    const roots = Store.orgChartRoots().slice().sort((a, b) => a.name.localeCompare(b.name));

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Org Chart</h1>
          <div class="page-sub">Reporting structure, built from each employee's "Reports To" field on Employee Management.</div>
        </div>
      </div>

      <div class="panel" style="padding:16px;">
        ${roots.length
          ? `<div class="timeline">${roots.map(personCard).join('')}</div>`
          : '<div class="empty">No employees on file yet, or nobody has a manager set — this starts from anyone with no "Reports To" set.</div>'}
      </div>
    `;
  }

  return { render };
})();
