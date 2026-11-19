/* Same request shape as EFC Tools. A string body is sent as text/plain, which
 * is a simple POST and does not trigger a CORS preflight. Do not add a JSON
 * content-type header. Apps Script does not answer that preflight.
 */
function pmFinish(data) {
  if (data && data.accessRequired && typeof PMAccess !== 'undefined' && PMAccess.deny) {
    PMAccess.deny(data.message || 'Enter the access PIN.');
    return new Promise(function () {});
  }
  if (typeof PMSession !== 'undefined' && PMSession.followGate && PMSession.followGate(data)) {
    return new Promise(function () {});
  }
  return data;
}

function pmWithAccess(body) {
  var next = {};
  var key;
  var source = body || {};
  for (key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) next[key] = source[key];
  }
  if (next.action !== 'accessCheck') {
    try {
      var saved = localStorage.getItem('pm-access-token-v1') || '';
      if (saved) next.accessToken = saved;
    } catch (err) {}
  }
  return next;
}

function pmCall(body) {
  var outbound = pmWithAccess(body);
  var payload = JSON.stringify(outbound);
  if (pmUseMock()) return PMMock.handle(outbound).then(pmFinish);
  return fetch(PM_CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    body: payload
  }).then(function (response) {
    if (!response.ok) {
      var err = new Error('HTTP ' + response.status);
      err.pmNetwork = true;
      throw err;
    }
    return response.text().then(function (text) {
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        var bad = new Error('The server did not return JSON.');
        bad.pmNetwork = true;
        throw bad;
      }
    });
  }, function (netErr) {
    if (netErr) netErr.pmNetwork = true;
    throw netErr;
  }).then(pmFinish);
}
