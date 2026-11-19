function pmApplyBrand() {
  var name = (PM_CONFIG && PM_CONFIG.APP_NAME) || 'Personnel Management';
  var nodes = document.querySelectorAll('[data-app-name]');
  var i;
  for (i = 0; i < nodes.length; i++) nodes[i].textContent = name;
  var page = document.body.getAttribute('data-page-title') || '';
  document.title = page ? (name + ' — ' + page) : name;
  var demo = document.getElementById('demoBanner');
  if (demo) {
    if (pmUseMock()) {
      demo.textContent = 'Demo mode — fake data on this device only. Nothing is saved to Google Sheets. Choose a demo name and any 6-digit PIN.';
      demo.className = 'demo-banner';
    } else {
      demo.className = 'demo-banner hide';
      demo.textContent = '';
    }
  }
}

function pmRegisterWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(function () {});
  });
}
