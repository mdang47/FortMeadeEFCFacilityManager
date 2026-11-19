(function () {
  function startPage() {
  pmApplyBrand();
  pmRegisterWorker();
  var LAST_KEY = 'pm-status-board-last-v1';
  var token = '';
  var me = null;
  var staff = [];
  var statuses = [];
  var online = false;
  var loading = false;
  var editingId = null;
  var timer = 0;
  var midnightTimer = 0;
  var loadedDayKey = '';
  var serverSkew = 0;

  function $(id) { return document.getElementById(id); }
  function say(id, text, good) {
    var node = $(id);
    if (!node) return;
    node.textContent = text || '';
    node.className = 'msg' + (good ? ' good' : '');
  }

  function lock(message) {
    clearInterval(timer);
    clearTimeout(midnightTimer);
    PMSession.followGate({ authFailed: true, message: message || 'Please sign in again.' });
  }

  function info(code) {
    var i;
    for (i = 0; i < statuses.length; i++) if (statuses[i].code === code && statuses[i].active !== false) return statuses[i];
    return null;
  }

  function dot(code) {
    var def = info(code);
    var node = PMDom.el('span', 'dot');
    if (def) {
      node.style.background = def.color || '#2a6f9b';
      node.style.borderColor = 'rgba(0,0,0,.2)';
    }
    return node;
  }

  function labelOf(code) {
    var def = info(code);
    return def ? def.label : 'Unknown';
  }

  function todayKey() {
    return PMEastern.easternDayKey(new Date(Date.now() + serverSkew));
  }

  function notice(text, err) {
    var node = $('notice');
    node.textContent = text || '';
    node.className = 'notice panel' + (text ? '' : ' hide');
    if (err) node.style.background = '#fde8e6';
    else node.style.background = '';
  }

  function activeStatuses() {
    var rows = [];
    var i;
    for (i = 0; i < statuses.length; i++) if (statuses[i].active !== false) rows.push(statuses[i]);
    rows.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    return rows;
  }

  function renderLegend() {
    var root = $('legend');
    PMDom.clear(root);
    var unknown = PMDom.el('span', 'legend-item');
    unknown.appendChild(dot(''));
    unknown.appendChild(document.createTextNode('Unknown'));
    root.appendChild(unknown);
    var list = activeStatuses();
    var i;
    for (i = 0; i < list.length; i++) {
      var item = PMDom.el('span', 'legend-item');
      item.appendChild(dot(list[i].code));
      item.appendChild(document.createTextNode(list[i].label + (list[i].needsLocation ? ' (with location)' : '')));
      root.appendChild(item);
    }
  }

  function find(id) {
    var i;
    for (i = 0; i < staff.length; i++) if (String(staff[i].id) === String(id)) return staff[i];
    return null;
  }

  function canEdit(id) {
    return online && me && (String(id) === String(me.id) || PMSession.isAdmin(me));
  }

  function buildPicker(root, targetId, msgId) {
    PMDom.clear(root);
    var person = find(targetId);
    var current = person ? person.status : '';
    var list = activeStatuses();
    var i;
    for (i = 0; i < list.length; i++) {
      (function (def) {
        var button = PMDom.el('button', 'picker-btn' + (def.code === current ? ' sel' : ''));
        button.type = 'button';
        button.disabled = !canEdit(targetId);
        button.appendChild(dot(def.code));
        button.appendChild(document.createTextNode(def.label));
        button.onclick = function () {
          if (def.needsLocation) {
            showOther(root, targetId, msgId, person && person.status === def.code ? person.location : '', def);
            return;
          }
          setStatus(targetId, def.code, '', msgId);
        };
        root.appendChild(button);
      })(list[i]);
    }
  }

  function showOther(root, targetId, msgId, currentLocation, def) {
    var box = PMDom.el('div', 'panel');
    var label = PMDom.el('label', null, 'Location (required)');
    var input = document.createElement('input');
    input.maxLength = 60;
    input.value = currentLocation || '';
    input.placeholder = 'Where are you?';
    var save = PMDom.el('button', 'button', 'Save ' + def.label);
    var cancel = PMDom.el('button', 'button secondary', 'Cancel');
    save.type = 'button';
    cancel.type = 'button';
    save.onclick = function () {
      var location = String(input.value || '').replace(/\s+/g, ' ').replace(/^\s|\s$/g, '');
      if (!location) { say(msgId, 'Enter a location.'); input.focus(); return; }
      setStatus(targetId, def.code, location, msgId);
    };
    cancel.onclick = function () { buildPicker(root, targetId, msgId); say(msgId, ''); };
    input.onkeydown = function (event) { if (event.keyCode === 13) save.onclick(); };
    box.appendChild(label);
    box.appendChild(input);
    var actions = PMDom.el('div', 'actions');
    actions.appendChild(save);
    actions.appendChild(cancel);
    box.appendChild(actions);
    root.appendChild(box);
    input.focus();
  }

  function setStatus(targetId, status, location, msgId) {
    if (!online) { say(msgId, 'Offline: status changes need a connection.'); return; }
    say(msgId, 'Saving…', true);
    var body = { action: 'statusSet', token: token, status: status, location: location };
    if (String(targetId) !== String(me.id)) body.staffId = targetId;
    pmCall(body).then(function (data) {
      if (data && data.authFailed) { lock(data.message); return; }
      if (!data || data.success !== true) throw new Error((data && data.message) || 'Could not save.');
      if (data.serverTime) {
        var parsed = new Date(data.serverTime).getTime();
        if (!isNaN(parsed)) serverSkew = parsed - Date.now();
      }
      say(msgId, 'Saved.', true);
      if (editingId) closeEditor();
      load(true);
    }).catch(function (err) {
      say(msgId, (err && err.pmNetwork) ? 'No connection. Status not saved.' : (err.message || 'Could not save.'));
    });
  }

  function render() {
    $('signedIn').textContent = me ? 'Signed in as ' + me.name + (PMSession.isAdmin(me) ? ' (Administrator)' : '') : '';
    var mine = find(me && me.id);
    var line = $('mine');
    PMDom.clear(line);
    line.appendChild(dot(mine ? mine.status : ''));
    var text = 'Unknown';
    if (mine && mine.status) text = labelOf(mine.status) + (mine.location ? ' — ' + mine.location : '');
    line.appendChild(document.createTextNode(text));
    if (me) buildPicker($('minePicker'), me.id, 'mineMsg');
    renderLegend();
    var root = $('board');
    PMDom.clear(root);
    var counts = {};
    var i;
    for (i = 0; i < staff.length; i++) {
      var person = staff[i];
      var key = person.status || '';
      counts[key] = (counts[key] || 0) + 1;
      var li = document.createElement('li');
      li.appendChild(dot(person.status));
      var who = PMDom.el('div', 'who');
      who.appendChild(PMDom.el('div', 'name', person.name + (me && person.id === me.id ? ' (you)' : '')));
      var meta = document.createElement('div');
      var badge = PMDom.el('span', 'badge', person.status ? labelOf(person.status) : 'Unknown');
      var def = info(person.status);
      if (def) badge.style.borderColor = def.color || '#2a6f9b';
      meta.appendChild(badge);
      if (person.location) meta.appendChild(PMDom.el('span', null, person.location));
      who.appendChild(meta);
      if (person.updatedAt) {
        var when = new Date(person.updatedAt);
        var stamp = isNaN(when.getTime()) ? '' : when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        if (stamp) who.appendChild(PMDom.el('div', 'muted', 'Updated ' + stamp + (person.updatedByName && person.updatedById !== person.id ? ' by ' + person.updatedByName : '')));
      }
      li.appendChild(who);
      if (me && PMSession.isAdmin(me) && person.id !== me.id) {
        var act = PMDom.el('div', 'act');
        var button = PMDom.el('button', 'button secondary', 'Change');
        button.type = 'button';
        button.disabled = !online;
        button.setAttribute('aria-label', 'Change status for ' + person.name);
        (function (id) { button.onclick = function () { openEditor(id); }; })(person.id);
        act.appendChild(button);
        li.appendChild(act);
      }
      root.appendChild(li);
    }
    if (!staff.length) root.appendChild(PMDom.el('li', 'muted', 'No active staff accounts.'));
    var parts = [];
    var list = activeStatuses();
    for (i = 0; i < list.length; i++) if (counts[list[i].code]) parts.push(list[i].label + ' ' + counts[list[i].code]);
    if (counts['']) parts.push('Unknown ' + counts['']);
    $('counts').textContent = parts.join(' · ');
  }

  function openEditor(id) {
    editingId = id;
    var person = find(id);
    $('editorTitle').textContent = 'Change status for ' + (person ? person.name : '');
    buildPicker($('editorPicker'), id, 'editorMsg');
    say('editorMsg', '');
    PMDom.show($('editor'), true);
  }

  function closeEditor() {
    editingId = null;
    PMDom.show($('editor'), false);
  }

  $('editorClose').onclick = closeEditor;
  $('editor').onclick = function (event) { if (event.target === $('editor')) closeEditor(); };

  function remember(dayKey) {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({
        at: new Date().toISOString(),
        dayKey: dayKey,
        by: me && me.id,
        staff: staff,
        statuses: statuses
      }));
    } catch (e) {}
  }

  function showCached(reason) {
    online = false;
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) {}
    var today = todayKey();
    if (cached && cached.dayKey === today && cached.staff) {
      staff = cached.staff;
      statuses = cached.statuses || statuses;
      render();
      notice('Offline — showing the last board saved on this device for today (Eastern). It may be out of date.');
      $('refreshed').textContent = 'Saved on this device';
      return;
    }
    staff = [];
    render();
    notice('Cannot load today’s status board' + (reason ? ': ' + reason : '') + '. Prior-day statuses are not shown as current.', true);
  }

  function blankForNewDay() {
    var i;
    for (i = 0; i < staff.length; i++) {
      staff[i].status = '';
      staff[i].location = '';
      staff[i].updatedAt = '';
      staff[i].updatedById = '';
      staff[i].updatedByName = '';
    }
    render();
  }

  function load(quiet) {
    if (loading && quiet) return;
    loading = true;
    if (!quiet) say('boardMsg', 'Loading…', true);
    $('refresh').disabled = true;
    if (navigator.onLine === false && !pmUseMock()) {
      loading = false;
      $('refresh').disabled = false;
      showCached('no connection');
      return;
    }
    pmCall({ action: 'statusBoard', token: token }).then(function (data) {
      if (data && data.authFailed) { lock(data.message); return; }
      if (!data || data.success !== true) throw new Error((data && data.message) || 'Could not load the board.');
      if (data.serverTime) {
        var parsed = new Date(data.serverTime).getTime();
        if (!isNaN(parsed)) serverSkew = parsed - Date.now();
      }
      loadedDayKey = data.dayKey || todayKey();
      if (loadedDayKey !== todayKey()) {
        blankForNewDay();
        notice('The office day changed. Loading today.');
      }
      online = true;
      statuses = data.statuses || [];
      staff = data.staff || [];
      if (data.me) me.adminFlag = data.me.admin === true;
      notice('');
      PMSession.banner(null);
      render();
      say('boardMsg', '');
      $('refreshed').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      remember(loadedDayKey);
      armMidnight();
    }).catch(function (err) {
      say('boardMsg', '');
      if (err && err.pmNetwork) showCached('the server could not be reached');
      else notice(err.message || 'Could not load the board.', true);
    }).then(function () {
      loading = false;
      $('refresh').disabled = false;
    });
  }

  function armMidnight() {
    clearTimeout(midnightTimer);
    var wait = PMEastern.msUntilEasternMidnightFrom(Date.now() + serverSkew) + 50;
    if (wait < 100) wait = 100;
    if (wait > 2147000000) wait = 2147000000;
    midnightTimer = setTimeout(function () {
      loadedDayKey = '';
      blankForNewDay();
      notice('New day (Eastern). Yesterday’s statuses are not shown as current.');
      load(true);
      armMidnight();
    }, wait);
  }

  $('refresh').onclick = function () { load(false); };

  PMSession.validate().then(function (session) {
    if (!session.staff) {
      PMSession.followGate({ authFailed: true, message: 'Please sign in again.' });
      return;
    }
    if (PMSession.needsPinChange(session.staff)) {
      PMSession.followGate({
        success: true,
        message: 'Change your temporary PIN before using the tools.',
        staff: session.staff
      }, session.staff);
      return;
    }
    token = session.token;
    me = session.staff;
    document.body.classList.remove('is-locked');
    if (session.offline) {
      PMSession.banner(session);
      showCached('no connection');
      return;
    }
    load(false);
    timer = setInterval(function () {
      if (document.hidden) return;
      if (loadedDayKey && loadedDayKey !== todayKey()) {
        blankForNewDay();
        notice('New day (Eastern). Yesterday’s statuses are not shown as current.');
      }
      load(true);
    }, 60000);
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
