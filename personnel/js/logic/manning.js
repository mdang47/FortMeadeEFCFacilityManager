/* Manning math for the personnel tracker.
 * Fill = people with status Assigned or Outbound on an active detail.
 * Inbound and anyone without an active detail are unassigned.
 * Departed people stay in history and do not fill a seat.
 *
 * Colors: red under 70%, amber 70–99%, green 100% and above.
 * More people than the target is green and flagged overmanned.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PMManning = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return n;
  }

  function manningPercent(assigned, required) {
    assigned = num(assigned);
    required = num(required);
    if (required <= 0) return null;
    return Math.round((assigned / required) * 100);
  }

  function manningTone(assigned, required) {
    assigned = num(assigned);
    required = num(required);
    var percent = manningPercent(assigned, required);
    var overmanned = required > 0 ? assigned > required : assigned > 0;
    var tone = 'red';
    if (required <= 0) tone = assigned > 0 ? 'over' : 'empty';
    else if (percent >= 100) tone = 'green';
    else if (percent >= 70) tone = 'amber';
    return {
      assigned: assigned,
      required: required,
      percent: percent,
      tone: tone,
      overmanned: overmanned
    };
  }

  function manningLabel(assigned, required) {
    var tone = manningTone(assigned, required);
    var left = tone.assigned + '/' + tone.required;
    if (tone.percent === null) return left;
    return left + ' (' + tone.percent + '%)';
  }

  function barWidth(assigned, required) {
    assigned = num(assigned);
    required = num(required);
    if (required <= 0) return assigned > 0 ? 100 : 0;
    var pct = (assigned / required) * 100;
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return Math.round(pct * 10) / 10;
  }

  function fillsSeat(person) {
    if (!person) return false;
    return person.status === 'Assigned' || person.status === 'Outbound';
  }

  function summarizeManning(details, personnel) {
    var active = [];
    var i;
    var list = details || [];
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].active !== false && String(list[i].active) !== 'false') active.push(list[i]);
    }
    var activeIds = {};
    for (i = 0; i < active.length; i++) activeIds[String(active[i].id)] = true;

    var counts = {};
    for (i = 0; i < active.length; i++) counts[String(active[i].id)] = 0;

    var people = personnel || [];
    var current = 0;
    var departed = 0;
    var unassigned = 0;
    for (i = 0; i < people.length; i++) {
      var person = people[i];
      if (!person) continue;
      if (person.status === 'Departed') {
        departed += 1;
        continue;
      }
      current += 1;
      var detailId = person.detailId ? String(person.detailId) : '';
      if (fillsSeat(person) && detailId && activeIds[detailId]) counts[detailId] += 1;
      else unassigned += 1;
    }

    var rows = [];
    var filling = 0;
    var requiredTotal = 0;
    for (i = 0; i < active.length; i++) {
      var detail = active[i];
      var id = String(detail.id);
      var assigned = counts[id] || 0;
      var required = num(detail.required);
      var tone = manningTone(assigned, required);
      filling += assigned;
      requiredTotal += required;
      rows.push({
        id: id,
        name: String(detail.name || ''),
        assigned: assigned,
        required: required,
        percent: tone.percent,
        tone: tone.tone,
        overmanned: tone.overmanned,
        label: manningLabel(assigned, required),
        bar: barWidth(assigned, required)
      });
    }

    var totalTone = manningTone(filling, requiredTotal);
    return {
      details: rows,
      unassigned: unassigned,
      filling: filling,
      requiredTotal: requiredTotal,
      current: current,
      departed: departed,
      totalLabel: manningLabel(filling, requiredTotal),
      totalTone: totalTone.tone,
      totalOvermanned: totalTone.overmanned,
      totalPercent: totalTone.percent,
      totalBar: barWidth(filling, requiredTotal)
    };
  }

  return {
    manningPercent: manningPercent,
    manningTone: manningTone,
    manningLabel: manningLabel,
    barWidth: barWidth,
    fillsSeat: fillsSeat,
    summarizeManning: summarizeManning
  };
});
