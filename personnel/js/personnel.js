(function () {
  function startPage() {
  pmApplyBrand();
  pmRegisterWorker();
  var CACHE_KEY = 'pm-personnel-cache-v1';
  var token = '';
  var me = null;
  var details = [];
  var personnel = [];
  var today = '';
  var tab = 'manning';
  var rosterFilter = 'current';
  var editingId = '';

  function $(id) { return document.getElementById(id); }

  function lock(message) {
    PMSession.followGate({ authFailed: true, message: message || 'Please sign in again.' });
  }

  function say(text, good) {
    var node = $('pageMsg');
    node.textContent = text || '';
    node.className = 'msg' + (good ? ' good' : '');
  }

  function detailName(id) {
    var i;
    for (i = 0; i < details.length; i++) if (String(details[i].id) === String(id)) return details[i].name;
    return '';
  }

  function activeDetails() {
    var rows = [];
    var i;
    for (i = 0; i < details.length; i++) if (details[i].active !== false && String(details[i].active) !== 'false') rows.push(details[i]);
    rows.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    return rows;
  }

  function admin() { return PMSession.isAdmin(me); }

  function showTab(name) {
    tab = name;
    PMDom.show($('manningPanel'), name === 'manning');
    PMDom.show($('rosterPanel'), name === 'roster');
    PMDom.show($('analyticsPanel'), name === 'analytics');
    var buttons = document.querySelectorAll('[data-tab]');
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].className = 'tab' + (buttons[i].getAttribute('data-tab') === name ? ' on' : '');
    }
    if (name === 'analytics') renderAnalytics();
  }

  function render() {
    PMDom.show($('adminTools'), admin());
    PMDom.show($('detailForm'), admin());
    $('viewNote').textContent = admin()
      ? 'You can edit records. Other staff can view this page.'
      : 'View only. Administrators edit personnel and details.';
    renderManning();
    renderRoster();
    renderDetails();
    if (tab === 'analytics') renderAnalytics();
  }

  function renderManning() {
    var summary = PMManning.summarizeManning(activeDetails(), personnel);
    var root = $('manningList');
    PMDom.clear(root);
    var stats = $('manningStats');
    PMDom.clear(stats);
    stats.appendChild(statBox(String(summary.current), 'Current'));
    stats.appendChild(statBox(String(summary.unassigned), 'Unassigned'));
    stats.appendChild(statBox(summary.totalLabel, 'Total fill'));
    stats.appendChild(statBox(String(summary.departed), 'Departed history'));
    if (!summary.details.length) {
      root.appendChild(PMDom.el('p', 'muted', 'No details yet. An administrator can add DDR, FAC, and the other duties.'));
      return;
    }
    var i;
    for (i = 0; i < summary.details.length; i++) root.appendChild(manRow(summary.details[i]));
    root.appendChild(manRow({
      name: 'Total',
      label: summary.totalLabel,
      tone: summary.totalTone,
      overmanned: summary.totalOvermanned,
      bar: summary.totalBar
    }));
    var note = PMDom.el('p', 'muted', 'Unassigned: ' + summary.unassigned + '. Fill counts Assigned and Outbound people on an active detail. Inbound and departed people do not fill a seat.');
    root.appendChild(note);
  }

  function statBox(value, label) {
    var box = PMDom.el('div', 'stat');
    box.appendChild(PMDom.el('strong', null, value));
    box.appendChild(PMDom.el('span', null, label));
    return box;
  }

  function manRow(row) {
    var wrap = PMDom.el('div', 'man-row');
    var name = PMDom.el('div', 'man-name', row.name + ' ' + row.label);
    if (row.overmanned) name.appendChild(PMDom.el('span', 'man-flag', 'Overmanned'));
    wrap.appendChild(name);
    var label = PMDom.el('div', 'man-label', toneWord(row.tone));
    wrap.appendChild(label);
    var track = PMDom.el('div', 'track');
    var fill = PMDom.el('div', 'fill fill-' + (row.tone || 'empty'));
    fill.style.width = (row.bar || 0) + '%';
    track.appendChild(fill);
    wrap.appendChild(track);
    return wrap;
  }

  function toneWord(tone) {
    if (tone === 'green' || tone === 'over') return 'On target';
    if (tone === 'amber') return '70–99%';
    if (tone === 'red') return 'Under 70%';
    if (tone === 'empty') return 'No target';
    return '';
  }

  function renderRoster() {
    var root = $('rosterBody');
    PMDom.clear(root);
    var q = String($('rosterSearch').value || '').toLowerCase();
    var rows = personnel.slice().sort(function (a, b) {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    var i;
    var shown = 0;
    for (i = 0; i < rows.length; i++) {
      var person = rows[i];
      if (rosterFilter === 'current' && person.status === 'Departed') continue;
      if (rosterFilter !== 'current' && rosterFilter !== 'all' && person.status !== rosterFilter) continue;
      var blob = (person.rank + ' ' + person.name + ' ' + person.status).toLowerCase();
      if (q && blob.indexOf(q) === -1) continue;
      shown += 1;
      root.appendChild(rosterRow(person));
    }
    if (!shown) {
      var empty = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 7;
      cell.textContent = 'No personnel match.';
      empty.appendChild(cell);
      root.appendChild(empty);
    }
  }

  function rosterRow(person) {
    var tr = document.createElement('tr');
    tr.appendChild(td(person.rank));
    tr.appendChild(td(person.name));
    tr.appendChild(td(person.status));
    tr.appendChild(td(detailName(person.detailId) || '—'));
    tr.appendChild(td(person.arrivalDate || '—'));
    tr.appendChild(td(person.projectedDeparture || '—'));
    var actions = document.createElement('td');
    if (admin() && person.status !== 'Departed') {
      actions.appendChild(mini('Edit', function () { openPerson(person); }));
      if (person.status !== 'Inbound') actions.appendChild(mini('In-process', function () { runAction(person, 'in-process'); }));
      if (person.status === 'Inbound' || !person.detailId) actions.appendChild(mini('Assign', function () { openPerson(person, 'assign'); }));
      if (person.status !== 'Outbound') actions.appendChild(mini('Out-process', function () { runAction(person, 'out-process'); }));
      actions.appendChild(mini('Depart', function () { openDepart(person); }));
    } else if (admin()) {
      actions.appendChild(mini('Edit', function () { openPerson(person); }));
    } else {
      actions.textContent = '—';
    }
    tr.appendChild(actions);
    return tr;
  }

  function td(text) {
    var cell = document.createElement('td');
    cell.textContent = text;
    return cell;
  }

  function mini(text, onclick) {
    var button = PMDom.el('button', 'button secondary', text);
    button.type = 'button';
    button.style.margin = '0 6px 6px 0';
    button.onclick = onclick;
    return button;
  }

  function renderDetails() {
    var root = $('detailList');
    if (!root) return;
    PMDom.clear(root);
    var list = details.slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    var i;
    for (i = 0; i < list.length; i++) {
      var row = PMDom.el('div', 'row');
      row.appendChild(PMDom.el('strong', null, list[i].name + ' · target ' + list[i].required + (list[i].active === false ? ' (inactive)' : '')));
      if (admin() && list[i].active !== false) {
        var button = mini('Retire', (function (id, name) {
          return function () {
            if (!window.confirm('Retire the ' + name + ' detail? People on it become unassigned.')) return;
            pmCall({ action: 'detailDelete', token: token, id: id }).then(done).catch(fail);
          };
        })(list[i].id, list[i].name));
        row.appendChild(button);
      }
      root.appendChild(row);
    }
  }

  function renderAnalytics() {
    var tenure = PMMetrics.tenureList(personnel, today);
    var body = $('tenureBody');
    PMDom.clear(body);
    var i;
    for (i = 0; i < tenure.length; i++) {
      var tr = document.createElement('tr');
      tr.appendChild(td(String(i + 1)));
      tr.appendChild(td(tenure[i].rank));
      tr.appendChild(td(tenure[i].name));
      tr.appendChild(td(tenure[i].status));
      tr.appendChild(td(detailName(tenure[i].detailId) || '—'));
      tr.appendChild(td(tenure[i].label));
      body.appendChild(tr);
    }
    if (!tenure.length) {
      var empty = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'No current personnel.';
      empty.appendChild(cell);
      body.appendChild(empty);
    }
    var trends = PMMetrics.movementTrends(personnel, today, 12);
    var chart = $('trendChart');
    PMDom.clear(chart);
    chart.appendChild(trendSvg(trends));
    var table = $('trendBody');
    PMDom.clear(table);
    for (i = 0; i < trends.length; i++) {
      var row = document.createElement('tr');
      row.appendChild(td(trends[i].label));
      row.appendChild(td(String(trends[i].inbound)));
      row.appendChild(td(String(trends[i].outbound)));
      table.appendChild(row);
    }
    var windows = PMMetrics.upcomingDepartures(personnel, today, [30, 60, 90]);
    renderWindow('due30', windows[30]);
    renderWindow('due60', windows[60]);
    renderWindow('due90', windows[90]);
  }

  function renderWindow(id, rows) {
    var root = $(id);
    PMDom.clear(root);
    if (!rows.length) {
      root.appendChild(PMDom.el('p', 'muted', 'None.'));
      return;
    }
    var i;
    for (i = 0; i < rows.length; i++) {
      var line = PMDom.el('div', 'row');
      line.appendChild(PMDom.el('strong', null, rows[i].rank + ' ' + rows[i].name));
      line.appendChild(PMDom.el('div', 'muted', (detailName(rows[i].detailId) || 'Unassigned') + ' · ' + rows[i].projectedDeparture + ' · ' + rows[i].days + (rows[i].days === 1 ? ' day' : ' days')));
      root.appendChild(line);
    }
  }

  function trendSvg(rows) {
    var max = 1;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].inbound > max) max = rows[i].inbound;
      if (rows[i].outbound > max) max = rows[i].outbound;
    }
    var width = 720;
    var height = 280;
    var padL = 32;
    var padB = 36;
    var padT = 16;
    var padR = 8;
    var innerW = width - padL - padR;
    var innerH = height - padT - padB;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Inbound and outbound counts by month');
    var g;
    for (g = 0; g <= 4; g++) {
      var y = padT + innerH - (innerH * g / 4);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(padL));
      line.setAttribute('x2', String(width - padR));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.setAttribute('stroke', '#d5e2ee');
      svg.appendChild(line);
      var tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tick.setAttribute('x', '0');
      tick.setAttribute('y', String(y + 4));
      tick.setAttribute('fill', '#64748b');
      tick.setAttribute('font-size', '11');
      tick.textContent = String(Math.round(max * g / 4));
      svg.appendChild(tick);
    }
    var slot = innerW / rows.length;
    for (i = 0; i < rows.length; i++) {
      var x = padL + i * slot;
      bar(svg, x + slot * 0.18, rows[i].inbound, '#2a6f9b');
      bar(svg, x + slot * 0.52, rows[i].outbound, '#ea6c0a');
      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(x + slot / 2));
      label.setAttribute('y', String(height - 12));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#64748b');
      label.setAttribute('font-size', '11');
      label.textContent = rows[i].label;
      svg.appendChild(label);
    }
    return svg;

    function bar(parent, x, value, color) {
      var h = max ? (value / max) * innerH : 0;
      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(padT + innerH - h));
      rect.setAttribute('width', String(Math.max(slot * 0.28, 6)));
      rect.setAttribute('height', String(Math.max(h, value ? 2 : 0)));
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', color);
      parent.appendChild(rect);
    }
  }

  function fillDetailSelect(select, selected) {
    PMDom.clear(select);
    select.appendChild(new Option('Unassigned', ''));
    var list = activeDetails();
    var i;
    for (i = 0; i < list.length; i++) select.appendChild(new Option(list[i].name, list[i].id));
    select.value = selected || '';
  }

  function openPerson(person, mode) {
    editingId = person ? person.id : '';
    $('personTitle').textContent = person ? 'Edit ' + person.name : 'Add personnel';
    $('pName').value = person ? person.name : '';
    $('pRank').value = person ? person.rank : '';
    $('pStatus').value = person ? person.status : 'Inbound';
    $('pArrival').value = person ? person.arrivalDate : '';
    $('pProjected').value = person ? person.projectedDeparture : '';
    $('pActual').value = person ? person.actualDeparture : '';
    $('pNotes').value = person ? person.notes : '';
    fillDetailSelect($('pDetail'), person ? person.detailId : '');
    if (mode === 'assign') $('pStatus').value = 'Assigned';
    PMDom.show($('personModal'), true);
  }

  function openDepart(person) {
    editingId = person.id;
    $('departName').textContent = person.rank + ' ' + person.name;
    $('departDate').value = person.actualDeparture || today || '';
    PMDom.show($('departModal'), true);
  }

  function runAction(person, kind, extra) {
    var body = { action: 'personnelAction', token: token, id: person.id, kind: kind };
    if (extra) {
      var key;
      for (key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) body[key] = extra[key];
    }
    return pmCall(body).then(done).catch(fail);
  }

  function done(data) {
    if (data && data.authFailed) { lock(data.message); return; }
    if (!data || data.success !== true) throw new Error((data && data.message) || 'Could not save.');
    say('Saved.', true);
    PMDom.show($('personModal'), false);
    PMDom.show($('departModal'), false);
    return reload();
  }

  function fail(err) {
    say(err.message || 'Could not save.');
  }

  function reload() {
    return pmCall({ action: 'personnelList', token: token }).then(function (data) {
      if (data && data.authFailed) { lock(data.message); return; }
      if (!data || data.success !== true) throw new Error((data && data.message) || 'Could not load personnel.');
      details = data.details || [];
      personnel = data.personnel || [];
      today = data.today || PMEastern.easternDayKey(new Date());
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ details: details, personnel: personnel, today: today })); } catch (e) {}
      render();
    }).catch(function (err) {
      if (err && err.pmNetwork) {
        var cached = null;
        try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) {}
        if (cached && cached.personnel) {
          details = cached.details || [];
          personnel = cached.personnel;
          today = cached.today || PMEastern.easternDayKey(new Date());
          render();
          say('Offline — showing personnel saved on this device.');
          return;
        }
      }
      say(err.message || 'Could not load personnel.');
    });
  }

  $('tabManning').onclick = function () { showTab('manning'); };
  $('tabRoster').onclick = function () { showTab('roster'); };
  $('tabAnalytics').onclick = function () { showTab('analytics'); };
  $('rosterSearch').oninput = renderRoster;
  $('rosterFilter').onchange = function () { rosterFilter = $('rosterFilter').value; renderRoster(); };
  $('addPerson').onclick = function () { openPerson(null); };
  $('closePerson').onclick = function () { PMDom.show($('personModal'), false); };
  $('closeDepart').onclick = function () { PMDom.show($('departModal'), false); };
  $('savePerson').onclick = function () {
    pmCall({
      action: 'personnelSave',
      token: token,
      id: editingId,
      name: $('pName').value,
      rank: $('pRank').value,
      status: $('pStatus').value,
      detailId: $('pDetail').value,
      arrivalDate: $('pArrival').value,
      projectedDeparture: $('pProjected').value,
      actualDeparture: $('pActual').value,
      notes: $('pNotes').value
    }).then(done).catch(fail);
  };
  $('saveDepart').onclick = function () {
    var person = null;
    var i;
    for (i = 0; i < personnel.length; i++) if (personnel[i].id === editingId) person = personnel[i];
    if (!person) return;
    runAction(person, 'depart', { actualDeparture: $('departDate').value });
  };
  $('saveDetail').onclick = function () {
    pmCall({
      action: 'detailSave',
      token: token,
      name: $('detailName').value,
      required: Number($('detailRequired').value)
    }).then(function (data) {
      $('detailName').value = '';
      $('detailRequired').value = '';
      return done(data);
    }).catch(fail);
  };

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
    showTab('manning');
    if (session.offline) {
      say('Offline — open this page once while online to keep a copy on the device.');
      return reload();
    }
    return reload();
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
