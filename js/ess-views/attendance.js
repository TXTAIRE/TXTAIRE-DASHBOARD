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
  // badge with Request-again, the approved value once HR has signed off, or a plain "—"
  // when the day was never eligible in the first place (nothing to request).
  function requestRow(recId, statusVal, label, valueWhenApproved, kind, eligible) {
    let action;
    if (statusVal === 'Approved') action = `<strong>${escapeHtml(valueWhenApproved)}</strong> <span class="badge badge-green">Approved</span>`;
    else if (statusVal === 'Requested') action = `<span class="badge badge-yellow">Pending approval</span> <button type="button" class="link-btn" data-cancel-request="${kind}" data-rec-id="${recId}">Cancel</button>`;
    else if (statusVal === 'Rejected') action = `<span class="badge badge-red">Rejected</span> <button type="button" class="link-btn" data-request="${kind}" data-rec-id="${recId}">Request again</button>`;
    else if (eligible) action = `<button type="button" class="link-btn" data-request="${kind}" data-rec-id="${recId}">Request</button>`;
    else action = `<span class="dim">—</span>`;
    return `<div class="ess-row"><span class="label">${label}</span><span class="value">${action}</span></div>`;
  }

  function dayCard(emp, date, rec, holiday) {
    const dow = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (emp.rate / (workDaysInRange(date, date) || 1));
    const pay = rec ? computeDayPay(dailyRateEq, rec, holiday) : null;
    const nsdRawHrs = rec ? nightOverlapHours(rec.timeIn, rec.timeOut) : 0;
    const otRawHrs = rec ? Math.max(0, Number(rec.hours) - 8) : 0;
    const holidayLabel = holiday ? `Holiday Pay — ${escapeHtml(holiday.name)} (${escapeHtml(holiday.type)} Holiday)` : 'Holiday Pay';
    return `
      <div class="ess-card">
        <div class="ess-card-label">${dow}</div>
        ${rec ? `
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(rec.timeIn)} ✅ ${rec.timeInPhotoPath ? `<button class="link-btn" data-view-photo="${rec.timeInPhotoPath}" title="View photo">📷</button>` : ''}</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${rec.timeOut ? to12Hour(rec.timeOut) : '—'} ${rec.timeOutPhotoPath ? `<button class="link-btn" data-view-photo="${rec.timeOutPhotoPath}" title="View photo">📷</button>` : ''}</span></div>
        <div class="ess-row"><span class="label">Hours</span><span class="value">${rec.hours}</span></div>
        <div class="ess-row"><span class="label">Status</span><span class="value">${escapeHtml(rec.status)}</span></div>
        ${requestRow(rec.id, rec.nsdStatus, 'Night Shift Diff.', pay.nsdHrs.toFixed(2) + ' hr', 'nsd', nsdRawHrs > 0)}
        ${requestRow(rec.id, rec.otStatus, 'Overtime', pay.otHrs.toFixed(2) + ' hr', 'ot', otRawHrs > 0)}
        ${requestRow(rec.id, rec.holidayStatus, holidayLabel, fmtMoney(pay.holidayPay), 'holiday', !!holiday)}
        ${Number(rec.hours) < 8 ? `<div class="ess-row"><span class="label">Undertime</span><span class="value">${(8 - Number(rec.hours)).toFixed(2)} hr</span></div>` : ''}
        ` : `<div class="ess-sub">Not logged${holiday ? ' · ' + escapeHtml(holiday.name) : ''}</div>`}
      </div>
    `;
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
      <div class="ess-section-title" style="margin-top:0;">Today's Attendance</div>
      <div class="ess-card">
        ${todayRec ? `
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(todayRec.timeIn)} ✅ ${todayRec.timeInPhotoPath ? `<button class="link-btn" data-view-photo="${todayRec.timeInPhotoPath}" title="View photo">📷</button>` : ''}</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${todayRec.timeOut ? to12Hour(todayRec.timeOut) + ' ✅' : '—'} ${todayRec.timeOutPhotoPath ? `<button class="link-btn" data-view-photo="${todayRec.timeOutPhotoPath}" title="View photo">📷</button>` : ''}</span></div>
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
    qsa('[data-view-photo]', main).forEach(b => b.addEventListener('click', () => viewPhoto(b.dataset.viewPhoto)));
    qs('#btn-photo-gallery', main).addEventListener('click', () => openPhotoGallery(main, emp));
    qsa('[data-request]', main).forEach(b => b.addEventListener('click', async () => {
      const field = b.dataset.request + 'Status';
      await Store.updateAttendance(b.dataset.recId, { [field]: 'Requested' });
      toast('✔ Requested — waiting on HR approval.');
      render(main, emp);
    }));
    qsa('[data-cancel-request]', main).forEach(b => b.addEventListener('click', async () => {
      const field = b.dataset.cancelRequest + 'Status';
      await Store.updateAttendance(b.dataset.recId, { [field]: null });
      toast('Request cancelled.');
      render(main, emp);
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
          <div style="margin-top:6px; font-weight:600;">${x.label}</div>
          <div style="color:var(--text-faint);">${fmtDate(x.rec.date)}</div>
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

  function hoursBetween(timeIn, timeOut) {
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    let start = toMin(timeIn), end = toMin(timeOut);
    if (end <= start) end += 1440; // crosses midnight
    return Math.round(((end - start) / 60) * 100) / 100;
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

  // Draws the same info a physical time clock would stamp — logo, time, date, location,
  // name, company, verification code — directly onto the captured frame. Original design
  // (our own brand, wordmark and layout), not copied from any third-party product.
  function drawOverlay(ctx, w, h, emp, locationText) {
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
    if (locationText) {
      ctx.font = `500 ${Math.round(w * 0.028)}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(locationText, px, y);
      y += w * 0.05;
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

  function bestEffortLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve('');
      const timer = setTimeout(() => resolve(''), 6000);
      navigator.geolocation.getCurrentPosition(async (pos) => {
        clearTimeout(timer);
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=12`);
          const data = await res.json();
          const a = data.address || {};
          const city = a.city || a.town || a.municipality || a.village || '';
          const region = a.state || a.region || '';
          resolve([city, region].filter(Boolean).join(', ') || data.display_name || '');
        } catch (e) { resolve(''); }
      }, () => { clearTimeout(timer); resolve(''); }, { timeout: 6000 });
    });
  }

  // timeStr/date are always captured at the moment the employee presses Confirm — never
  // recomputed here — so a clock-in/out queued offline still records the real time it
  // happened, not whenever the connection happens to come back and this finally runs.
  async function saveClockEvent(emp, kind, photoPath, timeStr, date) {
    if (kind === 'in') {
      await Store.addAttendance({
        employeeId: emp.id, date, status: 'Present',
        timeIn: timeStr, timeOut: null, hours: 0,
        timeInPhotoPath: photoPath,
      });
    } else {
      const rec = Store.attendanceForDate(date).find(r => r.employeeId === emp.id);
      if (!rec) { toast('No Time In found for today.'); return; }
      await Store.updateAttendance(rec.id, {
        timeOut: timeStr,
        hours: hoursBetween(rec.timeIn, timeStr),
        timeOutPhotoPath: photoPath,
      });
    }
  }

  function isLikelyNetworkError(e) {
    return e instanceof TypeError || (e && /fetch|network|failed/i.test(e.message || ''));
  }

  // Stores the captured photo + intended attendance fields in IndexedDB instead of
  // Supabase. Nothing here touches the network — safe to call with no connection at all.
  async function queueOffline(emp, kind, blob, timeStr, date) {
    await OfflineQueue.add({
      localId: genId('offatt'),
      employeeId: emp.id, kind, timeStr, date, photoBlob: blob,
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
        await saveClockEvent(emp, item.kind, path, item.timeStr, item.date);
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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
          await queueOffline(emp, kind, blob, timeStr, date);
          stopStream(stream);
          closeEssModal();
          toast('📴 No connection — queued offline. Will sync automatically once you\'re back online.');
          render(main, emp);
          return;
        }
        try {
          const path = await Store.uploadAttendancePhoto(emp.id, blob, kind);
          await saveClockEvent(emp, kind, path, timeStr, date);
          stopStream(stream);
          closeEssModal();
          toast(kind === 'in' ? '✔ Time In recorded' : '✔ Time Out recorded');
          render(main, emp);
        } catch (e) {
          if (isLikelyNetworkError(e)) {
            await queueOffline(emp, kind, blob, timeStr, date);
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

  function openCameraCapture(main, emp, kind) {
    let stream = null;

    openEssModal(`
      <h2>${kind === 'in' ? 'Time In' : 'Time Out'}</h2>
      <div class="modal-sub">Center your face in the frame, then capture.</div>
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
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawOverlay(ctx, canvas.width, canvas.height, emp, locationText);
        showPreview(bdEl, canvas, main, emp, kind, stream, locationText);
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

  return { render };
})();
