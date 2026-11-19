/* Leave-tracker rules and the offline action queue. Adapted from EFC Tools. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.PMLeave = factory(root.PMDates);
})(typeof self !== 'undefined' ? self : this, function (Dates) {
  'use strict';

  var TYPES = ['Leave', 'Appointment', 'Day Pass', 'Unit Event', 'In Late', 'Indoc', 'Other'];
  var STATUSES = ['Pending', 'Approved', 'Denied', 'Cancelled'];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function validateLeave(input) {
    var type = String(input && input.type || '');
    var name = String(input && input.name || '').replace(/\s+/g, ' ').trim();
    var start = String(input && input.start || '');
    var end = String(input && input.end || '');
    var startTime = String(input && input.startTime || '');
    var endTime = String(input && input.endTime || '');
    var notes = String(input && input.notes || '').trim();
    var status = String(input && input.status || 'Pending');
    if (TYPES.indexOf(type) === -1) return { ok: false, message: 'Choose a leave type.' };
    if (!name) return { ok: false, message: 'Enter a name.' };
    if (name.length > 100) return { ok: false, message: 'Name is too long.' };
    if (!Dates.parseYMD(start)) return { ok: false, message: 'Enter a valid start date.' };
    if (STATUSES.indexOf(status) === -1) return { ok: false, message: 'Unknown leave status.' };
    if (notes.length > 2000) return { ok: false, message: 'Notes are too long.' };

    var days = 0;
    if (type === 'Appointment' || type === 'In Late') {
      end = start;
      endTime = '';
      if (!/^\d{2}:\d{2}$/.test(startTime)) {
        return { ok: false, message: type === 'Appointment' ? 'Enter the appointment time.' : 'Enter the expected arrival time.' };
      }
      days = 1;
    } else if (type === 'Indoc') {
      startTime = '';
      endTime = '';
      if (!Dates.parseYMD(end)) return { ok: false, message: 'Enter both Day 1 and Day 2 dates.' };
      days = 2;
    } else {
      if (type !== 'Other') {
        startTime = '';
        endTime = '';
      }
      if (!Dates.parseYMD(end)) return { ok: false, message: 'Enter an end date.' };
      days = Dates.inclusiveDays(start, end);
      if (!days) return { ok: false, message: 'The end date cannot be before the start date.' };
    }

    return {
      ok: true,
      request: {
        name: name,
        type: type,
        start: start,
        end: end,
        startTime: startTime,
        endTime: endTime,
        days: days,
        notes: notes,
        status: status
      }
    };
  }

  function applyLeaveAction(list, action) {
    var next = clone(list || []);
    var i;
    if (!action || !action.type) return next;
    if (action.type === 'add') {
      var request = action.request;
      if (!request) return next;
      for (i = 0; i < next.length; i++) {
        if (String(next[i].id) === String(request.id)) return next;
      }
      next.push(clone(request));
      return next;
    }
    if (action.type === 'update') {
      if (!action.request) return next;
      for (i = 0; i < next.length; i++) {
        if (String(next[i].id) === String(action.request.id)) next[i] = clone(action.request);
      }
      return next;
    }
    if (action.type === 'delete') {
      var kept = [];
      for (i = 0; i < next.length; i++) {
        if (String(next[i].id) !== String(action.id)) kept.push(next[i]);
      }
      return kept;
    }
    return next;
  }

  /* Collapse queued edits. Deleting something that was never synced drops it. */
  function queueLeaveAction(pending, action) {
    var next = clone(pending || []);
    var i;
    if (!action) return next;
    var id = action.type === 'delete' ? action.id : (action.request && action.request.id);
    if (action.type === 'add') {
      next.push(clone(action));
      return next;
    }
    for (i = 0; i < next.length; i++) {
      var item = next[i];
      var itemId = item.type === 'delete' ? item.id : (item.request && item.request.id);
      if (String(itemId) !== String(id)) continue;
      if (item.type === 'add' && action.type === 'update') {
        item.request = clone(action.request);
        return next;
      }
      if (item.type === 'add' && action.type === 'delete') {
        var kept = [];
        var j;
        for (j = 0; j < next.length; j++) {
          var other = next[j];
          var otherId = other.type === 'delete' ? other.id : (other.request && other.request.id);
          if (String(otherId) === String(id)) continue;
          kept.push(other);
        }
        return kept;
      }
      if (item.type === 'update' && action.type === 'update') {
        item.request = clone(action.request);
        return next;
      }
    }
    next.push(clone(action));
    return next;
  }

  return {
    TYPES: TYPES,
    STATUSES: STATUSES,
    validateLeave: validateLeave,
    applyLeaveAction: applyLeaveAction,
    queueLeaveAction: queueLeaveAction
  };
});
