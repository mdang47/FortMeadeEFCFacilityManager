/* Staff session and offline grace. Adapted from EFC Tools.
 * The cache never stores a PIN. A server rejection always wins over the cache.
 * Offline mode can open pages; it cannot invent a token.
 */
(function () {
  var TOKEN_KEY = 'pm-staff-token-v1';
  var SESSION_KEY = 'pm-staff-session-v1';
  var OFFLINE_GRACE_MS = 72 * 3600000;
  var UNKNOWN_EXPIRY_MS = 8 * 3600000;
  var lockTimer = 0;

  function read() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }

  function bind(token) {
    return String(token || '').slice(-16);
  }

  function forget() {
    localStorage.removeItem(SESSION_KEY);
  }

  function remember(token, staff, expiresAt) {
    if (!token || !staff) return;
    var prev = read();
    var same = prev && prev.bind === bind(token);
    var roles = [];
    var i;
    var source = staff.roles || [];
    for (i = 0; i < source.length; i++) roles.push(String(source[i]));
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      bind: bind(token),
      staff: {
        id: String(staff.id || ''),
        name: String(staff.name || ''),
        roles: roles,
        forceReset: staff.forceReset === true || staff.forceReset === 'true'
      },
      expiresAt: expiresAt || (same && prev.expiresAt) || null,
      validatedAt: Date.now()
    }));
  }

  function offlineSession(token) {
    var saved = read();
    if (!saved || !token || saved.bind !== bind(token) || !saved.staff || saved.staff.forceReset) return null;
    var now = Date.now();
    var checked = Number(saved.validatedAt) || 0;
    var expiry = saved.expiresAt ? new Date(saved.expiresAt).getTime() : checked + UNKNOWN_EXPIRY_MS;
    var until = Math.min(expiry, checked + OFFLINE_GRACE_MS);
    if (!(checked > 0 && checked <= now + 60000 && now < until)) return null;
    return { staff: saved.staff, until: until, validatedAt: checked };
  }

  function validate() {
    var token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      var missing = new Error('Please sign in to continue.');
      missing.pmAuth = true;
      return Promise.reject(missing);
    }
    if (navigator.onLine === false && !pmUseMock()) {
      var early = offlineSession(token);
      if (early) return Promise.resolve({ token: token, staff: early.staff, offline: true, until: early.until, validatedAt: early.validatedAt });
      var offlineErr = new Error('No internet connection, and this device has no recently verified staff session. Connect and sign in.');
      offlineErr.pmOffline = true;
      return Promise.reject(offlineErr);
    }
    return pmCall({ action: 'authValidate', token: token }).then(function (data) {
      if (!data || data.success !== true || !data.staff) {
        localStorage.removeItem(TOKEN_KEY);
        forget();
        var rejected = new Error((data && data.message) || 'Session expired. Please sign in again.');
        rejected.pmAuth = true;
        throw rejected;
      }
      remember(token, data.staff, data.expiresAt);
      return { token: token, staff: data.staff, offline: false, expiresAt: data.expiresAt };
    }).catch(function (err) {
      if (err && err.pmAuth) throw err;
      if (err && err.pmNetwork) {
        var off = offlineSession(token);
        if (off) return { token: token, staff: off.staff, offline: true, until: off.until, validatedAt: off.validatedAt };
        var failed = new Error('No internet connection, and this device has no recently verified staff session. Connect and sign in.');
        failed.pmOffline = true;
        throw failed;
      }
      throw err;
    });
  }

  function banner(result) {
    var el = document.getElementById('pmOfflineBanner');
    clearTimeout(lockTimer);
    if (!result || !result.offline) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'pmOfflineBanner';
      el.setAttribute('role', 'status');
      el.className = 'offline-banner';
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.textContent = 'Offline mode — ' + result.staff.name + ' (last verified ' + new Date(result.validatedAt).toLocaleString() + '). Showing data saved on this device. Saving resumes when the connection returns. Offline access ends ' + new Date(result.until).toLocaleString() + '.';
    var wait = result.until - Date.now();
    if (wait < 1000) wait = 1000;
    if (wait > 2147000000) wait = 2147000000;
    lockTimer = setTimeout(function () { window.location.reload(); }, wait);
  }

  function pageName() {
    var path = String(window.location.pathname || '');
    var parts = path.split('/');
    var name = parts[parts.length - 1] || 'index.html';
    if (!name || name.indexOf('.') === -1) return 'index.html';
    return name;
  }

  function rememberNote(message) {
    try {
      if (message) sessionStorage.setItem('pm-auth-note', String(message));
      else sessionStorage.removeItem('pm-auth-note');
    } catch (err) {}
  }

  function followGate(data, staff) {
    var decision = (window.PMAuth && PMAuth.clientGate)
      ? PMAuth.clientGate(data, staff)
      : { go: data && data.authFailed ? 'login' : 'stay', clearToken: true };
    if (!decision || decision.go === 'stay') return false;
    if (decision.go === 'change-pin' && pageName() === 'login.html') return false;
    var message = (data && data.message) || (decision.go === 'change-pin'
      ? 'Change your temporary PIN before using the tools.'
      : 'Please sign in again.');
    if (decision.clearToken) {
      localStorage.removeItem(TOKEN_KEY);
      forget();
    }
    rememberNote(message);
    var here = pageName();
    if (here !== 'login.html') {
      var url = 'login.html';
      var tools = { 'status.html': 1, 'leave.html': 1, 'personnel.html': 1 };
      if (decision.clearToken && tools[here]) url += '?next=' + here;
      window.location.href = url;
    } else {
      var loginMsg = document.getElementById('loginMsg');
      if (loginMsg) {
        loginMsg.textContent = message;
        loginMsg.className = 'msg';
      }
      var account = document.getElementById('accountPanel');
      var signin = document.getElementById('loginPanel');
      if (decision.clearToken) {
        if (account) account.classList.add('hide');
        if (signin) signin.classList.remove('hide');
      }
    }
    return true;
  }

  function isAdmin(staff) {
    var roles = staff && staff.roles ? staff.roles : [];
    var i;
    for (i = 0; i < roles.length; i++) if (roles[i] === 'ADMIN') return true;
    return false;
  }

  window.PMSession = {
    TOKEN_KEY: TOKEN_KEY,
    validate: validate,
    remember: remember,
    forget: forget,
    offlineSession: offlineSession,
    banner: banner,
    isAdmin: isAdmin,
    followGate: followGate,
    needsPinChange: function (staff) {
      return window.PMAuth ? PMAuth.needsPinChange(staff) : !!(staff && staff.forceReset);
    }
  };
})();
