(function () {
  function startPage() {
  pmApplyBrand();
  pmRegisterWorker();
  var token = localStorage.getItem(PMSession.TOKEN_KEY) || '';
  var me = null;

  function $(id) { return document.getElementById(id); }
  function say(id, text, good) {
    var node = $(id);
    node.textContent = text || '';
    node.className = 'msg' + (good ? ' good' : '');
  }

  function nextPage() {
    var match = /[?&]next=([a-z0-9.-]+)/i.exec(window.location.search || '');
    var allowed = { 'index.html': 1, 'status.html': 1, 'leave.html': 1, 'personnel.html': 1 };
    if (match && allowed[match[1]]) return match[1];
    return 'index.html';
  }

  function loadRoster() {
    return pmCall({ action: 'authRoster' }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not load the roster.');
      var select = $('staff');
      var prev = select.value;
      PMDom.clear(select);
      select.appendChild(new Option('Select your name', ''));
      var i;
      for (i = 0; i < data.staff.length; i++) {
        select.appendChild(new Option(data.staff[i].name, data.staff[i].id));
      }
      select.value = prev;
    }).catch(function (err) {
      say('loginMsg', 'Cannot load the staff list: ' + (err.message || 'offline'));
    });
  }

  function showAccount(staff, expiresAt, offline) {
    me = staff;
    PMDom.show($('loginPanel'), false);
    PMDom.show($('accountPanel'), true);
    $('welcome').textContent = staff.name;
    $('roles').textContent = 'Roles: ' + (staff.roles || []).join(', ');
    $('expiry').textContent = expiresAt ? 'Credential expires ' + new Date(expiresAt).toLocaleString() : '';
    var changing = PMSession.needsPinChange(staff);
    PMDom.show($('accountShortcuts'), !changing);
    if (changing) {
      PMDom.show($('adminArea'), false);
      PMDom.show($('changePanel'), true);
      say('accountMsg', 'This PIN is temporary. Choose a new 6-digit PIN before the tools will open. You will sign in again after it is saved.');
      $('oldPin').focus();
      return;
    }
    var admin = PMSession.isAdmin(staff) && !offline;
    PMDom.show($('adminArea'), admin);
    if (admin) {
      loadStaff();
      loadStatuses();
    }
  }

  function resume() {
    if (!token) return;
    PMSession.validate().then(function (session) {
      PMSession.banner(session);
      showAccount(session.staff, session.offline ? session.until : session.expiresAt, session.offline);
      if (session.offline) say('accountMsg', 'Offline: PIN changes and admin tools need a connection.');
    }).catch(function (err) {
      if (err && err.pmAuth) {
        localStorage.removeItem(PMSession.TOKEN_KEY);
        PMSession.forget();
        token = '';
      } else {
        say('loginMsg', err.message || 'Could not resume the session.');
      }
    });
  }

  function loadStaff() {
    pmCall({ action: 'authListStaff', token: token }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not load accounts.');
      var root = $('accounts');
      PMDom.clear(root);
      var i;
      for (i = 0; i < data.staff.length; i++) root.appendChild(staffRow(data.staff[i]));
    }).catch(function (err) { say('adminMsg', err.message || 'Could not load accounts.'); });
  }

  function staffRow(person) {
    var row = PMDom.el('div', 'row');
    row.appendChild(PMDom.el('strong', null, person.name + ' — ' + (person.roles || []).join(', ') + (person.active ? '' : ' (INACTIVE)')));
    var roles = PMDom.el('div');
    var staffBox = box('STAFF', (person.roles || []).indexOf('STAFF') !== -1);
    var adminBox = box('ADMIN', (person.roles || []).indexOf('ADMIN') !== -1);
    roles.appendChild(staffBox.label);
    roles.appendChild(adminBox.label);
    var saveRoles = PMDom.el('button', 'button secondary', 'Save roles');
    saveRoles.type = 'button';
    saveRoles.onclick = function () {
      var next = [];
      if (staffBox.input.checked) next.push('STAFF');
      if (adminBox.input.checked) next.push('ADMIN');
      if (!next.length) { say('adminMsg', 'Select at least one role.'); return; }
      if (me && String(me.id) === String(person.id) && (person.roles || []).indexOf('ADMIN') !== -1 && next.indexOf('ADMIN') === -1) {
        if (!window.confirm('Remove your own administrator role? You will need another administrator to restore it.')) return;
      }
      pmCall({ action: 'authSetRoles', token: token, staffId: person.id, roles: next }).then(function (data) {
        if (!data.success) throw new Error(data.message || 'Could not save roles.');
        say('adminMsg', 'Roles updated for ' + person.name + '.', true);
        if (String(me.id) === String(person.id)) {
          localStorage.removeItem(PMSession.TOKEN_KEY);
          PMSession.forget();
          window.location.reload();
          return;
        }
        loadStaff();
      }).catch(function (err) { say('adminMsg', err.message || 'Could not save roles.'); });
    };
    var pin = document.createElement('input');
    pin.type = 'password';
    pin.inputMode = 'numeric';
    pin.maxLength = 6;
    pin.placeholder = 'Temp PIN';
    pin.autocomplete = 'off';
    pin.style.maxWidth = '140px';
    pin.style.display = 'inline-block';
    pin.style.marginRight = '8px';
    var reset = PMDom.el('button', 'button secondary', 'Reset PIN');
    reset.type = 'button';
    reset.onclick = function () {
      pmCall({ action: 'authResetPin', token: token, staffId: person.id, temporaryPin: pin.value }).then(function (data) {
        if (!data.success) throw new Error(data.message || 'Could not reset the PIN.');
        pin.value = '';
        say('adminMsg', 'Temporary PIN set for ' + person.name + '. Share it in person.', true);
        loadStaff();
      }).catch(function (err) { say('adminMsg', err.message || 'Could not reset the PIN.'); });
    };
    var active = PMDom.el('button', 'button secondary', person.active ? 'Deactivate' : 'Activate');
    active.type = 'button';
    active.onclick = function () {
      if (!window.confirm((person.active ? 'Deactivate ' : 'Activate ') + person.name + '?')) return;
      pmCall({ action: 'authSetActive', token: token, staffId: person.id, active: !person.active }).then(function (data) {
        if (!data.success) throw new Error(data.message || 'Could not update the account.');
        say('adminMsg', 'Updated ' + person.name + '.', true);
        loadStaff();
        loadRoster();
      }).catch(function (err) { say('adminMsg', err.message || 'Could not update the account.'); });
    };
    var del = PMDom.el('button', 'button danger', 'Delete');
    del.type = 'button';
    del.onclick = function () {
      if (!window.confirm('Delete ' + person.name + '? Audit history is kept.')) return;
      if (!window.confirm('Delete ' + person.name + ' permanently?')) return;
      pmCall({ action: 'authDeleteStaff', token: token, staffId: person.id }).then(function (data) {
        if (!data.success) throw new Error(data.message || 'Could not delete the account.');
        say('adminMsg', 'Deleted ' + person.name + '.', true);
        loadStaff();
        loadRoster();
      }).catch(function (err) { say('adminMsg', err.message || 'Could not delete the account.'); });
    };
    var actions = PMDom.el('div', 'actions');
    actions.appendChild(saveRoles);
    actions.appendChild(pin);
    actions.appendChild(reset);
    actions.appendChild(active);
    actions.appendChild(del);
    row.appendChild(roles);
    row.appendChild(actions);
    return row;
  }

  function box(text, checked) {
    var label = PMDom.el('label', 'check');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    label.appendChild(input);
    label.appendChild(document.createTextNode(' ' + text));
    return { label: label, input: input };
  }

  function loadStatuses() {
    pmCall({ action: 'statusConfigList', token: token }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not load statuses.');
      renderStatuses(data.statuses || []);
    }).catch(function (err) { say('statusMsg', err.message || 'Could not load statuses.'); });
  }

  function renderStatuses(list) {
    var root = $('statusEditor');
    PMDom.clear(root);
    var i;
    for (i = 0; i < list.length; i++) root.appendChild(statusRow(list[i], i, list));
  }

  function statusRow(item, index, list) {
    var row = PMDom.el('div', 'row');
    var code = document.createElement('input');
    code.value = item.code || '';
    code.maxLength = 20;
    code.placeholder = 'CODE';
    code.style.maxWidth = '140px';
    code.style.display = 'inline-block';
    code.style.marginRight = '8px';
    var label = document.createElement('input');
    label.value = item.label || '';
    label.maxLength = 30;
    label.placeholder = 'Label';
    label.style.maxWidth = '180px';
    label.style.display = 'inline-block';
    label.style.marginRight = '8px';
    var loc = box('Needs location', item.needsLocation === true);
    var active = box('Active', item.active !== false);
    var color = document.createElement('input');
    color.value = item.color || '#2a6f9b';
    color.maxLength = 7;
    color.style.maxWidth = '100px';
    color.style.display = 'inline-block';
    var up = PMDom.el('button', 'button secondary', 'Up');
    var down = PMDom.el('button', 'button secondary', 'Down');
    up.type = 'button';
    down.type = 'button';
    up.onclick = function () { move(index, -1); };
    down.onclick = function () { move(index, 1); };
    row.appendChild(code);
    row.appendChild(label);
    row.appendChild(loc.label);
    row.appendChild(active.label);
    row.appendChild(color);
    var actions = PMDom.el('div', 'actions');
    actions.appendChild(up);
    actions.appendChild(down);
    row.appendChild(actions);
    row._read = function () {
      return {
        code: code.value,
        label: label.value,
        needsLocation: loc.input.checked,
        active: active.input.checked,
        color: color.value
      };
    };
    return row;

    function move(from, delta) {
      var rows = readStatusRows();
      var to = from + delta;
      if (to < 0 || to >= rows.length) return;
      var swap = rows[from];
      rows[from] = rows[to];
      rows[to] = swap;
      renderStatuses(rows);
    }
  }

  function readStatusRows() {
    var root = $('statusEditor');
    var rows = [];
    var i;
    for (i = 0; i < root.children.length; i++) {
      if (root.children[i]._read) rows.push(root.children[i]._read());
    }
    return rows;
  }

  $('saveStatuses').onclick = function () {
    pmCall({ action: 'statusConfigSave', token: token, statuses: readStatusRows() }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not save statuses.');
      say('statusMsg', 'Status list saved.', true);
      renderStatuses(data.statuses || []);
    }).catch(function (err) { say('statusMsg', err.message || 'Could not save statuses.'); });
  };
  $('addStatus').onclick = function () {
    var rows = readStatusRows();
    rows.push({ code: '', label: '', needsLocation: false, active: true, color: '#2563eb' });
    renderStatuses(rows);
  };

  $('refresh').onclick = loadRoster;
  $('login').onclick = function () {
    var button = $('login');
    button.disabled = true;
    pmCall({
      action: 'authLogin',
      staffId: $('staff').value,
      pin: $('pin').value,
      trust: $('trust').checked
    }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not sign in.');
      token = data.token;
      localStorage.setItem(PMSession.TOKEN_KEY, token);
      PMSession.remember(token, data.staff, data.expiresAt);
      $('pin').value = '';
      if (PMSession.needsPinChange(data.staff)) showAccount(data.staff, data.expiresAt, false);
      else window.location.href = nextPage();
    }).catch(function (err) {
      say('loginMsg', (err && err.pmNetwork) ? 'No connection. Signing in needs the server.' : (err.message || 'Could not sign in.'));
    }).then(function () { button.disabled = false; });
  };
  $('pin').onkeydown = function (event) {
    if (event.keyCode === 13) $('login').onclick();
  };
  $('logout').onclick = function () {
    pmCall({ action: 'authLogout', token: token }).catch(function () {}).then(function () {
      localStorage.removeItem(PMSession.TOKEN_KEY);
      PMSession.forget();
      window.location.href = 'login.html';
    });
  };
  $('showChange').onclick = function () { PMDom.show($('changePanel'), true); };
  $('changePin').onclick = function () {
    var button = $('changePin');
    button.disabled = true;
    pmCall({ action: 'authChangePin', token: token, oldPin: $('oldPin').value, newPin: $('newPin').value }).then(function (data) {
      if (!data || data.success !== true) throw new Error((data && data.message) || 'Could not change the PIN.');
      localStorage.removeItem(PMSession.TOKEN_KEY);
      PMSession.forget();
      try { sessionStorage.setItem('pm-auth-note', 'PIN changed. Sign in with the new PIN.'); } catch (err) {}
      window.location.href = 'login.html';
    }).catch(function (err) {
      button.disabled = false;
      say('accountMsg', err.message || 'Could not change the PIN.');
    });
  };
  $('addStaff').onclick = function () {
    var roles = [];
    if ($('roleStaff').checked) roles.push('STAFF');
    if ($('roleAdmin').checked) roles.push('ADMIN');
    pmCall({
      action: 'authCreateStaff',
      token: token,
      name: $('newName').value,
      email: $('newEmail').value,
      roles: roles,
      temporaryPin: $('tempPin').value
    }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not create the account.');
      $('newName').value = '';
      $('newEmail').value = '';
      $('tempPin').value = '';
      say('adminMsg', 'Account created. Give them the temporary PIN in person.', true);
      loadStaff();
      loadRoster();
    }).catch(function (err) { say('adminMsg', err.message || 'Could not create the account.'); });
  };
  $('viewAudit').onclick = function () {
    pmCall({ action: 'authAudit', token: token }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not load the audit log.');
      var lines = [];
      var i;
      var events = data.events || [];
      for (i = 0; i < events.length; i++) {
        var item = events[i];
        lines.push([item.timestamp, item.staffId, item.action, item.detail].join(' | '));
      }
      $('auditView').textContent = lines.join('\n') || 'No events yet.';
    }).catch(function (err) { say('adminMsg', err.message || 'Could not load the audit log.'); });
  };
  var resetDemo = $('resetDemo');
  if (resetDemo) {
    if (!pmUseMock()) PMDom.show(resetDemo, false);
    resetDemo.onclick = function () {
      if (!window.confirm('Reset demo data on this device?')) return;
      PMMock.reset().then(function () { window.location.reload(); });
    };
  }

  try {
    var priorNote = sessionStorage.getItem('pm-auth-note');
    if (priorNote) {
      sessionStorage.removeItem('pm-auth-note');
      say('loginMsg', priorNote);
    }
  } catch (err) {}

  loadRoster();
  resume();
  }
  PMAccess.whenReady(startPage);
})();
