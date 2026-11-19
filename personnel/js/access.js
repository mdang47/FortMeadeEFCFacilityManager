/* Full-screen site gate. The access PIN is never stored; only the server token is. */
(function () {
  var KEY = 'pm-access-token-v1';
  var waiters = [];
  var ready = false;

  function read() {
    try { return localStorage.getItem(KEY) || ''; }
    catch (err) { return ''; }
  }

  function write(token) {
    try {
      if (token) localStorage.setItem(KEY, token);
      else localStorage.removeItem(KEY);
    } catch (err) {}
  }

  function fresh(token) {
    var exp = Number(String(token || '').split('.')[0]);
    return !!(exp && exp > Date.now());
  }

  function show(message) {
    ready = false;
    document.body.classList.add('needs-access');
    var gate = document.getElementById('accessGate');
    if (gate) gate.classList.remove('hide');
    var msg = document.getElementById('accessMsg');
    if (msg) msg.textContent = message || '';
  }

  function reveal() {
    ready = true;
    document.body.classList.remove('needs-access');
    var gate = document.getElementById('accessGate');
    if (gate) gate.classList.add('hide');
    var pending = waiters;
    waiters = [];
    var i;
    for (i = 0; i < pending.length; i++) pending[i]();
  }

  function deny(message) {
    write('');
    show(message || 'Enter the access PIN.');
  }

  function whenReady(fn) {
    if (ready) fn();
    else waiters.push(fn);
  }

  function noteDemo() {
    var node = document.getElementById('accessDemo');
    if (!node) return;
    if (typeof pmUseMock === 'function' && pmUseMock()) {
      node.textContent = 'Demo mode uses fake data on this device. Any 4 to 8 digits will open it.';
      node.classList.remove('hide');
    }
  }

  function boot() {
    if (typeof pmApplyBrand === 'function') pmApplyBrand();
    noteDemo();
    var existing = read();
    if (!existing || !fresh(existing)) {
      write('');
      show('');
      return;
    }
    pmCall({ action: 'authRoster' }).then(function (data) {
      if (data && data.success) reveal();
      else if (data && data.accessRequired) deny(data.message);
      else show((data && data.message) || 'Access denied.');
    }).catch(function () {
      show('The server could not be reached. Try again.');
    });
  }

  function submit() {
    var input = document.getElementById('accessPin');
    var button = document.getElementById('accessSubmit');
    var pin = input ? String(input.value || '') : '';
    if (input) input.value = '';
    if (!pin) {
      show('Access denied.');
      return;
    }
    if (button) button.disabled = true;
    pmCall({ action: 'accessCheck', pin: pin }).then(function (data) {
      if (button) button.disabled = false;
      if (data && data.success && data.accessToken) {
        write(data.accessToken);
        reveal();
        return;
      }
      show((data && data.message) || 'Access denied.');
    }).catch(function () {
      if (button) button.disabled = false;
      show('The server could not be reached. Try again.');
    });
  }

  window.PMAccess = {
    whenReady: whenReady,
    deny: deny,
    show: show
  };

  var form = document.getElementById('accessForm');
  var button = document.getElementById('accessSubmit');
  var input = document.getElementById('accessPin');
  if (button) button.onclick = submit;
  if (input) {
    input.onkeydown = function (event) {
      if (event.keyCode === 13) submit();
    };
  }
  if (form) form.onsubmit = function () { submit(); return false; };
  boot();
})();
