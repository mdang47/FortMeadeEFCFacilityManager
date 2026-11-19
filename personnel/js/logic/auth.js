/* Role rules for every write (and for staff-only reads).
 * The Apps Script copy in backend/Auth.gs must stay in sync with the action maps.
 * ADMIN can do every staff action. Buttons hidden in the page are not the check.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PMAuth = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WRITE_ACTIONS = {
    authLogout: ['STAFF', 'ADMIN'],
    authChangePin: ['STAFF', 'ADMIN'],
    authCreateStaff: ['ADMIN'],
    authSetRoles: ['ADMIN'],
    authResetPin: ['ADMIN'],
    authSetActive: ['ADMIN'],
    authDeleteStaff: ['ADMIN'],
    authListStaff: ['ADMIN'],
    authAudit: ['ADMIN'],
    newsSave: ['ADMIN'],
    newsDelete: ['ADMIN'],
    statusSet: ['STAFF', 'ADMIN'],
    statusConfigSave: ['ADMIN'],
    leaveAdd: ['STAFF', 'ADMIN'],
    leaveUpdate: ['STAFF', 'ADMIN'],
    leaveDelete: ['ADMIN'],
    personnelSave: ['ADMIN'],
    personnelAction: ['ADMIN'],
    detailSave: ['ADMIN'],
    detailDelete: ['ADMIN']
  };

  var READ_ACTIONS = {
    newsList: ['STAFF', 'ADMIN'],
    statusBoard: ['STAFF', 'ADMIN'],
    statusConfigList: ['STAFF', 'ADMIN'],
    leaveList: ['STAFF', 'ADMIN'],
    personnelList: ['STAFF', 'ADMIN']
  };

  function rolesOf(staff) {
    if (!staff || !staff.roles || !staff.roles.length) return [];
    return staff.roles;
  }

  function isActive(staff) {
    if (!staff) return false;
    if (staff.active === false || staff.active === 'false' || staff.active === 0 || staff.active === '0') return false;
    return true;
  }

  function hasAnyRole(staff, allowed) {
    var roles = rolesOf(staff);
    var i;
    var j;
    for (i = 0; i < allowed.length; i++) {
      for (j = 0; j < roles.length; j++) {
        if (roles[j] === allowed[i]) return true;
      }
    }
    return false;
  }

  function isAdmin(staff) {
    return hasAnyRole(staff, ['ADMIN']);
  }

  function fail(message) {
    return { ok: false, message: message };
  }

  function authorize(action, staff, extra) {
    extra = extra || {};
    if (!staff) return fail('Sign in required.');
    if (!isActive(staff)) return fail('This account is inactive.');
    var pinChange = action === 'authChangePin' || action === 'authLogout';
    if (staff.forceReset === true && !pinChange) return fail('Change your temporary PIN before continuing.');
    var allowed = WRITE_ACTIONS[action] || READ_ACTIONS[action];
    if (!allowed) return fail('Unknown action.');
    if (!hasAnyRole(staff, allowed)) return fail('Your role cannot do that.');
    if (action === 'statusSet') {
      var target = extra.targetId ? String(extra.targetId) : String(staff.id);
      if (target !== String(staff.id) && !isAdmin(staff)) return fail('You can only change your own status.');
    }
    return { ok: true };
  }

  function needsPinChange(staff) {
    if (!staff) return false;
    return staff.forceReset === true || staff.forceReset === 'true' || staff.forceReset === 1;
  }

  /* Where the page should send the user after a server payload.
   * authFailed always wins and clears the token. A temporary PIN keeps it
   * so the login page can still call authChangePin.
   */
  function clientGate(data, staff) {
    if (!data || data.authFailed === true) return { go: 'login', clearToken: true };
    var person = staff || data.staff;
    if (needsPinChange(person)) return { go: 'change-pin', clearToken: false };
    if (data.success === false && /temporary PIN/i.test(String(data.message || ''))) {
      return { go: 'change-pin', clearToken: false };
    }
    return { go: 'stay', clearToken: false };
  }

  return {
    WRITE_ACTIONS: WRITE_ACTIONS,
    READ_ACTIONS: READ_ACTIONS,
    rolesOf: rolesOf,
    isActive: isActive,
    hasAnyRole: hasAnyRole,
    isAdmin: isAdmin,
    authorize: authorize,
    needsPinChange: needsPinChange,
    clientGate: clientGate
  };
});
