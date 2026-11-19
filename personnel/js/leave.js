(function () {
  function startPage() {
  pmApplyBrand();
  pmRegisterWorker();
  var CACHE_KEY = 'pm-leave-cache-v1';
  var PENDING_KEY = 'pm-leave-pending-v1';
  var token = '';
  var me = null;
  var serverRequests = [];
  var pending = [];
  var filter = 'All';
  var editingId = '';
  var monthCursor = new Date();
  var syncing = false;
  var view = 'list';

  function $(id) { return document.getElementById(id); }

  function lock(message) {
    PMSession.followGate({ authFailed: true, message: message || 'Please sign in again.' });
  }

  function loadPending() {
    try {
      var parsed = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      pending = parsed && parsed.length ? parsed : [];
    } catch (e) { pending = []; }
  }

  function savePending() {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    updateSync();
  }

  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(serverRequests)); } catch (e) {}
  }

  function readCache() {
    try {
      var parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      return parsed && parsed.length ? parsed : [];
    } catch (e) { return []; }
  }

  function visibleRequests() {
    var rows = serverRequests;
    var i;
    for (i = 0; i < pending.length; i++) rows = PMLeave.applyLeaveAction(rows, pending[i]);
    return rows;
  }

  function updateSync() {
    var node = $('syncLabel');
    if (syncing) node.textContent = 'Syncing…';
    else if (pending.length) node.textContent = pending.length + ' change(s) saved on this device';
    else node.textContent = 'Synced';
  }

  function send(action) {
    var payload = { token: token };
    if (action.type === 'add') {
      payload.action = 'leaveAdd';
      copyFields(payload, action.request);
    } else if (action.type === 'update') {
      payload.action = 'leaveUpdate';
      copyFields(payload, action.request);
    } else if (action.type === 'delete') {
      payload.action = 'leaveDelete';
      payload.id = action.id;
    } else {
      return Promise.reject(new Error('Unknown leave action.'));
    }
    return pmCall(payload);
  }

  function copyFields(payload, request) {
    payload.id = request.id;
    payload.name = request.name;
    payload.type = request.type;
    payload.start = request.start;
    payload.end = request.end;
    payload.startTime = request.startTime;
    payload.endTime = request.endTime;
    payload.notes = request.notes;
    payload.status = request.status;
    payload.submitted = request.submitted;
    payload.days = request.days;
  }

  function syncPending() {
    if (!pending.length) { syncing = false; updateSync(); return Promise.resolve(); }
    syncing = true;
    updateSync();
    return send(pending[0]).then(function (data) {
      if (data && data.authFailed) { lock(data.message); return; }
      if (!data || data.success !== true) {
        pending = pending.slice(1);
        savePending();
        pageSay((data && data.message) || 'A saved change was rejected.');
        return syncPending();
      }
      pending = pending.slice(1);
      savePending();
      return syncPending();
    }).catch(function (err) {
      syncing = false;
      updateSync();
      if (err && err.pmNetwork) pageSay('Offline — changes stay on this device until the connection returns.');
    });
  }

  function setStatus(text, good) {
    var node = $('formMsg');
    if (!node) return;
    node.textContent = text || '';
    node.className = 'msg' + (good ? ' good' : '');
  }

  function pageSay(text, good) {
    var node = $('pageMsg');
    if (!node) return;
    node.textContent = text || '';
    node.className = 'msg' + (good ? ' good' : '');
  }

  function formatDate(value) {
    var parts = PMDates.parseYMD(value);
    if (!parts) return '';
    var dt = new Date(parts.y, parts.m - 1, parts.d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(value) {
    if (!value) return '';
    var bits = String(value).split(':');
    var hour = Number(bits[0]);
    var minute = bits[1] || '00';
    var suffix = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return hour + ':' + minute + ' ' + suffix;
  }

  function ymdFromDate(date) {
    return date.getFullYear() + '-' + PMDates.pad2(date.getMonth() + 1) + '-' + PMDates.pad2(date.getDate());
  }

  function renderSummary(rows) {
    var counts = { Pending: 0, Approved: 0, Denied: 0, Cancelled: 0 };
    var i;
    for (i = 0; i < rows.length; i++) if (counts[rows[i].status] != null) counts[rows[i].status] += 1;
    var root = $('summary');
    PMDom.clear(root);
    var keys = ['Pending', 'Approved', 'Denied', 'Cancelled'];
    for (i = 0; i < keys.length; i++) {
      var box = PMDom.el('div', 'stat');
      box.appendChild(PMDom.el('strong', null, String(counts[keys[i]])));
      box.appendChild(PMDom.el('span', null, keys[i]));
      root.appendChild(box);
    }
  }

  function dateLine(request) {
    if (request.type === 'Appointment' || request.type === 'In Late') {
      return formatDate(request.start) + (request.startTime ? ' · ' + formatTime(request.startTime) : '');
    }
    if (request.type === 'Indoc') return formatDate(request.start) + ' and ' + formatDate(request.end) + ' · 2 days';
    var days = Number(request.days) || 0;
    return formatDate(request.start) + ' – ' + formatDate(request.end) + ' · ' + days + (days === 1 ? ' day' : ' days');
  }

  function renderList() {
    var rows = visibleRequests();
    renderSummary(rows);
    var search = String($('search').value || '').toLowerCase();
    var root = $('requestList');
    PMDom.clear(root);
    var shown = 0;
    var i;
    var sorted = rows.slice().sort(function (a, b) {
      if (a.start === b.start) return 0;
      return a.start < b.start ? 1 : -1;
    });
    for (i = 0; i < sorted.length; i++) {
      var request = sorted[i];
      if (filter !== 'All' && request.status !== filter) continue;
      if (search && String(request.name || '').toLowerCase().indexOf(search) === -1) continue;
      shown += 1;
      root.appendChild(card(request));
    }
    if (!shown) root.appendChild(PMDom.el('p', 'muted', 'No entries match.'));
    if (view === 'calendar') renderCalendar();
  }

  function card(request) {
    var node = PMDom.el('article', 'panel card-' + String(request.status || 'pending').toLowerCase());
    node.appendChild(PMDom.el('h3', null, request.name));
    node.appendChild(PMDom.el('div', null, request.type + ' · ' + request.status));
    node.appendChild(PMDom.el('div', 'muted', dateLine(request)));
    if (request.notes) node.appendChild(PMDom.el('p', null, request.notes));
    var actions = PMDom.el('div', 'actions');
    if (request.status === 'Pending') {
      actions.appendChild(actionButton('Approve', function () { changeStatus(request, 'Approved'); }));
      actions.appendChild(actionButton('Deny', function () { changeStatus(request, 'Denied'); }, 'secondary'));
    }
    actions.appendChild(actionButton('Edit', function () { openForm(request); }, 'secondary'));
    if (request.status !== 'Cancelled') actions.appendChild(actionButton('Cancel', function () { cancelRequest(request); }, 'secondary'));
    if (PMSession.isAdmin(me)) actions.appendChild(actionButton('Delete', function () { deleteRequest(request); }, 'danger'));
    node.appendChild(actions);
    return node;
  }

  function actionButton(text, onclick, kind) {
    var button = PMDom.el('button', 'button' + (kind ? ' ' + kind : ''), text);
    button.type = 'button';
    button.onclick = onclick;
    return button;
  }

  function queue(action) {
    pending = PMLeave.queueLeaveAction(pending, action);
    savePending();
    renderList();
    syncPending();
  }

  function changeStatus(request, status) {
    var next = JSON.parse(JSON.stringify(request));
    next.status = status;
    queue({ type: 'update', request: next });
  }

  function cancelRequest(request) {
    if (!window.confirm('Cancel this entry for ' + request.name + '? It stays in the tracker as Cancelled.')) return;
    changeStatus(request, 'Cancelled');
  }

  function deleteRequest(request) {
    if (!PMSession.isAdmin(me)) return;
    if (!window.confirm('Permanently delete this entry for ' + request.name + '?')) return;
    queue({ type: 'delete', id: request.id });
  }

  function updateFormFields() {
    var type = $('leaveType').value;
    var end = $('endDateGroup');
    var times = $('timeFields');
    var endTime = $('endTimeGroup');
    var days = $('daysDisplay');
    $('startDateLabel').textContent = 'Start Date';
    $('endDateLabel').textContent = 'End Date';
    $('startTimeLabel').textContent = 'Start Time';
    end.style.display = '';
    times.style.display = 'none';
    endTime.style.display = '';
    days.style.display = '';
    if (type === 'Appointment') {
      $('startDateLabel').textContent = 'Appointment Date';
      end.style.display = 'none';
      times.style.display = '';
      endTime.style.display = 'none';
      days.style.display = 'none';
      $('startTimeLabel').textContent = 'Appointment Time';
    } else if (type === 'In Late') {
      $('startDateLabel').textContent = 'Date';
      end.style.display = 'none';
      times.style.display = '';
      endTime.style.display = 'none';
      days.style.display = 'none';
      $('startTimeLabel').textContent = 'Expected Arrival Time';
    } else if (type === 'Indoc') {
      $('startDateLabel').textContent = 'Day 1 Date';
      $('endDateLabel').textContent = 'Day 2 Date';
      days.style.display = 'none';
    } else if (type === 'Other') {
      times.style.display = '';
      previewDays();
    } else {
      previewDays();
    }
  }

  function previewDays() {
    var type = $('leaveType').value;
    if (type === 'Appointment' || type === 'In Late' || type === 'Indoc') return;
    var days = PMDates.inclusiveDays($('startDate').value, $('endDate').value);
    $('daysDisplay').textContent = days + (days === 1 ? ' day' : ' days');
  }

  function openForm(request) {
    editingId = request ? request.id : '';
    $('formTitle').textContent = editingId ? 'Edit entry' : 'New entry';
    $('employeeName').value = request ? request.name : (me ? me.name : '');
    $('leaveType').value = request ? request.type : 'Leave';
    $('startDate').value = request ? request.start : '';
    $('endDate').value = request ? request.end : '';
    $('startTime').value = request ? request.startTime : '';
    $('endTime').value = request ? request.endTime : '';
    $('notes').value = request ? request.notes : '';
    updateFormFields();
    setStatus('');
    PMDom.show($('requestModal'), true);
  }

  function closeForm() {
    editingId = '';
    PMDom.show($('requestModal'), false);
  }

  function saveForm() {
    var draft = {
      name: $('employeeName').value,
      type: $('leaveType').value,
      start: $('startDate').value,
      end: $('endDate').value,
      startTime: $('startTime').value,
      endTime: $('endTime').value,
      notes: $('notes').value,
      status: 'Pending'
    };
    if (editingId) {
      var existing = findRequest(editingId);
      if (existing) draft.status = existing.status;
    }
    var checked = PMLeave.validateLeave(draft);
    if (!checked.ok) { setStatus(checked.message); return; }
    var request = checked.request;
    if (!editingId) {
      request.id = 'lv-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
      request.submitted = PMEastern.easternDayKey(new Date());
      queue({ type: 'add', request: request });
    } else {
      request.id = editingId;
      var prior = findRequest(editingId);
      request.submitted = prior && prior.submitted ? prior.submitted : PMEastern.easternDayKey(new Date());
      queue({ type: 'update', request: request });
    }
    closeForm();
  }

  function findRequest(id) {
    var rows = visibleRequests();
    var i;
    for (i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) return rows[i];
    return null;
  }

  function covers(request, ymd) {
    if (request.type === 'Indoc') return ymd === request.start || ymd === request.end;
    var end = request.end || request.start;
    return ymd >= request.start && ymd <= end;
  }

  function renderCalendar() {
    var year = monthCursor.getFullYear();
    var month = monthCursor.getMonth();
    $('calendarTitle').textContent = monthCursor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    var root = $('calendar');
    PMDom.clear(root);
    var dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var head = PMDom.el('div', 'cal-row');
    var d;
    for (d = 0; d < 7; d++) head.appendChild(PMDom.el('div', 'cal-dow', dows[d]));
    root.appendChild(head);
    var first = new Date(year, month, 1);
    var start = new Date(year, month, 1 - first.getDay());
    var today = ymdFromDate(new Date());
    var rows = visibleRequests();
    var cell;
    for (cell = 0; cell < 42; cell++) {
      if (cell % 7 === 0) root.appendChild(PMDom.el('div', 'cal-row'));
      var date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + cell);
      var ymd = ymdFromDate(date);
      var box = PMDom.el('div', 'cal-cell' + (date.getMonth() !== month ? ' out' : '') + (ymd === today ? ' today' : ''));
      box.appendChild(PMDom.el('div', 'cal-num', String(date.getDate())));
      var i;
      for (i = 0; i < rows.length; i++) {
        if (!covers(rows[i], ymd)) continue;
        var chip = PMDom.el('span', 'chip ' + String(rows[i].status || '').toLowerCase(), rows[i].name);
        box.appendChild(chip);
      }
      root.lastChild.appendChild(box);
    }
  }

  function showView(next) {
    view = next;
    PMDom.show($('listView'), next === 'list');
    PMDom.show($('calendarView'), next === 'calendar');
    $('listButton').className = 'tab' + (next === 'list' ? ' on' : '');
    $('calendarButton').className = 'tab' + (next === 'calendar' ? ' on' : '');
    if (next === 'calendar') renderCalendar();
  }

  function loadServer() {
    return pmCall({ action: 'leaveList', token: token }).then(function (data) {
      if (data && data.authFailed) { lock(data.message); return; }
      if (!data || data.success !== true) throw new Error((data && data.message) || 'Could not load leave.');
      serverRequests = data.requests || [];
      saveCache();
      renderList();
      return syncPending();
    }).catch(function (err) {
      if (err && err.pmNetwork) {
        serverRequests = readCache();
        renderList();
        pageSay('Offline — showing leave saved on this device.');
        return;
      }
      pageSay(err.message || 'Could not load leave.');
    });
  }

  $('search').oninput = renderList;
  $('leaveType').onchange = updateFormFields;
  $('startDate').onchange = previewDays;
  $('endDate').onchange = previewDays;
  $('newRequest').onclick = function () { openForm(null); };
  $('closeForm').onclick = closeForm;
  $('saveRequest').onclick = saveForm;
  $('listButton').onclick = function () { showView('list'); };
  $('calendarButton').onclick = function () { showView('calendar'); };
  $('prevMonth').onclick = function () {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    renderCalendar();
  };
  $('nextMonth').onclick = function () {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    renderCalendar();
  };
  var tabs = document.querySelectorAll('[data-filter]');
  var t;
  for (t = 0; t < tabs.length; t++) {
    tabs[t].onclick = function (event) {
      filter = event.currentTarget.getAttribute('data-filter');
      var all = document.querySelectorAll('[data-filter]');
      var i;
      for (i = 0; i < all.length; i++) all[i].className = 'tab' + (all[i] === event.currentTarget ? ' on' : '');
      renderList();
    };
  }

  loadPending();
  PMSession.validate().then(function (session) {
    if (!session.staff) {
      PMSession.followGate({ authFailed: true, message: 'Please sign in again.' });
      return;
    }
    if (PMSession.needsPinChange(session.staff)) {
      PMSession.followGate({ success: true, message: 'Change your temporary PIN before using the tools.', staff: session.staff }, session.staff);
      return;
    }
    token = session.token;
    me = session.staff;
    document.body.classList.remove('is-locked');
    PMSession.banner(session);
    if (session.offline) {
      serverRequests = readCache();
      renderList();
      pageSay('Offline — showing leave saved on this device.');
      return;
    }
    loadServer();
  }).catch(function (err) {
    if (err && err.pmAuth) {
      PMSession.followGate({ authFailed: true, message: err.message || 'Please sign in again.' });
      return;
    }
    $('gateMessage').textContent = err.message || 'Sign in required.';
  });
  }
  PMAccess.whenReady(startPage);
})();
