/* America/New_York calendar day without Intl, so an old iPad can reset the
 * status board at Eastern midnight. Post-2007 US DST: second Sunday in March
 * 02:00 EST (07:00 UTC) through first Sunday in November 02:00 EDT (06:00 UTC).
 * Adapted from the EFC Tools status board.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PMEastern = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function nthSunday(year, monthIndex, n) {
    var dow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    return 1 + (dow === 0 ? 0 : 7 - dow) + (n - 1) * 7;
  }

  function offsetHours(utcMs) {
    var y = new Date(utcMs).getUTCFullYear();
    var start = Date.UTC(y, 2, nthSunday(y, 2, 2), 7, 0, 0);
    var end = Date.UTC(y, 10, nthSunday(y, 10, 1), 6, 0, 0);
    if (utcMs >= start && utcMs < end) return 4;
    return 5;
  }

  function easternDayKey(when) {
    var ms = when instanceof Date ? when.getTime() : new Date(when).getTime();
    if (isNaN(ms)) return '';
    var shifted = new Date(ms - offsetHours(ms) * 3600000);
    return shifted.getUTCFullYear() + '-' + pad2(shifted.getUTCMonth() + 1) + '-' + pad2(shifted.getUTCDate());
  }

  function msUntilEasternMidnightFrom(startMs) {
    var key = easternDayKey(new Date(startMs));
    if (!key) return 3600000;
    var lo = startMs;
    var hi = startMs + 36 * 3600000;
    if (easternDayKey(new Date(hi)) === key) return 36 * 3600000;
    while (hi - lo > 20) {
      var mid = Math.floor((lo + hi) / 2);
      if (easternDayKey(new Date(mid)) === key) lo = mid;
      else hi = mid;
    }
    return hi - startMs;
  }

  /* A status from another Eastern day is Unknown. History rows are not touched. */
  function presentStatus(record, dayKey, needsLocation) {
    var status = record && record.status ? String(record.status) : '';
    var location = record && record.location ? String(record.location) : '';
    var updatedAt = record && record.updatedAt ? String(record.updatedAt) : '';
    var stamp = updatedAt ? easternDayKey(updatedAt) : '';
    if (!status || stamp !== dayKey) {
      return {
        status: '',
        location: '',
        updatedAt: '',
        updatedById: '',
        updatedByName: '',
        current: false
      };
    }
    if (!needsLocation) location = '';
    return {
      status: status,
      location: location,
      updatedAt: updatedAt,
      updatedById: record.updatedById ? String(record.updatedById) : '',
      updatedByName: record.updatedByName ? String(record.updatedByName) : '',
      current: true
    };
  }

  return {
    pad2: pad2,
    offsetHours: offsetHours,
    easternDayKey: easternDayKey,
    msUntilEasternMidnightFrom: msUntilEasternMidnightFrom,
    presentStatus: presentStatus
  };
});
