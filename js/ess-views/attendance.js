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

  function dayCard(emp, date, rec, holiday) {
    const dow = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (emp.rate / (workDaysInRange(date, date) || 1));
    const pay = computeDayPay(dailyRateEq, rec, holiday);
    return `
      <div class="ess-card">
        <div class="ess-card-label">${dow}</div>
        ${rec ? `
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(rec.timeIn)} ✅</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${rec.timeOut ? to12Hour(rec.timeOut) : '—'}</span></div>
        <div class="ess-row"><span class="label">Hours</span><span class="value">${rec.hours}</span></div>
        <div class="ess-row"><span class="label">Status</span><span class="value">${escapeHtml(rec.status)}</span></div>
        ${pay.nsdHrs ? `<div class="ess-row"><span class="label">Night Shift Diff.</span><span class="value">${pay.nsdHrs.toFixed(2)} hr</span></div>` : ''}
        ${pay.otHrs ? `<div class="ess-row"><span class="label">Overtime</span><span class="value">${pay.otHrs.toFixed(2)} hr</span></div>` : ''}
        ${Number(rec.hours) < 8 ? `<div class="ess-row"><span class="label">Undertime</span><span class="value">${(8 - Number(rec.hours)).toFixed(2)} hr</span></div>` : ''}
        ` : `<div class="ess-sub">Not logged${holiday ? ' · ' + escapeHtml(holiday.name) : ''}</div>`}
      </div>
    `;
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
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(todayRec.timeIn)} ✅</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${todayRec.timeOut ? to12Hour(todayRec.timeOut) + ' ✅' : '—'}</span></div>
        <div class="ess-row"><span class="label">Status</span><span class="value">${escapeHtml(todayRec.status)}</span></div>
        ` : `<div class="ess-sub">No attendance logged yet for today.</div>`}
      </div>

      ${!todayRec ? `<button class="btn btn-primary" id="btn-clock-in" style="width:100%; justify-content:center; margin-bottom:14px;">🕒 Time In</button>` : ''}
      ${todayRec && !todayRec.timeOut ? `<button class="btn btn-primary" id="btn-clock-out" style="width:100%; justify-content:center; margin-bottom:14px;">🕒 Time Out</button>` : ''}
      ${todayRec && todayRec.timeOut ? `<div class="ess-sub" style="text-align:center; margin-bottom:14px;">✔ Done for today</div>` : ''}

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

  // Draws the same info a physical time clock would stamp — logo, time, date, location,
  // name, company — directly onto the captured frame. Original design (our own brand
  // colors/wordmark), not copied from any third-party product.
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

    const scrimH = h * 0.44;
    const grad = ctx.createLinearGradient(0, h - scrimH, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - scrimH, w, scrimH);

    const px = w * 0.05;
    let y = h - scrimH + h * 0.05;

    ctx.textAlign = 'left';
    ctx.font = `800 ${Math.round(w * 0.05)}px Arial`;
    ctx.fillStyle = '#4f8dff';
    ctx.fillText('TXT', px, y);
    const txtW = ctx.measureText('TXT').width;
    ctx.fillStyle = '#3fc46a';
    ctx.fillText('AIRE', px + txtW, y);

    y += w * 0.1;
    ctx.font = `800 ${Math.round(w * 0.115)}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(timeStr, px, y);
    const timeW = ctx.measureText(timeStr).width;
    ctx.font = `600 ${Math.round(w * 0.035)}px Arial`;
    ctx.fillText(ampm, px + timeW + w * 0.015, y);

    ctx.font = `600 ${Math.round(w * 0.032)}px Arial`;
    ctx.fillStyle = '#f2c14e';
    ctx.fillText(dateStr, px + timeW + w * 0.1, y - w * 0.035);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dowStr, px + timeW + w * 0.1, y);

    y += w * 0.055;
    if (locationText) {
      ctx.font = `500 ${Math.round(w * 0.03)}px Arial`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(locationText, px, y);
      y += w * 0.045;
    }

    y += w * 0.015;
    ctx.font = `600 ${Math.round(w * 0.032)}px Arial`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Name: ${emp.name}`, px, y);
    y += w * 0.042;
    ctx.fillText('Company: TXTAIRE', px, y);

    ctx.textAlign = 'right';
    ctx.font = `500 ${Math.round(w * 0.022)}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(`Code: ${code}`, w - px, h - h * 0.025);
    ctx.textAlign = 'left';
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

  async function saveClockEvent(emp, kind, photoPath) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = todayISO();
    if (kind === 'in') {
      await Store.addAttendance({
        employeeId: emp.id, date: today, status: 'Present',
        timeIn: timeStr, timeOut: null, hours: 0,
        timeInPhotoPath: photoPath,
      });
    } else {
      const rec = Store.attendanceForDate(today).find(r => r.employeeId === emp.id);
      if (!rec) { toast('No Time In found for today.'); return; }
      await Store.updateAttendance(rec.id, {
        timeOut: timeStr,
        hours: hoursBetween(rec.timeIn, timeStr),
        timeOutPhotoPath: photoPath,
      });
    }
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
      canvas.toBlob(async (blob) => {
        try {
          const path = await Store.uploadAttendancePhoto(emp.id, blob, kind);
          await saveClockEvent(emp, kind, path);
          stopStream(stream);
          closeEssModal();
          toast(kind === 'in' ? '✔ Time In recorded' : '✔ Time Out recorded');
          render(main, emp);
        } catch (e) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = `Confirm ${kind === 'in' ? 'Time In' : 'Time Out'}`;
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
