/* Time in office, monthly inbound/outbound counts, and upcoming departures. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.PMMetrics = factory(root.PMDates);
})(typeof self !== 'undefined' ? self : this, function (Dates) {
  'use strict';

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function formatTenure(totalDays, parts) {
    if (!parts) return 'Arrival date missing';
    var bits = [];
    if (parts.years) bits.push(plural(parts.years, 'year'));
    if (parts.months) bits.push(plural(parts.months, 'month'));
    if (parts.days || !bits.length) bits.push(plural(parts.days, 'day'));
    return plural(totalDays, 'day') + ' (' + bits.join(', ') + ')';
  }

  function compareName(a, b) {
    var an = String(a || '');
    var bn = String(b || '');
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  }

  /* Current people only (not Departed), longest time in office first.
   * Missing arrival dates sort last. Future arrivals count as 0 days.
   */
  function tenureList(personnel, today) {
    var rows = [];
    var people = personnel || [];
    var i;
    for (i = 0; i < people.length; i++) {
      var person = people[i];
      if (!person || person.status === 'Departed') continue;
      var arrival = person.arrivalDate ? String(person.arrivalDate) : '';
      var span = arrival ? Dates.daysBetween(arrival, today) : null;
      var missing = span === null;
      var days = missing ? -1 : span;
      if (!missing && days < 0) days = 0;
      var parts = missing ? null : Dates.ymdBreakdown(arrival, days === 0 && span < 0 ? arrival : today);
      if (!missing && span < 0) parts = { years: 0, months: 0, days: 0 };
      rows.push({
        id: String(person.id || ''),
        name: String(person.name || ''),
        rank: String(person.rank || ''),
        status: String(person.status || ''),
        detailId: person.detailId ? String(person.detailId) : '',
        arrivalDate: arrival,
        days: days,
        missing: missing,
        parts: parts,
        label: missing ? 'Arrival date missing' : formatTenure(days, parts)
      });
    }
    rows.sort(function (a, b) {
      if (a.missing !== b.missing) return a.missing ? 1 : -1;
      if (a.days !== b.days) return b.days - a.days;
      var byName = compareName(a.name, b.name);
      if (byName) return byName;
      return compareName(a.id, b.id);
    });
    return rows;
  }

  /* Inbound = arrival date in that month. Outbound = actual departure in that month. */
  function movementTrends(personnel, today, monthCount) {
    var months = Dates.recentMonths(today, monthCount || 12);
    var buckets = {};
    var i;
    for (i = 0; i < months.length; i++) buckets[months[i].key] = { inbound: 0, outbound: 0 };
    var people = personnel || [];
    for (i = 0; i < people.length; i++) {
      var person = people[i];
      if (!person) continue;
      var arrival = Dates.parseYMD(person.arrivalDate);
      if (arrival) {
        var aKey = Dates.monthKey(arrival);
        if (buckets[aKey]) buckets[aKey].inbound += 1;
      }
      var departed = Dates.parseYMD(person.actualDeparture);
      if (departed) {
        var dKey = Dates.monthKey(departed);
        if (buckets[dKey]) buckets[dKey].outbound += 1;
      }
    }
    var rows = [];
    for (i = 0; i < months.length; i++) {
      var bucket = buckets[months[i].key];
      rows.push({
        key: months[i].key,
        label: months[i].label,
        inbound: bucket.inbound,
        outbound: bucket.outbound
      });
    }
    return rows;
  }

  /* Overlapping windows: a departure 10 days out is inside 30, 60, and 90. */
  function upcomingDepartures(personnel, today, windows) {
    var limits = windows && windows.length ? windows : [30, 60, 90];
    var groups = {};
    var i;
    for (i = 0; i < limits.length; i++) groups[limits[i]] = [];
    var people = personnel || [];
    for (i = 0; i < people.length; i++) {
      var person = people[i];
      if (!person || person.status === 'Departed') continue;
      if (!person.projectedDeparture) continue;
      var days = Dates.daysBetween(today, person.projectedDeparture);
      if (days === null || days < 0) continue;
      var w;
      for (w = 0; w < limits.length; w++) {
        if (days <= limits[w]) {
          groups[limits[w]].push({
            id: String(person.id || ''),
            name: String(person.name || ''),
            rank: String(person.rank || ''),
            status: String(person.status || ''),
            detailId: person.detailId ? String(person.detailId) : '',
            projectedDeparture: String(person.projectedDeparture),
            days: days
          });
        }
      }
    }
    for (i = 0; i < limits.length; i++) {
      groups[limits[i]].sort(function (a, b) {
        if (a.days !== b.days) return a.days - b.days;
        return compareName(a.name, b.name);
      });
    }
    return groups;
  }

  return {
    plural: plural,
    formatTenure: formatTenure,
    tenureList: tenureList,
    movementTrends: movementTrends,
    upcomingDepartures: upcomingDepartures
  };
});
