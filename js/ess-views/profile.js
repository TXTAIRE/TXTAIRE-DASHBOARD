window.EssViews.profile = (function () {
  function render(main, emp) {
    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">My Profile</div>
      <div class="ess-card" style="text-align:center;">
        <div style="font-size:18px; font-weight:700;">${escapeHtml(emp.name)}</div>
        <div class="ess-sub">${escapeHtml(emp.position || '—')}</div>
      </div>
      <div class="ess-card">
        <div class="ess-row"><span class="label">Employee ID</span><span class="value">${escapeHtml(emp.employeeCode || '—')}</span></div>
        <div class="ess-row"><span class="label">Category</span><span class="value">${escapeHtml(emp.category)}</span></div>
        <div class="ess-row"><span class="label">Employment Status</span><span class="value">${escapeHtml(emp.employmentStatus)}</span></div>
        <div class="ess-row"><span class="label">Date Hired</span><span class="value">${fmtDate(emp.dateHired)}</span></div>
      </div>
      <div class="ess-card">
        <div class="ess-card-label">Contact</div>
        <div class="ess-row"><span class="label">Phone</span><span class="value">${escapeHtml(emp.phone || '—')}</span></div>
        <div class="ess-row"><span class="label">Email</span><span class="value">${escapeHtml(emp.email || '—')}</span></div>
      </div>
      <div class="ess-sub" style="text-align:center; margin-top:10px;">To update your information, contact HR.</div>
    `;
  }

  return { render };
})();
