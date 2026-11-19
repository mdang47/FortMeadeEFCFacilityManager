/* Calendar dates as YYYY-MM-DD. Math uses UTC so daylight-saving days stay 24 hours. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PMDates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad2(n) {
    n = Math.floor(Number(n));
    return (n < 10 ? '0' : '') + n;
  }

  function parseYMD(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  function formatYMD(parts) {
    return parts.y + '-' + pad2(parts.m) + '-' + pad2(parts.d);
  }

  function addDaysYMD(value, days) {
    var parts = parseYMD(value);
    if (!parts) return '';
    var dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + Number(days || 0)));
    return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
  }

  /* Whole days from start to end. Negative when end is before start. Null if either date is invalid. */
  function daysBetween(start, end) {
    var a = parseYMD(start);
    var b = parseYMD(end);
    if (!a || !b) return null;
    var ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
    return Math.round(ms / 86400000);
  }

  /* Inclusive day count used by the leave tracker. 0 when the end is before the start. */
  function inclusiveDays(start, end) {
    var n = daysBetween(start, end);
    if (n === null || n < 0) return 0;
    return n + 1;
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  /* Calendar years/months/days between two dates. Day-of-month is clamped when
   * the start day does not exist in the landing month (31 Jan + 1 month). */
  function addMonthsClamped(parts, months) {
    var index = parts.m - 1 + months;
    var year = parts.y + Math.floor(index / 12);
    var monthIndex = ((index % 12) + 12) % 12;
    var dim = daysInMonth(year, monthIndex + 1);
    var day = parts.d > dim ? dim : parts.d;
    return { y: year, m: monthIndex + 1, d: day };
  }

  function ymdBreakdown(start, end) {
    var a = parseYMD(start);
    var b = parseYMD(end);
    if (!a || !b) return null;
    var span = daysBetween(start, end);
    if (span === null) return null;
    if (span < 0) return { years: 0, months: 0, days: 0 };
    var totalMonths = (b.y - a.y) * 12 + (b.m - a.m);
    if (b.d < a.d) totalMonths -= 1;
    if (totalMonths < 0) totalMonths = 0;
    var years = Math.floor(totalMonths / 12);
    var months = totalMonths % 12;
    var anchor = addMonthsClamped(a, totalMonths);
    var days = daysBetween(formatYMD(anchor), end);
    if (days === null || days < 0) days = 0;
    return { years: years, months: months, days: days };
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function monthKey(parts) {
    return parts.y + '-' + pad2(parts.m);
  }

  /* Oldest first, including the month that contains todayYmd. */
  function recentMonths(todayYmd, count) {
    var end = parseYMD(todayYmd);
    if (!end) return [];
    var n = Number(count) || 12;
    var out = [];
    var i;
    for (i = n - 1; i >= 0; i--) {
      var month = end.m - i;
      var year = end.y;
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      out.push({
        y: year,
        m: month,
        key: year + '-' + pad2(month),
        label: MONTHS[month - 1] + ' ' + String(year).slice(2)
      });
    }
    return out;
  }

  return {
    pad2: pad2,
    parseYMD: parseYMD,
    formatYMD: formatYMD,
    addDaysYMD: addDaysYMD,
    daysBetween: daysBetween,
    inclusiveDays: inclusiveDays,
    daysInMonth: daysInMonth,
    ymdBreakdown: ymdBreakdown,
    monthKey: monthKey,
    recentMonths: recentMonths,
    MONTHS: MONTHS
  };
});
