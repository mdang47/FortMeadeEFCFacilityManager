(function () {
  function startPage() {
  pmApplyBrand();
  pmRegisterWorker();
  var tag = document.getElementById('tagline');
  var loc = document.getElementById('locationLine');
  if (tag) tag.textContent = PM_CONFIG.TAGLINE || '';
  if (loc) loc.textContent = PM_CONFIG.LOCATION_LINE || '';

  var token = '';
  var me = null;
  var editingId = '';
  var NEWS_KEY = 'pm-news-cache-v1';

  function say(text, good) {
    var node = document.getElementById('newsMsg');
    node.textContent = text || '';
    node.className = 'msg' + (good ? ' good' : '');
  }

  function cacheNews(items) {
    try { localStorage.setItem(NEWS_KEY, JSON.stringify(items || [])); } catch (e) {}
  }

  function readCache() {
    try {
      var parsed = JSON.parse(localStorage.getItem(NEWS_KEY) || '[]');
      return parsed && parsed.length ? parsed : [];
    } catch (e) { return []; }
  }

  function fillForm(item) {
    editingId = item && item.id ? item.id : '';
    document.getElementById('newsTitle').value = item ? item.title : '';
    document.getElementById('newsBody').value = item ? item.body : '';
    document.getElementById('newsDate').value = item && item.date ? item.date : PMEastern.easternDayKey(new Date());
    document.getElementById('newsFormTitle').textContent = editingId ? 'Edit announcement' : 'New announcement';
    PMDom.show(document.getElementById('newsForm'), true);
  }

  function newsCard(item) {
    var card = PMDom.el('article', 'panel news-card');
    card.appendChild(PMDom.el('h3', null, item.title));
    card.appendChild(PMDom.el('div', 'when', (item.date || '') + (item.authorName ? ' · ' + item.authorName : '')));
    card.appendChild(PMDom.el('p', null, item.body || ''));
    if (PMSession.isAdmin(me)) {
      var actions = PMDom.el('div', 'actions');
      var edit = PMDom.el('button', 'button secondary', 'Edit');
      edit.type = 'button';
      edit.onclick = function () { fillForm(item); };
      var del = PMDom.el('button', 'button danger', 'Delete');
      del.type = 'button';
      del.onclick = function () { removeNews(item); };
      actions.appendChild(edit);
      actions.appendChild(del);
      card.appendChild(actions);
    }
    return card;
  }

  function renderNews(items) {
    var root = document.getElementById('newsList');
    PMDom.clear(root);
    if (!items || !items.length) {
      root.appendChild(PMDom.el('p', 'muted', 'No announcements yet.'));
      return;
    }
    var i;
    for (i = 0; i < items.length; i++) root.appendChild(newsCard(items[i]));
  }

  function loadNews() {
    return pmCall({ action: 'newsList', token: token }).then(function (data) {
      if (!data || data.success !== true) {
        if (data && data.authFailed) {
          PMSession.followGate(data);
          return;
        }
        throw new Error((data && data.message) || 'Could not load news.');
      }
      cacheNews(data.news || []);
      renderNews(data.news || []);
      say('');
    }).catch(function (err) {
      var cached = readCache();
      if (err && err.pmNetwork && cached.length) {
        renderNews(cached);
        say('Showing announcements saved on this device.');
        return;
      }
      say(err.message || 'Could not load news.');
    });
  }

  function removeNews(item) {
    if (!window.confirm('Delete “' + item.title + '”?')) return;
    pmCall({ action: 'newsDelete', token: token, id: item.id }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not delete.');
      say('Announcement deleted.', true);
      return loadNews();
    }).catch(function (err) { say(err.message || 'Could not delete.'); });
  }

  function signedIn(session) {
    me = session.staff;
    token = session.token;
    PMDom.show(document.getElementById('signedOut'), false);
    PMDom.show(document.getElementById('signedIn'), true);
    PMDom.show(document.getElementById('newsNew'), PMSession.isAdmin(me));
    PMDom.show(document.getElementById('adminTile'), PMSession.isAdmin(me));
    PMSession.banner(session);
    if (session.offline) {
      renderNews(readCache());
      say('Offline — showing announcements saved on this device.');
      return;
    }
    loadNews();
  }

  function signedOut() {
    me = null;
    token = '';
    PMDom.show(document.getElementById('signedOut'), true);
    PMDom.show(document.getElementById('signedIn'), false);
    PMSession.banner(null);
  }

  document.getElementById('newsNew').onclick = function () { fillForm(null); };
  document.getElementById('newsCancel').onclick = function () {
    editingId = '';
    PMDom.show(document.getElementById('newsForm'), false);
  };
  document.getElementById('newsSave').onclick = function () {
    var button = document.getElementById('newsSave');
    button.disabled = true;
    pmCall({
      action: 'newsSave',
      token: token,
      id: editingId,
      title: document.getElementById('newsTitle').value,
      body: document.getElementById('newsBody').value,
      date: document.getElementById('newsDate').value
    }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Could not save.');
      editingId = '';
      PMDom.show(document.getElementById('newsForm'), false);
      say('Announcement saved.', true);
      return loadNews();
    }).catch(function (err) {
      say(err.message || 'Could not save.');
    }).then(function () { button.disabled = false; });
  };

  var existing = localStorage.getItem(PMSession.TOKEN_KEY) || '';
  if (!existing) {
    signedOut();
    return;
  }
  PMSession.validate().then(function (session) {
    if (!session.staff) {
      signedOut();
      return;
    }
    if (PMSession.needsPinChange(session.staff)) {
      PMSession.followGate({ success: true, message: 'Change your temporary PIN before using the tools.', staff: session.staff }, session.staff);
      return;
    }
    signedIn(session);
  }).catch(function (err) {
    if (err && err.pmAuth) {
      PMSession.followGate({ authFailed: true, message: err.message || 'Please sign in.' });
      return;
    }
    signedOut();
  });
  }
  PMAccess.whenReady(startPage);
})();
