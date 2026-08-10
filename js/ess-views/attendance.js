window.EssViews.attendance = (function () {
  let period = 'week'; // 'day' | 'week' | 'month'

  function periodRange() {
    const today = todayISO();
    if (period === 'day') return { from: today, to: today };
    if (period === 'month') {
      const d = new Date(today + 'T00:00:00');
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { from, to: today };
    }
    return { from: addDays(today, -6), to: today }; // week
  }

  // NSD/OT/Holiday pay only ever count once HR approves the request (js/store.js
  // computeDayPay checks for 'Approved') — this renders that row's current state: a
  // Request button (only when the day is actually eligible — real night-shift hours,
  // real overtime hours, or an actual holiday), a Pending badge with Cancel, a Rejected
  // badge with Request-again, the approved value with an Edit link (re-opens it for HR
  // review — the trigger-enforced RLS policy lets an employee move their own request back
  // to 'Requested' from any state, just never straight to Approved/Rejected themselves),
  // or a plain "—" when the day was never eligible in the first place (nothing to request).
  // Only OT actually rewrites the record's timeOut/hours (via openOtRequestModal) — the
  // fields the DB trigger locks to a 24-hour edit window (enforce_employee_attendance_update
  // in supabase/schema.sql). NSD/Holiday only ever flip their own status field, which isn't
  // covered by that window, so they stay requestable/editable anytime. Past that window for
  // OT, Request/Request-again/Edit are hidden — same boundary as openEditDayModal, same
  // "use Report Attendance Concern instead" story.
  function requestRow(rec, statusVal, label, valueWhenApproved, kind, eligible) {
    const recId = rec.id;
    const timeGated = kind === 'ot' && !withinEditWindow(rec);
    let action;
    if (statusVal === 'Approved') {
      action = `<strong>${escapeHtml(valueWhenApproved)}</strong> <span class="badge badge-green">Approved</span>` +
        (timeGated ? '' : ` <button type="button" class="link-btn" data-request="${kind}" data-rec-id="${recId}">Edit</button>`);
    } else if (statusVal === 'Requested') {
      action = `<span class="badge badge-yellow">Pending approval</span> <button type="button" class="link-btn" data-cancel-request="${kind}" data-rec-id="${recId}">Cancel</button>`;
    } else if (statusVal === 'Rejected') {
      action = `<span class="badge badge-red">Rejected</span>` +
        (timeGated ? '' : ` <button type="button" class="link-btn" data-request="${kind}" data-rec-id="${recId}">Request again</button>`);
    } else if (eligible) {
      action = timeGated
        ? `<span class="dim" title="More than 24 hours old — use Report Attendance Concern instead">—</span>`
        : `<button type="button" class="link-btn" data-request="${kind}" data-rec-id="${recId}">Request</button>`;
    } else {
      action = `<span class="dim">—</span>`;
    }
    return `<div class="ess-row"><span class="label">${label}</span><span class="value">${action}</span></div>`;
  }

  function dayCard(emp, date, rec, holiday) {
    const dow = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (emp.rate / (workDaysInRange(date, date) || 1));
    const pay = rec ? computeDayPay(dailyRateEq, rec, holiday) : null;
    const nsdRawHrs = rec ? nightOverlapHours(rec.timeIn, rec.timeOut) : 0;
    const holidayLabel = holiday ? `Holiday Pay — ${escapeHtml(holiday.name)} (${escapeHtml(holiday.type)} Holiday)` : 'Holiday Pay';
    // Edit AND Delete only ever make sense within the same 24-hour window the DB enforces
    // (both the update trigger and the delete RLS policy) -- past that, previous attendance
    // is locked: no button at all, just "Report Attendance Concern" for corrections.
    const editable = rec ? withinEditWindow(rec) : false;
    return `
      <div class="ess-card">
        <div class="ess-card-label" style="display:flex; justify-content:space-between; align-items:center;">
          <span>${dow}</span>
          ${rec && editable ? `<button type="button" class="link-btn" data-edit-day="${rec.id}" title="Edit or delete this day's attendance">✏️ Edit</button>` : ''}
        </div>
        ${rec ? `
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(rec.timeIn)} ✅ ${editable ? `<button class="link-btn" data-manage-photo="in" data-rec-id="${rec.id}" title="Edit or delete photo">⋯</button>` : ''}</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${rec.timeOut ? to12Hour(rec.timeOut) : '—'} ${rec.timeOut && editable ? `<button class="link-btn" data-manage-photo="out" data-rec-id="${rec.id}" title="Edit or delete photo">⋯</button>` : ''}</span></div>
        <div class="ess-row"><span class="label">Hours</span><span class="value">${rec.hours}</span></div>
        <div class="ess-row"><span class="label">Status</span><span class="value">${escapeHtml(rec.status)}</span></div>
        ${requestRow(rec, rec.nsdStatus, 'Night Shift Diff.', pay.nsdHrs.toFixed(2) + ' hr', 'nsd', nsdRawHrs > 0)}
        ${requestRow(rec, rec.otStatus, 'Overtime', pay.otHrs.toFixed(2) + ' hr', 'ot', true)}
        ${requestRow(rec, rec.holidayStatus, holidayLabel, fmtMoney(pay.holidayPay), 'holiday', !!holiday)}
        ${Number(rec.hours) < 8 ? `<div class="ess-row"><span class="label">Undertime</span><span class="value">${(8 - Number(rec.hours)).toFixed(2)} hr</span></div>` : ''}
        ` : `<div class="ess-sub">Not logged${holiday ? ' · ' + escapeHtml(holiday.name) : ''}</div>`}
      </div>
    `;
  }

  // One action button per Time In/Out entry — view, replace, or delete the photo attached
  // to it, on any day including past ones. Never touches the recorded time/hours/status;
  // the trigger-enforced RLS policy only ever lets this path change the photo field.
  function openPhotoActions(main, emp, rec, kind) {
    const path = kind === 'in' ? rec.timeInPhotoPath : rec.timeOutPhotoPath;
    const label = kind === 'in' ? 'Time In' : 'Time Out';
    openEssModal(`
      <h2>${label} Photo</h2>
      <div class="modal-sub">${fmtDate(rec.date)}</div>
      <div class="modal-actions" style="flex-direction:column; gap:8px; align-items:stretch;">
        ${path ? `<button type="button" class="btn btn-ghost" id="act-view" style="width:100%; justify-content:center;">📷 View Photo</button>` : ''}
        <button type="button" class="btn btn-ghost" id="act-replace" style="width:100%; justify-content:center;">🔄 ${path ? 'Replace Photo' : 'Add Photo'}</button>
        ${path ? `<button type="button" class="btn btn-danger" id="act-delete" style="width:100%; justify-content:center;">🗑 Delete Photo</button>` : ''}
        <button type="button" class="btn btn-ghost" data-close-modal style="width:100%; justify-content:center;">Cancel</button>
      </div>
    `, (bd) => {
      const viewBtn = qs('#act-view', bd);
      if (viewBtn) viewBtn.addEventListener('click', () => viewPhoto(path));
      qs('#act-replace', bd).addEventListener('click', () => { closeEssModal(); openReplaceCapture(main, emp, rec, kind); });
      const deleteBtn = qs('#act-delete', bd);
      if (deleteBtn) deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this photo? This cannot be undone.')) return;
        await Store.deleteAttendancePhoto(path);
        await Store.updateAttendance(rec.id, kind === 'in' ? { timeInPhotoPath: null } : { timeOutPhotoPath: null });
        toast('✔ Photo deleted.');
        closeEssModal();
        render(main, emp);
      });
    });
  }

  // Re-uses the same camera/overlay pipeline as clock-in/out, but only ever writes the
  // photo path field on an existing record — the date/time/hours/status never change,
  // which is what lets this run safely on past-day records too.
  function openReplaceCapture(main, emp, rec, kind) {
    let stream = null;
    openEssModal(`
      <h2>${kind === 'in' ? 'Time In' : 'Time Out'} Photo</h2>
      <div class="modal-sub">${fmtDate(rec.date)} — center your face in the frame, then capture.</div>
      <div class="ess-cam-wrap">
        <video id="cam-video" autoplay playsinline muted></video>
        <canvas id="cam-canvas" style="display:none;"></canvas>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="button" class="btn btn-primary" id="btn-capture" disabled>Starting camera…</button>
      </div>
    `, (bdEl) => {
      qs('[data-close-modal]', bdEl).addEventListener('click', () => stopStream(stream));
      const video = qs('#cam-video', bdEl);
      const canvas = qs('#cam-canvas', bdEl);
      const captureBtn = qs('#btn-capture', bdEl);
      const locPromise = bestEffortLocation();

      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then((s) => {
        stream = s;
        video.srcObject = stream;
        fitCamWrapToStream(bdEl, video);
        captureBtn.disabled = false;
        captureBtn.textContent = 'Capture';
      }).catch(() => {
        captureBtn.textContent = 'Camera unavailable';
        toast('Could not access the camera — check your browser/device permissions.');
      });

      captureBtn.addEventListener('click', async () => {
        if (!stream) return;
        const locationText = await locPromise;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        drawMirroredVideoFrame(ctx, video, canvas.width, canvas.height);
        drawOverlay(ctx, canvas.width, canvas.height, emp, locationText);
        showReplacePreview(bdEl, canvas, main, emp, rec, kind, stream, locationText);
      });
    });
  }

  function showReplacePreview(bdEl, canvas, main, emp, rec, kind, stream, locationText) {
    const video = qs('#cam-video', bdEl);
    video.style.display = 'none';
    let img = qs('#cam-preview-img', bdEl);
    if (!img) {
      img = document.createElement('img');
      img.id = 'cam-preview-img';
      qs('.ess-cam-wrap', bdEl).appendChild(img);
    }
    img.src = canvas.toDataURL('image/jpeg', 0.85);
    img.style.display = 'block';

    const actions = qs('.modal-actions', bdEl);
    actions.innerHTML = `
      <button type="button" class="btn btn-ghost" id="btn-retake">Retake</button>
      <button type="button" class="btn btn-primary" id="btn-confirm">Save Photo</button>
    `;
    qs('#btn-retake', bdEl).addEventListener('click', () => {
      img.style.display = 'none';
      video.style.display = 'block';
      actions.innerHTML = `<button type="button" class="btn btn-ghost" data-close-modal>Cancel</button><button type="button" class="btn btn-primary" id="btn-capture">Capture</button>`;
      qs('[data-close-modal]', bdEl).addEventListener('click', () => stopStream(stream));
      qs('#btn-capture', bdEl).addEventListener('click', () => {
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        drawMirroredVideoFrame(ctx, video, canvas.width, canvas.height);
        drawOverlay(ctx, canvas.width, canvas.height, emp, locationText);
        showReplacePreview(bdEl, canvas, main, emp, rec, kind, stream, locationText);
      });
    });
    qs('#btn-confirm', bdEl).addEventListener('click', () => {
      const confirmBtn = qs('#btn-confirm', bdEl);
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Saving…';
      canvas.toBlob(async (blob) => {
        try {
          const oldPath = kind === 'in' ? rec.timeInPhotoPath : rec.timeOutPhotoPath;
          const path = await Store.uploadAttendancePhoto(emp.id, blob, kind);
          const location = combineLocationText(locationText) || null;
          await Store.updateAttendance(rec.id, kind === 'in' ? { timeInPhotoPath: path, timeInLocation: location } : { timeOutPhotoPath: path, timeOutLocation: location });
          if (oldPath) await Store.deleteAttendancePhoto(oldPath);
          stopStream(stream);
          closeEssModal();
          toast('✔ Photo saved.');
          render(main, emp);
        } catch (e) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Save Photo';
          toast('Could not save photo — check your connection and try again.');
        }
      }, 'image/jpeg', 0.85);
    });
  }

  // Opens a self-clock-in/out photo. Opens the tab synchronously (on the click itself) so
  // Safari doesn't treat the async signed-URL fetch as a blocked popup.
  function viewPhoto(path) {
    if (!path) return;
    const win = window.open('', '_blank');
    Store.getSignedPhotoUrl(path).then((url) => {
      if (url && win) win.location.href = url;
      else if (win) win.close();
    });
  }

  function render(main, emp) {
    const today = todayISO();
    const todayRec = Store.attendanceForDate(today).find(r => r.employeeId === emp.id);
    const { from, to } = periodRange();
    const holidays = Store.holidaysInRange(from, to);
    const holidayByDate = {};
    holidays.forEach(h => { holidayByDate[h.date] = h; });
    const records = Store.attendanceInRange(from, to).filter(r => r.employeeId === emp.id);
    const recByDate = {};
    records.forEach(r => { recByDate[r.date] = r; });

    const days = [];
    let d = to;
    while (d >= from) { days.push(d); d = addDays(d, -1); }

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0; display:flex; justify-content:space-between; align-items:center;">
        <span>Today's Attendance</span>
        ${todayRec && withinEditWindow(todayRec) ? `<button type="button" class="link-btn" data-edit-day="${todayRec.id}" title="Edit or delete today's attendance">✏️ Edit</button>` : ''}
      </div>
      <div class="ess-card">
        ${todayRec ? `
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(todayRec.timeIn)} ✅ ${withinEditWindow(todayRec) ? `<button class="link-btn" data-manage-photo="in" data-rec-id="${todayRec.id}" title="Edit or delete photo">⋯</button>` : ''}</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${todayRec.timeOut ? to12Hour(todayRec.timeOut) + ' ✅' : '—'} ${todayRec.timeOut && withinEditWindow(todayRec) ? `<button class="link-btn" data-manage-photo="out" data-rec-id="${todayRec.id}" title="Edit or delete photo">⋯</button>` : ''}</span></div>
        <div class="ess-row"><span class="label">Status</span><span class="value">${escapeHtml(todayRec.status)}</span></div>
        ` : `<div class="ess-sub">No attendance logged yet for today.</div>`}
      </div>

      ${!todayRec ? `<button class="btn btn-primary" id="btn-clock-in" style="width:100%; justify-content:center; margin-bottom:14px;">🕒 Time In</button>` : ''}
      ${todayRec && !todayRec.timeOut ? `<button class="btn btn-primary" id="btn-clock-out" style="width:100%; justify-content:center; margin-bottom:14px;">🕒 Time Out</button>` : ''}
      ${todayRec && todayRec.timeOut ? `<div class="ess-sub" style="text-align:center; margin-bottom:14px;">✔ Done for today</div>` : ''}

      ${todayRec ? `<button class="btn btn-ghost btn-sm" id="btn-delete-redo" style="width:100%; justify-content:center; margin-bottom:6px;">Delete &amp; Redo Today's Attendance</button>` : ''}
      <button class="btn btn-ghost btn-sm" id="btn-photo-gallery" style="width:100%; justify-content:center; margin-bottom:6px;">📷 Photo Gallery</button>
      <button class="btn btn-ghost btn-sm" id="btn-report-concern" style="width:100%; justify-content:center; margin-bottom:6px;">Report Attendance Concern</button>

      <div class="ess-section-title">History</div>
      <div class="seg" id="seg-period" style="margin-bottom:12px;">
        ${['day', 'week', 'month'].map(p => `<button data-val="${p}" class="${period === p ? 'active' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}
      </div>
      ${days.map(date => dayCard(emp, date, recByDate[date], holidayByDate[date])).join('')}
    `;

    qsa('#seg-period button', main).forEach(b => b.addEventListener('click', () => { period = b.dataset.val; render(main, emp); }));
    qs('#btn-report-concern', main).addEventListener('click', () => openConcernForm(main, emp));
    const clockInBtn = qs('#btn-clock-in', main);
    if (clockInBtn) clockInBtn.addEventListener('click', () => openCameraCapture(main, emp, 'in'));
    const clockOutBtn = qs('#btn-clock-out', main);
    if (clockOutBtn) clockOutBtn.addEventListener('click', () => openCameraCapture(main, emp, 'out'));
    const deleteRedoBtn = qs('#btn-delete-redo', main);
    if (deleteRedoBtn) deleteRedoBtn.addEventListener('click', () => deleteAndRedoToday(main, emp, todayRec));
    qs('#btn-photo-gallery', main).addEventListener('click', () => openPhotoGallery(main, emp));
    qsa('[data-request]', main).forEach(b => b.addEventListener('click', async () => {
      const kind = b.dataset.request;
      const recId = b.dataset.recId;
      if (kind === 'ot') {
        const rec = recId === (todayRec && todayRec.id) ? todayRec : records.find(r => r.id === recId);
        if (rec) openOtRequestModal(main, emp, rec);
        return;
      }
      await Store.updateAttendance(recId, { [kind + 'Status']: 'Requested' });
      toast('✔ Requested — waiting on HR approval.');
      render(main, emp);
    }));
    qsa('[data-cancel-request]', main).forEach(b => b.addEventListener('click', async () => {
      const field = b.dataset.cancelRequest + 'Status';
      await Store.updateAttendance(b.dataset.recId, { [field]: null });
      toast('Request cancelled.');
      render(main, emp);
    }));
    qsa('[data-manage-photo]', main).forEach(b => b.addEventListener('click', () => {
      const recId = b.dataset.recId;
      const rec = recId === (todayRec && todayRec.id) ? todayRec : records.find(r => r.id === recId);
      if (rec) openPhotoActions(main, emp, rec, b.dataset.managePhoto);
    }));
    qsa('[data-edit-day]', main).forEach(b => b.addEventListener('click', () => {
      const recId = b.dataset.editDay;
      const rec = recId === (todayRec && todayRec.id) ? todayRec : records.find(r => r.id === recId);
      if (rec) openEditDayModal(main, emp, rec);
    }));

    updateOfflineBanner(main, emp);
    ensureOnlineListener(emp);
    trySyncQueue(emp); // fire-and-forget: catches the case of reopening the app already online
  }

  // Every Time In / Time Out photo the employee has ever taken, newest first, with a
  // delete option on each — including past days. Deleting only clears that one photo
  // field (via the trigger-enforced RLS policy); the attendance row's actual date/time/
  // hours/status can never change through this path, only which photo (if any) backs it.
  function openPhotoGallery(main, emp) {
    function tiles() {
      const all = Store.listAttendance().filter(r => r.employeeId === emp.id).sort((a, b) => b.date.localeCompare(a.date));
      const out = [];
      all.forEach(rec => {
        if (rec.timeInPhotoPath) out.push({ rec, kind: 'in', path: rec.timeInPhotoPath, label: 'Time In' });
        if (rec.timeOutPhotoPath) out.push({ rec, kind: 'out', path: rec.timeOutPhotoPath, label: 'Time Out' });
      });
      return out;
    }

    function gridHtml() {
      const t = tiles();
      if (!t.length) return '<div class="ess-empty" style="grid-column:1/-1;">No photos yet.</div>';
      return t.map(x => `
        <div class="gallery-tile" data-path="${escapeHtml(x.path)}" data-rec-id="${x.rec.id}" data-kind="${x.kind}"
          style="border:1px solid var(--border-soft); border-radius:8px; padding:6px; text-align:center; font-size:11px;">
          <div data-view-tile style="cursor:pointer; padding:18px 0; background:var(--bg-elevated); border-radius:6px; font-size:22px;">📷</div>
          <div style="margin-top:6px; font-weight:700; font-size:13px;">${fmtDate(x.rec.date)}</div>
          <div style="color:var(--text-faint);">${x.label}</div>
          <button type="button" class="btn btn-danger btn-sm" data-delete-tile style="width:100%; margin-top:6px; justify-content:center;">🗑 Delete</button>
        </div>
      `).join('');
    }

    openEssModal(`
      <h2>Photo Gallery</h2>
      <div class="modal-sub">All your Time In / Time Out photos. Tap a photo to view it, or Delete to remove it — including past days.</div>
      <div id="gallery-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; max-height:55vh; overflow-y:auto; margin-top:12px;">
        ${gridHtml()}
      </div>
    `, (bd) => wireGallery(bd));

    function wireGallery(bd) {
      qsa('[data-view-tile]', bd).forEach((el) => {
        el.addEventListener('click', () => viewPhoto(el.closest('.gallery-tile').dataset.path));
      });
      qsa('[data-delete-tile]', bd).forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this photo? This cannot be undone.')) return;
          const tile = btn.closest('.gallery-tile');
          const { path, recId, kind } = tile.dataset;
          btn.disabled = true;
          btn.textContent = 'Deleting…';
          await Store.deleteAttendancePhoto(path);
          await Store.updateAttendance(recId, kind === 'in' ? { timeInPhotoPath: null } : { timeOutPhotoPath: null });
          toast('✔ Photo deleted');
          tile.remove();
          render(main, emp);
        });
      });
    }
  }

  // Requesting OT asks for the exact time the employee actually finished, including the
  // overtime worked — not just a status flip. That updates the day's real Time Out/Hours,
  // so once HR approves, the dashboard's OT hours (hours - 8) are already correct with no
  // manual calculation needed on HR's end.
  function openOtRequestModal(main, emp, rec) {
    openEssModal(`
      <h2>Request Overtime</h2>
      <div class="modal-sub">${fmtDate(rec.date)} — enter the exact time you finished, including the overtime. HR will review and approve before it counts toward pay.</div>
      <form id="ot-request-form">
        <div class="modal-grid">
          <div class="field"><label>Time In</label><input type="time" value="${escapeHtml(rec.timeIn || '')}" disabled /></div>
          <div class="field"><label>Actual Time Out</label><input type="time" name="timeOut" id="ot-time-out" required value="${escapeHtml(rec.timeOut || '')}" /></div>
        </div>
        <div id="ot-preview" class="modal-sub"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Submit Request</button>
        </div>
      </form>
    `, (bd) => {
      const timeOutInput = qs('#ot-time-out', bd);
      const preview = qs('#ot-preview', bd);
      function updatePreview() {
        if (!rec.timeIn || !timeOutInput.value) { preview.textContent = ''; return; }
        const hrs = hoursBetween(rec.timeIn, timeOutInput.value);
        const ot = Math.max(0, hrs - 8);
        preview.textContent = ot > 0
          ? `Total hours: ${hrs.toFixed(2)} — overtime: ${ot.toFixed(2)} hr`
          : `Total hours: ${hrs.toFixed(2)} — that doesn't add up to any overtime yet.`;
      }
      timeOutInput.addEventListener('input', updatePreview);
      updatePreview();

      qs('#ot-request-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const newTimeOut = timeOutInput.value;
        const newHours = hoursBetween(rec.timeIn, newTimeOut);
        if (newHours <= 8) {
          toast('That time doesn\'t add up to any overtime — adjust it or cancel.');
          return;
        }
        await Store.updateAttendance(rec.id, { timeOut: newTimeOut, hours: newHours, otStatus: 'Requested' });
        toast('✔ Overtime requested — waiting on HR approval.');
        closeEssModal();
        render(main, emp);
      });
    });
  }

  const ATTENDANCE_STATUS_OPTIONS = ['Present', 'Late', 'Absent', 'On Leave'];

  // Lets an employee correct their own Time In/Out/status directly, or delete the whole
  // record, on ANY day including past ones -- product decision to let them fix a mistake
  // without waiting on HR. Which day it is and whose record it is can never change (the
  // trigger-enforced RLS policy blocks that), and every change still lands in HR's audit
  // log via js/store.js's updateRow/deleteRow.
  // Time In/Out/Status may only be edited within 24 hours of when the record was
  // originally created ("uploaded") -- enforced for real by the DB trigger
  // (enforce_employee_attendance_update in supabase/schema.sql), mirrored here so the
  // employee sees why the fields are locked instead of a save just silently failing.
  function withinEditWindow(rec) {
    if (!rec.created_at) return true; // no timestamp on record (shouldn't happen) -- fail open to editable
    return (Date.now() - new Date(rec.created_at).getTime()) < 24 * 3600000;
  }

  // Only ever reachable via a data-edit-day button, which render()/dayCard() now only
  // render when withinEditWindow(rec) is true -- so past attendance (>24h old) never
  // gets here at all, not even a locked-down read-only view of this modal.
  function openEditDayModal(main, emp, rec) {
    openEssModal(`
      <h2>Edit Attendance</h2>
      <div class="modal-sub">${fmtDate(rec.date)} — changes save immediately and are recorded in HR's audit log.</div>
      <form id="edit-day-form">
        <div class="modal-grid">
          <div class="field"><label>Time In</label><input type="time" name="timeIn" value="${escapeHtml(rec.timeIn || '')}" required /></div>
          <div class="field"><label>Time Out</label><input type="time" name="timeOut" value="${escapeHtml(rec.timeOut || '')}" /></div>
          <div class="field full"><label>Status</label>
            <select name="status">${ATTENDANCE_STATUS_OPTIONS.map(s => `<option ${s === rec.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
        </div>
        <div class="modal-actions" style="justify-content:space-between;">
          <button type="button" class="btn btn-danger" id="btn-delete-day">Delete</button>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </div>
      </form>
    `, (bd) => {
      qs('#edit-day-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const timeIn = fd.get('timeIn');
        const timeOut = fd.get('timeOut') || null;
        const status = fd.get('status');
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        await Store.updateAttendance(rec.id, {
          timeIn, timeOut, status,
          hours: timeOut ? hoursBetween(timeIn, timeOut) : 0,
        });
        toast('✔ Attendance updated.');
        closeEssModal();
        render(main, emp);
      });
      qs('#btn-delete-day', bd).addEventListener('click', async () => {
        if (!confirm(`Delete your attendance record for ${fmtDate(rec.date)}? This cannot be undone.`)) return;
        await Promise.all([
          rec.timeInPhotoPath ? Store.deleteAttendancePhoto(rec.timeInPhotoPath) : null,
          rec.timeOutPhotoPath ? Store.deleteAttendancePhoto(rec.timeOutPhotoPath) : null,
        ]);
        await Store.deleteAttendance(rec.id);
        toast('✔ Attendance record deleted.');
        closeEssModal();
        render(main, emp);
      });
    });
  }

  async function deleteAndRedoToday(main, emp, rec) {
    if (!confirm("Delete today's Time In/Out and start over? This can't be undone.")) return;
    await Store.deleteAttendance(rec.id);
    await Promise.all([
      rec.timeInPhotoPath ? Store.deleteAttendancePhoto(rec.timeInPhotoPath) : null,
      rec.timeOutPhotoPath ? Store.deleteAttendancePhoto(rec.timeOutPhotoPath) : null,
    ]);
    toast("✔ Today's attendance deleted — you can log it again.");
    render(main, emp);
  }

  function stopStream(stream) {
    if (stream) stream.getTracks().forEach(t => t.stop());
  }

  // The live preview is mirrored (css/ess.css .ess-cam-wrap video { transform: scaleX(-1) })
  // so it feels like a normal selfie camera -- but the captured frame used to be drawn
  // unmirrored, so the saved photo never matched what the employee just saw and confirmed.
  // Mirroring the actual pixels here (before drawOverlay stamps text on top) makes the
  // saved/uploaded photo match the live preview one-to-one; the overlay text/logo is drawn
  // afterward in the untransformed context so it still reads correctly, not flipped.
  function drawMirroredVideoFrame(ctx, video, w, h) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
  }

  // Matches the on-screen camera box to the actual camera's native aspect ratio, instead
  // of a fixed portrait crop -- a phone's front camera is naturally portrait-ish, while a
  // laptop/desktop webcam is landscape, so hardcoding one ratio cropped whichever device
  // didn't match it. Since the box now always matches the real stream, the captured photo
  // (and its overlay, sized off the same canvas.width/height) always shows the full frame
  // with no forced crop on any device.
  function fitCamWrapToStream(bdEl, video) {
    const wrap = qs('.ess-cam-wrap', bdEl);
    if (!wrap) return;
    const apply = () => {
      if (video.videoWidth && video.videoHeight) {
        wrap.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
      }
    };
    if (video.videoWidth) apply();
    else video.addEventListener('loadedmetadata', apply, { once: true });
  }

  // Original brand mark, preloaded once so it's ready by the time a photo is captured.
  let logoImg = null;
  (function preloadLogo() {
    const img = new Image();
    img.onload = () => { logoImg = img; };
    img.src = 'assets/logo.svg';
  })();

  function roundRect(ctx, x, y, rw, rh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, r);
    ctx.arcTo(x + rw, y + rh, x, y + rh, r);
    ctx.arcTo(x, y + rh, x, y, r);
    ctx.arcTo(x, y, x + rw, y, r);
    ctx.closePath();
  }

  function drawCheckBadge(ctx, cx, cy, r) {
    ctx.save();
    ctx.fillStyle = '#3fc46a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1.5, r * 0.28);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.4);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.4);
    ctx.stroke();
    ctx.restore();
  }

  // Greedy word-wrap for canvas text -- fillText never wraps on its own, and the address
  // stamped below is now a full street address (building/street/village/barangay/city/
  // postal code), long enough to overflow a single line at the frame's width.
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  // Draws the same info a physical time clock would stamp — logo, time, date, location,
  // name, company, verification code — directly onto the captured frame. Original design
  // (our own brand, wordmark and layout), not copied from any third-party product.
  function drawOverlay(ctx, w, h, emp, locationInfo) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hh = now.getHours();
    const ampm = hh < 12 ? 'AM' : 'PM';
    const hh12 = hh % 12 === 0 ? 12 : hh % 12;
    const timeStr = `${hh12}:${pad(now.getMinutes())}`;
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dowStr = now.toLocaleDateString('en-US', { weekday: 'short' });
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();

    const scrimH = h * 0.58;
    const grad = ctx.createLinearGradient(0, h - scrimH, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - scrimH, w, scrimH);

    const px = w * 0.05;
    let y = h - scrimH + h * 0.055;

    ctx.textAlign = 'left';
    if (logoImg && logoImg.naturalWidth) {
      const logoH = w * 0.1;
      const logoW = logoH * (logoImg.naturalWidth / logoImg.naturalHeight);
      const padX = w * 0.018, padY = logoH * 0.22;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      roundRect(ctx, px - padX, y - logoH - padY, logoW + padX * 2, logoH + padY * 2, w * 0.014);
      ctx.fill();
      ctx.drawImage(logoImg, px, y - logoH, logoW, logoH);
    } else {
      ctx.font = `800 ${Math.round(w * 0.05)}px Arial`;
      ctx.fillStyle = '#4f8dff';
      ctx.fillText('TXT', px, y);
      const txtW = ctx.measureText('TXT').width;
      ctx.fillStyle = '#3fc46a';
      ctx.fillText('AIRE', px + txtW, y);
    }

    y += w * 0.13;
    ctx.font = `800 ${Math.round(w * 0.12)}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(timeStr, px, y);
    const timeW = ctx.measureText(timeStr).width;
    ctx.font = `600 ${Math.round(w * 0.032)}px Arial`;
    ctx.fillText(ampm, px + timeW + w * 0.012, y);

    const dividerX = px + timeW + w * 0.075;
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(dividerX, y - w * 0.075);
    ctx.lineTo(dividerX, y);
    ctx.stroke();

    const dateX = dividerX + w * 0.025;
    ctx.font = `600 ${Math.round(w * 0.03)}px Arial`;
    ctx.fillStyle = '#f2c14e';
    ctx.fillText(dateStr, dateX, y - w * 0.036);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dowStr, dateX, y);

    y += w * 0.05;
    if (locationInfo && locationInfo.text) {
      ctx.font = `500 ${Math.round(w * 0.028)}px Arial`;
      ctx.fillStyle = '#ffffff';
      // Cap at 3 lines -- a full address can run long; the complete text is still saved
      // in full to timeInLocation/timeOutLocation regardless of what fits on the stamp.
      const lines = wrapText(ctx, locationInfo.text, w - px * 2).slice(0, 3);
      const lineH = w * 0.036;
      lines.forEach((line, i) => ctx.fillText(line, px, y + i * lineH));
      y += lineH * lines.length + w * 0.014;
    }
    // Exact GPS coordinates — the actual proof of location, always shown whenever a fix
    // was obtained even if reverse geocoding (the readable city/region above) failed.
    if (locationInfo && locationInfo.coordsText) {
      ctx.font = `500 ${Math.round(w * 0.022)}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`GPS: ${locationInfo.coordsText}`, px, y);
      y += w * 0.04;
    }

    y += w * 0.015;
    const boxH = w * 0.16;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, px, y, w - px * 2, boxH, w * 0.02);
    ctx.fill();
    ctx.font = `600 ${Math.round(w * 0.03)}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Name: ${emp.name}`, px + w * 0.025, y + boxH * 0.42);
    ctx.fillText('Company: TXTAIRE', px + w * 0.025, y + boxH * 0.82);
    y += boxH + w * 0.035;

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(w - px, y);
    ctx.stroke();
    y += w * 0.045;

    drawCheckBadge(ctx, px + w * 0.014, y - w * 0.013, w * 0.017);
    ctx.font = `500 ${Math.round(w * 0.024)}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`Photo Code: ${code}`, px + w * 0.042, y);

    ctx.save();
    ctx.translate(w - w * 0.025, h - h * 0.035);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.font = `500 ${Math.round(w * 0.02)}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`© ${code}   TXTAIRE Verified`, 0, 0);
    ctx.restore();
  }

  function formatCoords(latitude, longitude, accuracy) {
    const lat = Math.abs(latitude).toFixed(5) + '° ' + (latitude >= 0 ? 'N' : 'S');
    const lon = Math.abs(longitude).toFixed(5) + '° ' + (longitude >= 0 ? 'E' : 'W');
    const acc = accuracy ? ` (±${Math.round(accuracy)}m)` : '';
    return `${lat}, ${lon}${acc}`;
  }

  // Returns { text, coordsText } — text is a full best-effort street address (building,
  // street, village, barangay, city, postal code — reverse-geocoded), coordsText is the
  // exact GPS coordinates straight from the device, always included whenever a location
  // fix is available even if reverse geocoding fails or is slow, since the coordinates
  // are the actual proof of location.
  function bestEffortLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ text: '', coordsText: '' });
      const timer = setTimeout(() => resolve({ text: '', coordsText: '' }), 6000);
      navigator.geolocation.getCurrentPosition(async (pos) => {
        clearTimeout(timer);
        const { latitude, longitude, accuracy } = pos.coords;
        const coordsText = formatCoords(latitude, longitude, accuracy);
        try {
          // zoom=18 + addressdetails=1 -- building/street-level detail (vs. the previous
          // zoom=12 city/region-only lookup), so the structured address object below
          // actually has road/building/village/suburb/postcode to pull from.
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const data = await res.json();
          const a = data.address || {};
          // Nominatim/OSM has no dedicated "barangay" field -- Philippine barangays are
          // typically tagged as suburb or quarter. village/neighbourhood is kept separate
          // since a subdivision/village name and its barangay are often different things.
          const street = [a.house_number, a.road].filter(Boolean).join(' ');
          const building = a.building && a.building !== street ? a.building : '';
          const village = a.village || a.neighbourhood || '';
          // OSM's suburb/quarter tag for a PH barangay sometimes already includes the word
          // "Barangay" in its name -- strip it before comparing/prefixing, or a suburb tagged
          // exactly the same as the village produces a duplicated "Brgy. Barangay X".
          const barangaySrc = (a.suburb || a.quarter || a.city_district || '').replace(/^barangay\s+/i, '');
          const barangay = barangaySrc && barangaySrc !== village ? 'Brgy. ' + barangaySrc : '';
          const city = a.city || a.town || a.municipality || '';
          const postcode = a.postcode || '';
          const line = [building, street, village, barangay, city].filter(Boolean).join(', ');
          const text = postcode ? [line, postcode].filter(Boolean).join(' ') : line;
          resolve({ text: text || data.display_name || '', coordsText });
        } catch (e) { resolve({ text: '', coordsText }); }
      }, () => { clearTimeout(timer); resolve({ text: '', coordsText: '' }); }, { timeout: 6000, enableHighAccuracy: true });
    });
  }

  // bestEffortLocation() returns { text, coordsText } -- combines both into one plain-text
  // string (e.g. "Quezon City, Metro Manila · 14.65200° N, 121.03680° E (±15m)") for the
  // timeInLocation/timeOutLocation columns, the same info already stamped onto the photo
  // overlay, now also queryable/visible without opening the photo.
  function combineLocationText(locationInfo) {
    if (!locationInfo) return '';
    return [locationInfo.text, locationInfo.coordsText].filter(Boolean).join(' · ');
  }

  // timeStr/date are always captured at the moment the employee presses Confirm — never
  // recomputed here — so a clock-in/out queued offline still records the real time it
  // happened, not whenever the connection happens to come back and this finally runs.
  async function saveClockEvent(emp, kind, photoPath, timeStr, date, locationText) {
    const location = combineLocationText(locationText) || null;
    if (kind === 'in') {
      await Store.addAttendance({
        employeeId: emp.id, date, status: 'Present',
        timeIn: timeStr, timeOut: null, hours: 0,
        timeInPhotoPath: photoPath,
        timeInLocation: location,
      });
    } else {
      const rec = Store.attendanceForDate(date).find(r => r.employeeId === emp.id);
      if (!rec) { toast('No Time In found for today.'); return; }
      const hours = hoursBetween(rec.timeIn, timeStr);
      const patch = {
        timeOut: timeStr,
        hours,
        timeOutPhotoPath: photoPath,
        timeOutLocation: location,
      };
      // Time In/Time Out photo shows the employee actually worked past the standard
      // 8-hour shift -- automatically files the OT request for HR instead of making the
      // employee remember to click Request separately. Still just a request: js/store.js
      // computeDayPay never counts OT toward pay until HR reviews and sets otStatus to
      // 'Approved' (Attendance -> Requests) -- same as the reminder that travel time past
      // the designated timeout doesn't count as OT unless HR approves it.
      if (hours > 8) patch.otStatus = 'Requested';
      await Store.updateAttendance(rec.id, patch);
    }
  }

  function isLikelyNetworkError(e) {
    return e instanceof TypeError || (e && /fetch|network|failed/i.test(e.message || ''));
  }

  // Stores the captured photo + intended attendance fields in IndexedDB instead of
  // Supabase. Nothing here touches the network — safe to call with no connection at all.
  // locationText travels along too (already resolved before this is called), so a synced-
  // later record still gets the location captured at the actual moment of clock-in/out.
  async function queueOffline(emp, kind, blob, timeStr, date, locationText) {
    await OfflineQueue.add({
      localId: genId('offatt'),
      employeeId: emp.id, kind, timeStr, date, photoBlob: blob,
      locationText: locationText || null,
      createdAt: Date.now(),
    });
  }

  // True only while the employee actually has the Attendance tab open — syncing must never
  // force-navigate them away from Payroll/Leave/Profile just because a background sync
  // finished while they were looking at something else.
  function isAttendanceRouteActive() {
    const btn = document.querySelector('.ess-nav-btn[data-route="attendance"]');
    return !!(btn && btn.classList.contains('active'));
  }

  // Pushes every queued item (oldest first) to Supabase once actually online. Stops at the
  // first failure to keep Time In before Time Out ordering intact — the rest just wait for
  // the next trigger (another 'online' event, or the next time this page renders). Only
  // touches the DOM if Attendance is the tab currently on screen.
  async function trySyncQueue(emp) {
    if (!navigator.onLine) return;
    let pending;
    try { pending = await OfflineQueue.listForEmployee(emp.id); } catch (e) { return; }
    if (!pending.length) return;
    let syncedAny = false;
    for (const item of pending) {
      try {
        const path = await Store.uploadAttendancePhoto(emp.id, item.photoBlob, item.kind);
        await saveClockEvent(emp, item.kind, path, item.timeStr, item.date, item.locationText);
        await OfflineQueue.remove(item.localId);
        syncedAny = true;
      } catch (e) {
        break; // keep this and later items queued; try again on the next trigger
      }
    }
    if (!isAttendanceRouteActive()) return;
    const main = qs('#ess-main');
    if (syncedAny) {
      toast('✔ Synced queued attendance now that you\'re back online.');
      render(main, emp);
    } else {
      updateOfflineBanner(main, emp);
    }
  }

  async function updateOfflineBanner(main, emp) {
    let pending;
    try { pending = await OfflineQueue.listForEmployee(emp.id); } catch (e) { pending = []; }
    const existing = qs('#offline-banner', main);
    if (pending.length) {
      const html = `<div id="offline-banner" class="ess-card" style="background:#fff8e1; border-color:#f2c14e;">📴 ${pending.length} clock-in/out ${pending.length === 1 ? 'is' : 'are'} queued offline — will sync automatically once you're back online.</div>`;
      if (existing) existing.outerHTML = html;
      else main.insertAdjacentHTML('afterbegin', html);
    } else if (existing) {
      existing.remove();
    }
  }

  let onlineListenerAttached = false;
  function ensureOnlineListener(emp) {
    if (onlineListenerAttached) return;
    onlineListenerAttached = true;
    window.addEventListener('online', () => trySyncQueue(emp));
  }

  function showPreview(bdEl, canvas, main, emp, kind, stream, locationText) {
    const video = qs('#cam-video', bdEl);
    video.style.display = 'none';
    let img = qs('#cam-preview-img', bdEl);
    if (!img) {
      img = document.createElement('img');
      img.id = 'cam-preview-img';
      qs('.ess-cam-wrap', bdEl).appendChild(img);
    }
    img.src = canvas.toDataURL('image/jpeg', 0.85);
    img.style.display = 'block';

    const actions = qs('.modal-actions', bdEl);
    actions.innerHTML = `
      <button type="button" class="btn btn-ghost" id="btn-retake">Retake</button>
      <button type="button" class="btn btn-primary" id="btn-confirm">Confirm ${kind === 'in' ? 'Time In' : 'Time Out'}</button>
    `;
    qs('#btn-retake', bdEl).addEventListener('click', () => {
      img.style.display = 'none';
      video.style.display = 'block';
      actions.innerHTML = `<button type="button" class="btn btn-ghost" data-close-modal>Cancel</button><button type="button" class="btn btn-primary" id="btn-capture">Capture</button>`;
      qs('[data-close-modal]', bdEl).addEventListener('click', () => stopStream(stream));
      qs('#btn-capture', bdEl).addEventListener('click', () => {
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        drawMirroredVideoFrame(ctx, video, canvas.width, canvas.height);
        drawOverlay(ctx, canvas.width, canvas.height, emp, locationText);
        showPreview(bdEl, canvas, main, emp, kind, stream, locationText);
      });
    });
    qs('#btn-confirm', bdEl).addEventListener('click', () => {
      const confirmBtn = qs('#btn-confirm', bdEl);
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Saving…';
      // Captured now, at the moment of confirming — never recomputed later, so a clock-in/
      // out that ends up queued offline still records the real time it actually happened.
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const date = todayISO();

      canvas.toBlob(async (blob) => {
        if (!navigator.onLine) {
          await queueOffline(emp, kind, blob, timeStr, date, locationText);
          stopStream(stream);
          closeEssModal();
          toast('📴 No connection — queued offline. Will sync automatically once you\'re back online.');
          render(main, emp);
          return;
        }
        try {
          const path = await Store.uploadAttendancePhoto(emp.id, blob, kind);
          await saveClockEvent(emp, kind, path, timeStr, date, locationText);
          stopStream(stream);
          closeEssModal();
          toast(kind === 'in' ? '✔ Time In recorded' : '✔ Time Out recorded');
          render(main, emp);
        } catch (e) {
          if (isLikelyNetworkError(e)) {
            await queueOffline(emp, kind, blob, timeStr, date, locationText);
            stopStream(stream);
            closeEssModal();
            toast('📴 Connection lost — queued offline. Will sync automatically once you\'re back online.');
            render(main, emp);
          } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = `Confirm ${kind === 'in' ? 'Time In' : 'Time Out'}`;
          }
        }
      }, 'image/jpeg', 0.85);
    });
  }

  // Invoked from the bottom-nav "+" quick-clock button, which is reachable from any ESS
  // page — figures out whether today still needs a Time In or a Time Out (or is already
  // done) and opens the same camera flow used on the Attendance page itself.
  function quickClock(main, emp) {
    const today = todayISO();
    const todayRec = Store.attendanceForDate(today).find(r => r.employeeId === emp.id);
    if (!todayRec) { openCameraCapture(main, emp, 'in'); return; }
    if (!todayRec.timeOut) { openCameraCapture(main, emp, 'out'); return; }
    toast('✔ You\'ve already completed today\'s attendance.');
  }

  // GPS is mandatory for the actual Time In/Time Out clock action (not for replacing a
  // photo on an existing record, see openReplaceCapture) -- the Capture button stays
  // disabled until both the camera AND a real location fix (coordsText non-empty) are
  // ready, with a Retry affordance if location fails/denies/times out. Reverse geocoding
  // (locationInfo.text) is still just best-effort city/region -- only coordsText, the
  // actual device GPS reading, gates capture.
  function openCameraCapture(main, emp, kind) {
    let stream = null;
    let cameraReady = false;
    let locationResult = null;
    let locationFailed = false;

    openEssModal(`
      <h2>${kind === 'in' ? 'Time In' : 'Time Out'}</h2>
      <div class="modal-sub">Center your face in the frame, then capture. Location access is required to Time In/Out.</div>
      <div class="ess-cam-wrap">
        <video id="cam-video" autoplay playsinline muted></video>
        <canvas id="cam-canvas" style="display:none;"></canvas>
      </div>
      <div id="loc-status" class="ess-sub" style="margin-bottom:10px;"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="button" class="btn btn-primary" id="btn-capture" disabled>Starting camera…</button>
      </div>
    `, (bdEl) => {
      qs('[data-close-modal]', bdEl).addEventListener('click', () => stopStream(stream));
      const video = qs('#cam-video', bdEl);
      const canvas = qs('#cam-canvas', bdEl);
      const captureBtn = qs('#btn-capture', bdEl);
      const locStatus = qs('#loc-status', bdEl);

      function refreshCaptureButton() {
        if (!cameraReady) { captureBtn.disabled = true; captureBtn.textContent = 'Starting camera…'; return; }
        if (!locationResult) {
          captureBtn.disabled = true;
          captureBtn.textContent = locationFailed ? 'Location required' : 'Getting your location…';
          return;
        }
        captureBtn.disabled = false;
        captureBtn.textContent = 'Capture';
      }

      function tryGetLocation() {
        locationFailed = false;
        locationResult = null;
        locStatus.innerHTML = '📍 Getting your location…';
        refreshCaptureButton();
        bestEffortLocation().then((loc) => {
          if (loc && loc.coordsText) {
            locationResult = loc;
            locStatus.innerHTML = `📍 Location captured${loc.text ? ' — ' + escapeHtml(loc.text) : ''}`;
          } else {
            locationFailed = true;
            locStatus.innerHTML = '⚠️ Location access is required to Time In/Out. Enable location services for this browser/device, then <button type="button" class="link-btn" id="btn-retry-location">Retry</button>.';
            locStatus.style.color = 'var(--red)';
            qs('#btn-retry-location', bdEl).addEventListener('click', tryGetLocation);
          }
          refreshCaptureButton();
        });
      }
      tryGetLocation();

      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then((s) => {
        stream = s;
        video.srcObject = stream;
        fitCamWrapToStream(bdEl, video);
        cameraReady = true;
        refreshCaptureButton();
      }).catch(() => {
        captureBtn.textContent = 'Camera unavailable';
        toast('Could not access the camera — check your browser/device permissions.');
      });

      captureBtn.addEventListener('click', () => {
        if (!stream || !locationResult) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        drawMirroredVideoFrame(ctx, video, canvas.width, canvas.height);
        drawOverlay(ctx, canvas.width, canvas.height, emp, locationResult);
        showPreview(bdEl, canvas, main, emp, kind, stream, locationResult);
      });
    });
  }

  function openConcernForm(main, emp) {
    openEssModal(`
      <h2>Report Attendance Concern</h2>
      <div class="modal-sub">Describe the issue — HR will review and correct the record if approved.</div>
      <form id="concern-form">
        <div class="modal-grid">
          <div class="field full"><label>Date</label><input type="date" name="date" value="${todayISO()}" required max="${todayISO()}" /></div>
          <div class="field full"><label>What happened?</label><textarea name="description" rows="3" required placeholder="e.g. I forgot to time out on July 15."></textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (bd) => {
      qs('#concern-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addAttendanceCorrection({
          employeeId: emp.id,
          date: fd.get('date'),
          description: fd.get('description').trim(),
        });
        toast('✔ Concern submitted — HR will review it.');
        closeEssModal();
        render(main, emp);
      });
    });
  }

  return { render, quickClock };
})();
