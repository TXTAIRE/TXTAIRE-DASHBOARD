window.Views.announcements = (function () {
  function render(main) {
    const rows = Store.listAnnouncements();

    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Announcements</h1>
          <div class="page-sub">Company-wide bulletin, visible to every employee on My Portal.</div>
        </div>
        <button class="btn btn-primary" id="btn-new-announcement">+ Post announcement</button>
      </div>

      <div class="panel">
        ${rows.length ? rows.map(a => `
          <div class="panel" style="margin-bottom:10px; padding:14px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
              <div>
                <div style="font-weight:700;">${a.pinned ? '📌 ' : ''}${escapeHtml(a.title)}</div>
                <div class="dim" style="font-size:11px; margin-top:2px;">${fmtDate((a.created_at || '').slice(0, 10))}${a.postedBy ? ' · ' + escapeHtml(a.postedBy) : ''}</div>
              </div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="link-btn" data-edit="${a.id}">Edit</button>
                <button class="link-btn" data-del="${a.id}" style="color:var(--red);">Delete</button>
              </div>
            </div>
            <div class="page-sub" style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(a.body)}</div>
          </div>
        `).join('') : '<div class="empty">No announcements posted yet.</div>'}
      </div>
    `;

    qs('#btn-new-announcement', main).addEventListener('click', () => openForm(main));
    qsa('[data-edit]', main).forEach(b => b.addEventListener('click', () => openForm(main, Store.getAnnouncement(b.dataset.edit))));
    qsa('[data-del]', main).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this announcement?')) return;
      await Store.deleteAnnouncement(b.dataset.del);
      toast('✔ Deleted.');
      render(main);
    }));
  }

  function openForm(main, existing) {
    const a = existing || { title: '', body: '', pinned: false };
    openModal(`
      <h2>${existing ? 'Edit Announcement' : 'Post Announcement'}</h2>
      <form id="ann-form">
        <div class="modal-grid">
          <div class="field full"><label>Title</label><input name="title" required value="${escapeHtml(a.title)}" /></div>
          <div class="field full"><label>Message</label><textarea name="body" rows="5" required>${escapeHtml(a.body)}</textarea></div>
          <div class="field full">
            <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer;">
              <input type="checkbox" name="pinned" ${a.pinned ? 'checked' : ''} style="width:auto;" />
              Pin to top
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Post'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#ann-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          title: fd.get('title').trim(),
          body: fd.get('body').trim(),
          pinned: fd.get('pinned') === 'on',
        };
        if (existing) {
          await Store.updateAnnouncement(existing.id, patch);
          toast('✔ Announcement updated.');
        } else {
          await Store.addAnnouncement(Object.assign({ postedBy: currentUserEmail() }, patch));
          toast('✔ Announcement posted.');
        }
        closeModal();
        render(main);
      });
    });
  }

  return { render };
})();
