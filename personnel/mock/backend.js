/* Local stand-in for the Apps Script web app.
 * Demo accounts accept any 6-digit PIN. Accounts an admin creates in the demo
 * use the PIN they typed. Nothing here is a real credential, and this file is
 * never the production backend.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../js/logic/auth.js'),
      require('../js/logic/dates.js'),
      require('../js/logic/eastern.js'),
      require('../js/logic/leave.js')
    );
  } else {
    root.PMMock = factory(root.PMAuth, root.PMDates, root.PMEastern, root.PMLeave);
  }
})(typeof self !== 'undefined' ? self : this, function (PMAuth, PMDates, PMEastern, PMLeave) {
  'use strict';

  var DB_KEY = 'pm-mock-db-v1';
  var PALETTE = ['#1f9d55', '#7b8794', '#f2b01e', '#ea6c0a', '#d1293d', '#db2777', '#0e9fa6', '#2563eb', '#7c3aed'];

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function memoryStorage() {
    var data = {};
    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem: function (key, value) {
        data[key] = String(value);
      },
      removeItem: function (key) {
        delete data[key];
      }
    };
  }

  function createMock(storage, options) {
    options = options || {};
    var store = storage || memoryStorage();
    var nowFn = options.now || function () { return Date.now(); };
    var accessMode = 'digits';
    if (options.configured === false || options.accessPin === '') accessMode = 'off';
    else if (typeof options.accessPin === 'string') accessMode = 'exact';
    var accessPin = accessMode === 'exact' ? options.accessPin : '';
    var accessLimit = options.accessLimit || 10;
    var accessAttempts = [];
    var accessSecret = 'mock-secret-' + Math.random().toString(16).slice(2);

    function nowIso() {
      return new Date(nowFn()).toISOString();
    }

    function today() {
      return PMEastern.easternDayKey(new Date(nowFn()));
    }

    function uid(prefix) {
      return prefix + '-' + nowFn().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
    }

    function blank() {
      return {
        staff: [],
        sessions: [],
        audit: [],
        news: [],
        statuses: [],
        statusCurrent: [],
        statusHistory: [],
        leave: [],
        details: [],
        personnel: []
      };
    }

    function load() {
      try {
        var parsed = JSON.parse(store.getItem(DB_KEY) || 'null');
        if (parsed && parsed.staff) return parsed;
      } catch (e) { /* reseed */ }
      var seeded = seed();
      save(seeded);
      return seeded;
    }

    function save(db) {
      store.setItem(DB_KEY, JSON.stringify(db));
    }

    function seed() {
      var db = blank();
      var day = today();
      db.staff = [
        { id: 'stf-casey', name: 'Casey Nguyen', roles: ['ADMIN', 'STAFF'], active: true, demo: true, pin: '', email: 'casey.nguyen@example.test', forceReset: false },
        { id: 'stf-riley', name: 'Riley Patel', roles: ['STAFF'], active: true, demo: true, pin: '', email: 'riley.patel@example.test', forceReset: false },
        { id: 'stf-morgan', name: 'Morgan Blake', roles: ['STAFF'], active: true, demo: true, pin: '', email: 'morgan.blake@example.test', forceReset: false },
        { id: 'stf-avery', name: 'Avery Chen', roles: ['STAFF'], active: true, demo: true, pin: '', email: 'avery.chen@example.test', forceReset: false }
      ];
      db.statuses = [
        { code: 'IN', label: 'IN', needsLocation: false, active: true, sort: 1, color: '#1f9d55' },
        { code: 'OUT', label: 'OUT', needsLocation: false, active: true, sort: 2, color: '#7b8794' },
        { code: 'LUNCH', label: 'LUNCH', needsLocation: false, active: true, sort: 3, color: '#f2b01e' },
        { code: 'ON APPT', label: 'ON APPT', needsLocation: false, active: true, sort: 4, color: '#ea6c0a' },
        { code: 'IN LATE', label: 'IN LATE', needsLocation: false, active: true, sort: 5, color: '#d1293d' },
        { code: 'LEAVE', label: 'LEAVE', needsLocation: false, active: true, sort: 6, color: '#db2777' },
        { code: 'OTHER', label: 'Other', needsLocation: true, active: true, sort: 7, color: '#0e9fa6' }
      ];
      db.statusCurrent = [
        rowStatus('stf-casey', 'IN', '', 'stf-casey', 'Casey Nguyen'),
        rowStatus('stf-riley', 'LUNCH', '', 'stf-riley', 'Riley Patel'),
        rowStatus('stf-morgan', 'OUT', '', 'stf-morgan', 'Morgan Blake'),
        rowStatus('stf-avery', 'ON APPT', '', 'stf-avery', 'Avery Chen')
      ];
      db.statusHistory = copy(db.statusCurrent).map(function (row, index) {
        row.id = 'hist-seed-' + index;
        return row;
      });
      db.news = [
        { id: 'news-1', title: 'Welcome to the demo', body: 'This announcement is fake sample data. It lives in this browser only while demo mode is on. Administrators can post, edit, and delete notices.', date: day, authorId: 'stf-casey', authorName: 'Casey Nguyen', updatedAt: nowIso() },
        { id: 'news-2', title: 'In-processing window', body: 'Sample notice: new arrivals should check in with the front office before 0900. This is not a real instruction.', date: PMDates.addDaysYMD(day, -2), authorId: 'stf-casey', authorName: 'Casey Nguyen', updatedAt: nowIso() },
        { id: 'news-3', title: 'Status board reminder', body: 'Set your status when you arrive. The board returns to Unknown at midnight Eastern, and the previous day stays in history.', date: PMDates.addDaysYMD(day, -9), authorId: 'stf-riley', authorName: 'Riley Patel', updatedAt: nowIso() }
      ];
      db.details = [
        { id: 'det-ddr', name: 'DDR', required: 10, active: true, sort: 1 },
        { id: 'det-fac', name: 'FAC', required: 10, active: true, sort: 2 },
        { id: 'det-ops', name: 'OPS', required: 4, active: true, sort: 3 },
        { id: 'det-trn', name: 'TRAINING', required: 3, active: true, sort: 4 }
      ];
      db.personnel = seedPersonnel(day);
      db.leave = [
        { id: 'lv-1', name: 'Riley Patel', type: 'Leave', start: PMDates.addDaysYMD(day, 3), end: PMDates.addDaysYMD(day, 7), startTime: '', endTime: '', days: 5, notes: 'Fake ordinary leave.', status: 'Approved', submitted: PMDates.addDaysYMD(day, -4) },
        { id: 'lv-2', name: 'Morgan Blake', type: 'Appointment', start: day, end: day, startTime: '13:30', endTime: '', days: 1, notes: 'Fake dental appointment.', status: 'Pending', submitted: day },
        { id: 'lv-3', name: 'Avery Chen', type: 'In Late', start: PMDates.addDaysYMD(day, 1), end: PMDates.addDaysYMD(day, 1), startTime: '10:00', endTime: '', days: 1, notes: 'Fake late arrival.', status: 'Pending', submitted: day },
        { id: 'lv-4', name: 'Casey Nguyen', type: 'Day Pass', start: PMDates.addDaysYMD(day, -2), end: PMDates.addDaysYMD(day, -2), startTime: '', endTime: '', days: 1, notes: 'Fake day pass.', status: 'Denied', submitted: PMDates.addDaysYMD(day, -6) }
      ];
      return db;

      function rowStatus(staffId, status, location, byId, byName) {
        return {
          staffId: staffId,
          status: status,
          location: location,
          updatedAt: nowIso(),
          updatedById: byId,
          updatedByName: byName
        };
      }
    }

    function seedPersonnel(day) {
      var specs = [
        ['TSgt', 'Alex Sample', 'Assigned', 'det-ddr', -800, 80, '', 'Longest demo tour.'],
        ['SSgt', 'Jordan Example', 'Assigned', 'det-ddr', -400, 55, '', ''],
        ['SrA', 'Riley Placeholder', 'Assigned', 'det-ddr', -220, '', '', ''],
        ['A1C', 'Morgan Fiction', 'Assigned', 'det-ddr', -90, 20, '', 'Leaves inside 30 days.'],
        ['MSgt', 'Casey Demo', 'Assigned', 'det-ddr', -40, '', '', ''],
        ['Amn', 'Quinn Test', 'Assigned', 'det-ddr', -15, '', '', ''],
        ['SSgt', 'Avery Mock', 'Assigned', 'det-fac', -300, 12, '', ''],
        ['TSgt', 'Blake Synthetic', 'Assigned', 'det-fac', -260, '', '', ''],
        ['SrA', 'Cameron Pretend', 'Assigned', 'det-fac', -210, 40, '', ''],
        ['A1C', 'Skyler Imaginary', 'Assigned', 'det-fac', -180, '', '', ''],
        ['Capt', 'Reese Invented', 'Assigned', 'det-fac', -150, '', '', ''],
        ['SSgt', 'Drew Fictional', 'Assigned', 'det-fac', -120, 25, '', ''],
        ['Amn', 'Parker Madeup', 'Assigned', 'det-fac', -100, '', '', ''],
        ['TSgt', 'Sawyer Sampleton', 'Assigned', 'det-fac', -70, '', '', ''],
        ['SrA', 'Finley Practice', 'Assigned', 'det-fac', -30, 8, '', ''],
        ['A1C', 'Rowan Story', 'Assigned', 'det-fac', -5, '', '', ''],
        ['SSgt', 'Hayden Unreal', 'Assigned', 'det-ops', -64, '', '', ''],
        ['TSgt', 'Emerson Placeholder', 'Assigned', 'det-ops', -48, 100, '', ''],
        ['SrA', 'Jamie Notreal', 'Assigned', 'det-ops', -33, '', '', ''],
        ['A1C', 'Taylor Faux', 'Assigned', 'det-ops', -18, '', '', ''],
        ['SSgt', 'Dakota Over', 'Outbound', 'det-ops', -200, 14, '', 'Out-processing. Still fills OPS.'],
        ['TSgt', 'Logan Lesson', 'Assigned', 'det-trn', -140, '', '', ''],
        ['SrA', 'Peyton Drill', 'Assigned', 'det-trn', -22, 70, '', ''],
        ['Amn', 'Indigo Arrival', 'Inbound', '', -2, 200, '', 'In-processing. Not on a detail yet.'],
        ['A1C', 'Nova Inbound', 'Inbound', '', -1, '', '', 'Arrival date is set. No detail.'],
        ['SSgt', 'River Unassigned', 'Assigned', '', -30, '', '', 'Assigned, but no detail on purpose.'],
        ['MSgt', 'Harper History', 'Departed', 'det-fac', -500, '', -40, 'Departed. Kept for history.'],
        ['TSgt', 'Quinn Departed', 'Departed', 'det-ddr', -420, '', -75, ''],
        ['SSgt', 'Sam Gone', 'Departed', 'det-ops', -300, '', -110, ''],
        ['SrA', 'Alex Left', 'Departed', 'det-trn', -250, '', -200, '']
      ];
      var rows = [];
      var i;
      for (i = 0; i < specs.length; i++) {
        var spec = specs[i];
        rows.push({
          id: 'per-' + (i + 1),
          rank: spec[0],
          name: spec[1],
          status: spec[2],
          detailId: spec[3],
          arrivalDate: spec[4] === '' ? '' : PMDates.addDaysYMD(day, spec[4]),
          projectedDeparture: spec[5] === '' ? '' : PMDates.addDaysYMD(day, spec[5]),
          actualDeparture: spec[6] === '' ? '' : PMDates.addDaysYMD(day, spec[6]),
          notes: spec[7] || 'Fake demo record.',
          inProcessAt: spec[2] === 'Inbound' ? nowIso() : '',
          outProcessAt: spec[2] === 'Outbound' ? nowIso() : '',
          updatedAt: nowIso()
        });
      }
      var pending = {
        id: 'per-pending',
        rank: 'AB',
        name: 'Robin Undated',
        status: 'Inbound',
        detailId: '',
        arrivalDate: '',
        projectedDeparture: '',
        actualDeparture: '',
        notes: 'Fake inbound record with no arrival date yet.',
        inProcessAt: nowIso(),
        outProcessAt: '',
        updatedAt: nowIso()
      };
      rows.push(pending);
      return rows;
    }

    function publicStaff(staff) {
      return {
        id: staff.id,
        name: staff.name,
        roles: copy(staff.roles || []),
        forceReset: staff.forceReset === true,
        active: staff.active !== false
      };
    }

    function findStaff(db, id) {
      var i;
      for (i = 0; i < db.staff.length; i++) {
        if (String(db.staff[i].id) === String(id)) return db.staff[i];
      }
      return null;
    }

    function sessionStaff(db, token) {
      if (!token) return null;
      var i;
      for (i = 0; i < db.sessions.length; i++) {
        var session = db.sessions[i];
        if (session.token !== token) continue;
        if (new Date(session.expiresAt).getTime() <= nowFn()) return null;
        var staff = findStaff(db, session.staffId);
        if (!staff || staff.active === false) return null;
        return staff;
      }
      return null;
    }

    function audit(db, staffId, action, detail) {
      db.audit.unshift({
        timestamp: nowIso(),
        staffId: staffId || '',
        action: action,
        detail: String(detail || '').slice(0, 300)
      });
      if (db.audit.length > 200) db.audit.length = 200;
    }

    function fail(message, authFailed) {
      var out = { success: false, message: message };
      if (authFailed) out.authFailed = true;
      return out;
    }

    function pinOk(staff, pin) {
      var text = String(pin || '');
      if (!/^\d{6}$/.test(text)) return false;
      if (staff.demo === true && !staff.pin) return true;
      return staff.pin === text;
    }

    function activeAdmins(db, exceptId) {
      var n = 0;
      var i;
      for (i = 0; i < db.staff.length; i++) {
        var staff = db.staff[i];
        if (exceptId && String(staff.id) === String(exceptId)) continue;
        if (staff.active === false) continue;
        if ((staff.roles || []).indexOf('ADMIN') !== -1) n += 1;
      }
      return n;
    }

    function statusByCode(db, code) {
      var i;
      for (i = 0; i < db.statuses.length; i++) {
        if (db.statuses[i].code === code && db.statuses[i].active !== false) return db.statuses[i];
      }
      return null;
    }

    function needsLocationMap(db) {
      var map = {};
      var i;
      for (i = 0; i < db.statuses.length; i++) map[db.statuses[i].code] = !!db.statuses[i].needsLocation;
      return map;
    }

    function presentBoard(db) {
      var day = today();
      var needs = needsLocationMap(db);
      var rows = [];
      var i;
      for (i = 0; i < db.staff.length; i++) {
        var staff = db.staff[i];
        if (staff.active === false) continue;
        var current = null;
        var c;
        for (c = 0; c < db.statusCurrent.length; c++) {
          if (String(db.statusCurrent[c].staffId) === String(staff.id)) current = db.statusCurrent[c];
        }
        var shown = PMEastern.presentStatus(current || {}, day, current && needs[current.status]);
        rows.push({
          id: staff.id,
          name: staff.name,
          status: shown.status,
          location: shown.location,
          updatedAt: shown.updatedAt,
          updatedById: shown.updatedById,
          updatedByName: shown.updatedByName
        });
      }
      rows.sort(function (a, b) {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
      return rows;
    }

    function cleanRoles(roles) {
      var allowed = { STAFF: true, ADMIN: true };
      var out = [];
      var i;
      var list = roles || [];
      for (i = 0; i < list.length; i++) {
        var role = String(list[i] || '');
        if (!allowed[role]) continue;
        if (out.indexOf(role) === -1) out.push(role);
      }
      if (out.indexOf('ADMIN') !== -1 && out.indexOf('STAFF') === -1) out.push('STAFF');
      return out;
    }

    function mac(text) {
      var h = 5381;
      var s = accessSecret + ':' + String(text);
      var i;
      for (i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
      return h.toString(16);
    }

    function digest(text) {
      var h = 5381;
      var s = 'personnel-access:' + String(text);
      var i;
      for (i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
      return ('00000000' + h.toString(16)).slice(-8);
    }

    function timingEqual(left, right) {
      var a = String(left);
      var b = String(right);
      if (a.length !== b.length) return false;
      var diff = 0;
      var i;
      for (i = 0; i < a.length; i++) diff = diff | (a.charCodeAt(i) ^ b.charCodeAt(i));
      return diff === 0;
    }

    function accessLimited() {
      var now = nowFn();
      var kept = [];
      var i;
      for (i = 0; i < accessAttempts.length; i++) {
        if (now - accessAttempts[i] < 60000) kept.push(accessAttempts[i]);
      }
      if (kept.length >= accessLimit) {
        accessAttempts = kept;
        return true;
      }
      kept.push(now);
      accessAttempts = kept;
      return false;
    }

    function issueAccessToken() {
      var exp = nowFn() + 12 * 3600000;
      return {
        success: true,
        accessToken: String(exp) + '.' + mac(String(exp)),
        expiresAt: new Date(exp).toISOString()
      };
    }

    function accessTokenOk(token) {
      var parts = String(token || '').split('.');
      if (parts.length !== 2 || !/^\d+$/.test(parts[0])) return false;
      var exp = Number(parts[0]);
      if (!exp || exp <= nowFn()) return false;
      return timingEqual(mac(parts[0]), parts[1]);
    }

    function accessCheck(body) {
      if (accessMode === 'off') return { success: false, message: 'Access is not configured.' };
      if (accessLimited()) return { success: false, message: 'Access denied.' };
      var pin = body && body.pin != null ? String(body.pin) : '';
      var ok = false;
      if (accessMode === 'exact') ok = pin !== '' && timingEqual(digest(pin), digest(accessPin));
      else ok = /^\d{4,8}$/.test(pin);
      if (!ok) return { success: false, message: 'Access denied.' };
      return issueAccessToken();
    }

    function handle(body) {
      body = body || {};
      var action = String(body.action || '');
      var db = load();
      var result = dispatch(db, action, body);
      save(db);
      return copy(result);
    }

    function dispatch(db, action, body) {
      if (action === 'accessCheck') return accessCheck(body);
      if (accessMode === 'off') return { success: false, accessRequired: true, message: 'Access is not configured.' };
      if (!accessTokenOk(body.accessToken)) return { success: false, accessRequired: true, message: 'Enter the access PIN.' };
      if (action === 'authRoster') return roster(db);
      if (action === 'authLogin') return login(db, body);
      if (action === 'authValidate') return validate(db, body);

      var staff = sessionStaff(db, String(body.token || ''));
      if (!staff) return fail('Session expired. Please sign in again.', true);

      var targetId = body.staffId ? String(body.staffId) : '';
      var decision = PMAuth.authorize(action, staff, { targetId: targetId });
      if (!decision.ok) {
        if (decision.message === 'Sign in required.' || decision.message === 'This account is inactive.') {
          return fail(decision.message, true);
        }
        return fail(decision.message);
      }

      if (action === 'authLogout') return logout(db, body, staff);
      if (action === 'authChangePin') return changePin(db, body, staff);
      if (action === 'authListStaff') return listStaff(db);
      if (action === 'authCreateStaff') return createStaff(db, body, staff);
      if (action === 'authSetRoles') return setRoles(db, body, staff);
      if (action === 'authResetPin') return resetPin(db, body, staff);
      if (action === 'authSetActive') return setActive(db, body, staff);
      if (action === 'authDeleteStaff') return deleteStaff(db, body, staff);
      if (action === 'authAudit') return { success: true, events: copy(db.audit).slice(0, 100) };
      if (action === 'newsList') return newsList(db);
      if (action === 'newsSave') return newsSave(db, body, staff);
      if (action === 'newsDelete') return newsDelete(db, body, staff);
      if (action === 'statusBoard') return statusBoard(db, staff);
      if (action === 'statusSet') return statusSet(db, body, staff);
      if (action === 'statusConfigList') return { success: true, statuses: copy(db.statuses) };
      if (action === 'statusConfigSave') return statusConfigSave(db, body, staff);
      if (action === 'leaveList') return { success: true, requests: copy(db.leave) };
      if (action === 'leaveAdd') return leaveAdd(db, body, staff);
      if (action === 'leaveUpdate') return leaveUpdate(db, body, staff);
      if (action === 'leaveDelete') return leaveDelete(db, body, staff);
      if (action === 'personnelList') return personnelList(db);
      if (action === 'personnelSave') return personnelSave(db, body, staff);
      if (action === 'personnelAction') return personnelAction(db, body, staff);
      if (action === 'detailSave') return detailSave(db, body, staff);
      if (action === 'detailDelete') return detailDelete(db, body, staff);
      return fail('Unknown action.');
    }

    function roster(db) {
      var rows = [];
      var i;
      for (i = 0; i < db.staff.length; i++) {
        if (db.staff[i].active === false) continue;
        rows.push({ id: db.staff[i].id, name: db.staff[i].name });
      }
      rows.sort(function (a, b) {
        if (a.name < b.name) return -1;
        if (a.name > b.name) return 1;
        return 0;
      });
      return { success: true, staff: rows, demo: true };
    }

    function login(db, body) {
      var staff = findStaff(db, body.staffId);
      if (!staff || staff.active === false) return fail('Select your name.');
      if (!pinOk(staff, body.pin)) return fail('Incorrect PIN.');
      var hours = body.trust ? 24 * 30 : 12;
      var token = uid('tok');
      db.sessions.push({
        token: token,
        staffId: staff.id,
        expiresAt: new Date(nowFn() + hours * 3600000).toISOString(),
        trusted: !!body.trust
      });
      audit(db, staff.id, 'authLogin', staff.name);
      return {
        success: true,
        token: token,
        expiresAt: db.sessions[db.sessions.length - 1].expiresAt,
        staff: publicStaff(staff)
      };
    }

    function validate(db, body) {
      var staff = sessionStaff(db, String(body.token || ''));
      if (!staff) return fail('Session expired. Please sign in again.', true);
      var session = null;
      var i;
      for (i = 0; i < db.sessions.length; i++) {
        if (db.sessions[i].token === String(body.token)) session = db.sessions[i];
      }
      return { success: true, staff: publicStaff(staff), expiresAt: session ? session.expiresAt : '' };
    }

    function logout(db, body, staff) {
      var kept = [];
      var i;
      for (i = 0; i < db.sessions.length; i++) {
        if (db.sessions[i].token !== String(body.token)) kept.push(db.sessions[i]);
      }
      db.sessions = kept;
      audit(db, staff.id, 'authLogout', staff.name);
      return { success: true };
    }

    function changePin(db, body, staff) {
      var next = String(body.newPin || '');
      if (!/^\d{6}$/.test(next)) return fail('Choose a 6-digit PIN.');
      if (!pinOk(staff, body.oldPin)) return fail('Current PIN is incorrect.');
      if (next === String(body.oldPin || '') && staff.pin) return fail('Choose a different PIN.');
      staff.pin = next;
      staff.demo = false;
      staff.forceReset = false;
      var kept = [];
      var i;
      for (i = 0; i < db.sessions.length; i++) {
        if (String(db.sessions[i].staffId) !== String(staff.id)) kept.push(db.sessions[i]);
      }
      db.sessions = kept;
      audit(db, staff.id, 'authChangePin', staff.name);
      return { success: true, message: 'PIN changed. Sign in again.' };
    }

    function listStaff(db) {
      var rows = [];
      var i;
      for (i = 0; i < db.staff.length; i++) {
        var staff = db.staff[i];
        rows.push({
          id: staff.id,
          name: staff.name,
          roles: copy(staff.roles || []),
          active: staff.active !== false,
          email: staff.email || '',
          forceReset: staff.forceReset === true
        });
      }
      return { success: true, staff: rows };
    }

    function createStaff(db, body, actor) {
      var name = String(body.name || '').replace(/\s+/g, ' ').trim();
      var pin = String(body.temporaryPin || '');
      var roles = cleanRoles(body.roles);
      if (!name) return fail('Enter a name.');
      if (!/^\d{6}$/.test(pin)) return fail('Temporary PIN must be 6 digits.');
      if (!roles.length) return fail('Select at least one role.');
      var row = {
        id: uid('stf'),
        name: name,
        roles: roles,
        active: true,
        demo: false,
        pin: pin,
        email: String(body.email || '').trim(),
        forceReset: true
      };
      db.staff.push(row);
      audit(db, actor.id, 'authCreateStaff', name);
      return { success: true, staff: publicStaff(row) };
    }

    function setRoles(db, body, actor) {
      var staff = findStaff(db, body.staffId);
      if (!staff) return fail('Staff member not found.');
      var roles = cleanRoles(body.roles);
      if (!roles.length) return fail('Select at least one role.');
      var wasAdmin = (staff.roles || []).indexOf('ADMIN') !== -1;
      var stillAdmin = roles.indexOf('ADMIN') !== -1;
      if (wasAdmin && !stillAdmin && activeAdmins(db, staff.id) < 1) return fail('Keep at least one active administrator.');
      staff.roles = roles;
      dropSessions(db, staff.id);
      audit(db, actor.id, 'authSetRoles', staff.name + ' -> ' + roles.join(','));
      return { success: true };
    }

    function resetPin(db, body, actor) {
      var staff = findStaff(db, body.staffId);
      var pin = String(body.temporaryPin || '');
      if (!staff) return fail('Staff member not found.');
      if (!/^\d{6}$/.test(pin)) return fail('Temporary PIN must be 6 digits.');
      staff.pin = pin;
      staff.demo = false;
      staff.forceReset = true;
      dropSessions(db, staff.id);
      audit(db, actor.id, 'authResetPin', staff.name);
      return { success: true };
    }

    function setActive(db, body, actor) {
      var staff = findStaff(db, body.staffId);
      if (!staff) return fail('Staff member not found.');
      var active = body.active === true || body.active === 'true';
      if (!active && (staff.roles || []).indexOf('ADMIN') !== -1 && activeAdmins(db, staff.id) < 1) {
        return fail('Keep at least one active administrator.');
      }
      staff.active = active;
      if (!active) dropSessions(db, staff.id);
      audit(db, actor.id, 'authSetActive', staff.name + ' ' + (active ? 'active' : 'inactive'));
      return { success: true };
    }

    function deleteStaff(db, body, actor) {
      var staff = findStaff(db, body.staffId);
      if (!staff) return fail('Staff member not found.');
      if (String(staff.id) === String(actor.id)) return fail('You cannot delete your own account.');
      if ((staff.roles || []).indexOf('ADMIN') !== -1 && staff.active !== false && activeAdmins(db, staff.id) < 1) {
        return fail('Keep at least one active administrator.');
      }
      var kept = [];
      var i;
      for (i = 0; i < db.staff.length; i++) {
        if (String(db.staff[i].id) !== String(staff.id)) kept.push(db.staff[i]);
      }
      db.staff = kept;
      dropSessions(db, staff.id);
      audit(db, actor.id, 'authDeleteStaff', staff.name);
      return { success: true };
    }

    function dropSessions(db, staffId) {
      var kept = [];
      var i;
      for (i = 0; i < db.sessions.length; i++) {
        if (String(db.sessions[i].staffId) !== String(staffId)) kept.push(db.sessions[i]);
      }
      db.sessions = kept;
    }

    function newsList(db) {
      var rows = copy(db.news);
      rows.sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
        return 0;
      });
      return { success: true, news: rows };
    }

    function newsSave(db, body, actor) {
      var title = String(body.title || '').replace(/\s+/g, ' ').trim();
      var text = String(body.body || '').trim();
      var date = String(body.date || '');
      if (!title || title.length > 120) return fail('Enter a title (120 characters or fewer).');
      if (!text || text.length > 4000) return fail('Enter the announcement.');
      if (!PMDates.parseYMD(date)) return fail('Enter a valid date.');
      var row = null;
      var i;
      if (body.id) {
        for (i = 0; i < db.news.length; i++) {
          if (String(db.news[i].id) === String(body.id)) row = db.news[i];
        }
        if (!row) return fail('Announcement not found.');
      } else {
        row = { id: uid('news'), authorId: actor.id };
        db.news.push(row);
      }
      row.title = title;
      row.body = text;
      row.date = date;
      row.authorName = actor.name;
      row.updatedAt = nowIso();
      audit(db, actor.id, 'newsSave', title);
      return { success: true, item: copy(row) };
    }

    function newsDelete(db, body, actor) {
      var kept = [];
      var found = false;
      var i;
      for (i = 0; i < db.news.length; i++) {
        if (String(db.news[i].id) === String(body.id)) found = true;
        else kept.push(db.news[i]);
      }
      if (!found) return fail('Announcement not found.');
      db.news = kept;
      audit(db, actor.id, 'newsDelete', String(body.id || ''));
      return { success: true };
    }

    function statusBoard(db, staff) {
      return {
        success: true,
        dayKey: today(),
        serverTime: nowIso(),
        me: { id: staff.id, name: staff.name, admin: (staff.roles || []).indexOf('ADMIN') !== -1 },
        statuses: copy(db.statuses),
        staff: presentBoard(db)
      };
    }

    function statusSet(db, body, actor) {
      var targetId = body.staffId ? String(body.staffId) : String(actor.id);
      var target = findStaff(db, targetId);
      if (!target || target.active === false) return fail('Staff member not found.');
      var def = statusByCode(db, String(body.status || ''));
      if (!def) return fail('Choose a status from the list.');
      var location = String(body.location || '').replace(/\s+/g, ' ').trim();
      if (def.needsLocation) {
        if (!location) return fail('Enter a location for ' + def.label + '.');
        if (location.length > 60) return fail('Location is too long.');
      } else {
        location = '';
      }
      var entry = {
        staffId: target.id,
        status: def.code,
        location: location,
        updatedAt: nowIso(),
        updatedById: actor.id,
        updatedByName: actor.name
      };
      var replaced = false;
      var i;
      for (i = 0; i < db.statusCurrent.length; i++) {
        if (String(db.statusCurrent[i].staffId) === String(target.id)) {
          db.statusCurrent[i] = entry;
          replaced = true;
        }
      }
      if (!replaced) db.statusCurrent.push(entry);
      var history = copy(entry);
      history.id = uid('hist');
      db.statusHistory.push(history);
      audit(db, actor.id, 'statusSet', target.name + ' ' + def.code);
      return { success: true, entry: copy(entry), dayKey: today(), serverTime: nowIso() };
    }

    function statusConfigSave(db, body, actor) {
      var list = body.statuses;
      if (!list || !list.length) return fail('Keep at least one status.');
      var next = [];
      var seen = {};
      var activeCount = 0;
      var i;
      for (i = 0; i < list.length; i++) {
        var row = list[i] || {};
        var code = String(row.code || '').replace(/\s+/g, ' ').trim().toUpperCase();
        var label = String(row.label || '').replace(/\s+/g, ' ').trim();
        if (!code || !/^[A-Z0-9 ]{1,20}$/.test(code)) return fail('Status codes use letters, numbers, and spaces (20 max).');
        if (!label || label.length > 30) return fail('Each status needs a label.');
        if (seen[code]) return fail('Duplicate status code ' + code + '.');
        seen[code] = true;
        var active = row.active !== false && row.active !== 'false';
        if (active) activeCount += 1;
        var color = String(row.color || '');
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = PALETTE[next.length % PALETTE.length];
        next.push({
          code: code,
          label: label,
          needsLocation: row.needsLocation === true || row.needsLocation === 'true',
          active: active,
          sort: i + 1,
          color: color
        });
      }
      if (!activeCount) return fail('Keep at least one active status.');
      db.statuses = next;
      audit(db, actor.id, 'statusConfigSave', String(next.length));
      return { success: true, statuses: copy(db.statuses) };
    }

    function leaveAdd(db, body, actor) {
      var checked = PMLeave.validateLeave(body);
      if (!checked.ok) return fail(checked.message);
      var row = checked.request;
      row.id = body.id ? String(body.id) : uid('lv');
      row.submitted = body.submitted && PMDates.parseYMD(body.submitted) ? String(body.submitted) : today();
      var i;
      for (i = 0; i < db.leave.length; i++) {
        if (String(db.leave[i].id) === row.id) return fail('That leave id already exists.');
      }
      db.leave.push(row);
      audit(db, actor.id, 'leaveAdd', row.name);
      return { success: true, request: copy(row) };
    }

    function leaveUpdate(db, body, actor) {
      var checked = PMLeave.validateLeave(body);
      if (!checked.ok) return fail(checked.message);
      var i;
      for (i = 0; i < db.leave.length; i++) {
        if (String(db.leave[i].id) === String(body.id)) {
          var submitted = db.leave[i].submitted;
          var row = checked.request;
          row.id = db.leave[i].id;
          row.submitted = submitted;
          db.leave[i] = row;
          audit(db, actor.id, 'leaveUpdate', row.name);
          return { success: true, request: copy(row) };
        }
      }
      return fail('Leave entry not found.');
    }

    function leaveDelete(db, body, actor) {
      var kept = [];
      var found = false;
      var i;
      for (i = 0; i < db.leave.length; i++) {
        if (String(db.leave[i].id) === String(body.id)) found = true;
        else kept.push(db.leave[i]);
      }
      if (!found) return fail('Leave entry not found.');
      db.leave = kept;
      audit(db, actor.id, 'leaveDelete', String(body.id || ''));
      return { success: true };
    }

    function personnelList(db) {
      return {
        success: true,
        details: copy(db.details),
        personnel: copy(db.personnel),
        today: today()
      };
    }

    function findPerson(db, id) {
      var i;
      for (i = 0; i < db.personnel.length; i++) {
        if (String(db.personnel[i].id) === String(id)) return db.personnel[i];
      }
      return null;
    }

    function findDetail(db, id) {
      var i;
      for (i = 0; i < db.details.length; i++) {
        if (String(db.details[i].id) === String(id)) return db.details[i];
      }
      return null;
    }

    function cleanPerson(input, existing) {
      var STATUSES = { Inbound: true, Assigned: true, Outbound: true, Departed: true };
      var name = String(input.name || '').replace(/\s+/g, ' ').trim();
      var rank = String(input.rank || '').replace(/\s+/g, ' ').trim();
      var status = String(input.status || '');
      var notes = String(input.notes || '').trim();
      if (!name || name.length > 100) return fail('Enter a name.');
      if (!rank || rank.length > 30) return fail('Enter a rank.');
      if (!STATUSES[status]) return fail('Choose Inbound, Assigned, Outbound, or Departed.');
      var arrival = String(input.arrivalDate || '');
      var projected = String(input.projectedDeparture || '');
      var actual = String(input.actualDeparture || '');
      if (arrival && !PMDates.parseYMD(arrival)) return fail('Arrival date is not valid.');
      if (projected && !PMDates.parseYMD(projected)) return fail('Projected departure is not valid.');
      if (actual && !PMDates.parseYMD(actual)) return fail('Actual departure is not valid.');
      if (status === 'Departed' && !PMDates.parseYMD(actual)) return fail('Departed people need an actual departure date.');
      if (notes.length > 2000) return fail('Notes are too long.');
      var detailId = String(input.detailId || '');
      return {
        ok: true,
        person: {
          id: existing ? existing.id : '',
          name: name,
          rank: rank,
          status: status,
          arrivalDate: arrival,
          projectedDeparture: projected,
          actualDeparture: status === 'Departed' ? actual : actual,
          detailId: detailId,
          notes: notes,
          inProcessAt: existing && existing.inProcessAt ? existing.inProcessAt : '',
          outProcessAt: existing && existing.outProcessAt ? existing.outProcessAt : '',
          updatedAt: nowIso()
        }
      };
    }

    function assertDetail(db, person) {
      if (!person.detailId) return null;
      var detail = findDetail(db, person.detailId);
      if (!detail || detail.active === false) return fail('Choose an active detail.');
      return null;
    }

    function personnelSave(db, body, actor) {
      var existing = body.id ? findPerson(db, body.id) : null;
      if (body.id && !existing) return fail('Personnel record not found.');
      var cleaned = cleanPerson(body, existing);
      if (!cleaned.ok) return cleaned;
      var detailError = assertDetail(db, cleaned.person);
      if (detailError) return detailError;
      if (!existing) {
        cleaned.person.id = uid('per');
        db.personnel.push(cleaned.person);
      } else {
        var i;
        for (i = 0; i < db.personnel.length; i++) {
          if (db.personnel[i].id === existing.id) db.personnel[i] = cleaned.person;
        }
      }
      audit(db, actor.id, 'personnelSave', cleaned.person.name);
      return { success: true, person: copy(cleaned.person) };
    }

    function personnelAction(db, body, actor) {
      var person = findPerson(db, body.id);
      if (!person) return fail('Personnel record not found.');
      var kind = String(body.kind || '');
      if (kind === 'in-process') {
        person.status = 'Inbound';
        person.detailId = '';
        person.actualDeparture = '';
        if (!person.inProcessAt) person.inProcessAt = nowIso();
      } else if (kind === 'assign') {
        var detail = findDetail(db, body.detailId);
        if (!detail || detail.active === false) return fail('Choose an active detail.');
        person.status = 'Assigned';
        person.detailId = detail.id;
        person.actualDeparture = '';
        if (!person.arrivalDate) person.arrivalDate = today();
      } else if (kind === 'out-process') {
        if (person.status === 'Departed') return fail('Departed people stay in history.');
        if (!person.detailId) return fail('Assign a detail before out-processing.');
        person.status = 'Outbound';
        if (!person.outProcessAt) person.outProcessAt = nowIso();
      } else if (kind === 'depart') {
        var actual = String(body.actualDeparture || person.actualDeparture || '');
        if (!PMDates.parseYMD(actual)) return fail('Enter the actual departure date.');
        person.status = 'Departed';
        person.actualDeparture = actual;
      } else {
        return fail('Unknown personnel action.');
      }
      person.updatedAt = nowIso();
      audit(db, actor.id, 'personnelAction', person.name + ' ' + kind);
      return { success: true, person: copy(person) };
    }

    function detailSave(db, body, actor) {
      var name = String(body.name || '').replace(/\s+/g, ' ').trim();
      var required = Number(body.required);
      if (!name || name.length > 40) return fail('Enter a detail name.');
      if (!isFinite(required) || required < 0 || Math.floor(required) !== required) return fail('Required headcount must be a whole number, 0 or more.');
      var row = body.id ? findDetail(db, body.id) : null;
      if (body.id && !row) return fail('Detail not found.');
      if (!row) {
        row = { id: uid('det'), sort: db.details.length + 1, active: true };
        db.details.push(row);
      }
      row.name = name;
      row.required = required;
      if (body.active === false || body.active === 'false') row.active = false;
      else row.active = true;
      audit(db, actor.id, 'detailSave', name);
      return { success: true, detail: copy(row) };
    }

    function detailDelete(db, body, actor) {
      var detail = findDetail(db, body.id);
      if (!detail) return fail('Detail not found.');
      detail.active = false;
      audit(db, actor.id, 'detailDelete', detail.name);
      return { success: true };
    }

    return {
      handle: handle,
      reset: function () {
        store.removeItem(DB_KEY);
        save(seed());
      },
      setNow: function (fn) {
        nowFn = fn || function () { return Date.now(); };
      },
      debugState: function () {
        return copy(load());
      }
    };
  }

  var browserApi = null;
  function browser() {
    if (!browserApi) {
      var storage = typeof localStorage !== 'undefined' ? localStorage : memoryStorage();
      browserApi = createMock(storage);
    }
    return browserApi;
  }

  return {
    createMock: createMock,
    memoryStorage: memoryStorage,
    handle: function (body) {
      return Promise.resolve(browser().handle(body));
    },
    reset: function () {
      browser().reset();
      return Promise.resolve({ success: true });
    }
  };
});
